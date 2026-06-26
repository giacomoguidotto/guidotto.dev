// AttractorScene — the live WebGL instrument (the single WebGL spend).
//
// Lazy-loaded (ssr:false dynamic import) only when the finale scrolls into view,
// so three.js + this scene never enter the initial HTML / critical JS budget.
// Everything per-frame is driven by ONE useFrame, so the ordering between timing,
// geometry morph, comet, and bloom is deterministic (no reliance on child mount
// order): it advances the shared FinaleController, rewrites the tube/mote/comet
// buffers in place, then sets bloom intensity, and the EffectComposer (a priority
// frame) renders last.
//
// The render:
//   - observation motes rain in as faint cool-white points (the noisy data);
//   - the learned field is a glowing accent tube that uncurls across the replayed
//     snapshots and snaps into the both-lobed butterfly;
//   - additive bloom swells to a peak at convergence, then eases back;
//   - a comet then traces the converged attractor forever (a fading additive tail);
//   - drag orbits the genuinely-3D object; depth fog dims the far lobe.

"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { type BloomEffect, KernelSize } from "postprocessing";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  type BufferGeometry,
  Color,
  DoubleSide,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type Object3D,
  type PointsMaterial,
  TOUCH,
  type WebGLRenderer,
} from "three";
import styles from "./attractor.module.css";
import { type FinaleController, snapshotFloat } from "./controller";
import { type FinaleData, TUBE_SAMPLES } from "./finale-data";
import { buildTubeIndex, lerpCenterline, writeTube } from "./tube";

const RADIAL = 6;
const TUBE_RADIUS = 0.42;
const COMET_TRAIL = 28;
const COMET_RADIUS = 0.26;
const COMET_PERIOD_MS = 7000;
// Fraction of each loop spent fading the comet in (as it leaves the curve's
// start) and out (as it reaches the end). The attractor is an OPEN curve, so a
// hard wrap would teleport the head across the seam; instead it fades away at
// the end and fades back in at the start.
const COMET_FADE = 0.16;

// Timing of the once-on-view play-through (ms).
const INTRO_MS = 1100; // motes rain in
const HOLD_MS = 300; // a beat on the noisy seed
const PLAY_MS = 6800; // uncurl 0 -> 1
const PEAK_DECAY_MS = 1300; // bloom eases back after convergence
// Clamp the per-frame timeline step, so a pause (off-screen frame loop) or a
// throttled background tab never makes the autoplay leap on resume.
const MAX_FRAME_MS = 50;

const FOG_COLOR = "#05060c";
const FOG_NEAR = 48;
const FOG_FAR = 108;
const MOTE_COLOR = "#c7d2e8";
const CONVERGED = 0.999;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

interface SceneProps {
  readonly accent: string;
  readonly controller: FinaleController;
  readonly data: FinaleData;
}

interface CanvasProps extends SceneProps {
  /** False while the finale is off-screen — pauses the frame loop. */
  readonly active: boolean;
  /** Drop to the static tier when the GL context is lost (driver reset / OOM). */
  readonly onContextLost: () => void;
}

interface Scratch {
  readonly cometCenter: Float32Array;
  readonly cometColors: Float32Array;
  readonly cometIndex: Uint16Array;
  readonly cometPositions: Float32Array;
  readonly moteDelay: Float32Array;
  readonly motePositions: Float32Array;
  readonly moteRise: Float32Array;
  readonly tubeIndex: Uint16Array;
  readonly tubePositions: Float32Array;
  readonly workLine: Float32Array;
}

interface Clock {
  convergedAt: number;
  /** Active-time accumulator (ms) — advances only on rendered frames. */
  elapsed: number;
}

/** Advance the once-on-view timeline: motes rain-in, then autoplay the training.
 *  Driven by accumulated frame time (not wall-clock), so pausing the frame loop
 *  off-screen freezes the beat rather than skipping it. */
function stepTiming(controller: FinaleController, clock: Clock, dtMs: number) {
  if (controller.userScrubbing) {
    return;
  }
  clock.elapsed += Math.min(dtMs, MAX_FRAME_MS);
  const elapsed = clock.elapsed;
  controller.reveal = smoothstep(0, INTRO_MS, elapsed);
  if (controller.autoplayActive) {
    const playElapsed = elapsed - INTRO_MS - HOLD_MS;
    if (playElapsed > 0) {
      const raw = clamp01(playElapsed / PLAY_MS);
      controller.progress = smoothstep(0, 1, raw);
      if (raw >= 1) {
        controller.autoplayActive = false;
      }
    }
  }
}

/** Fall the motes in from a random height, fading them up to faint cool-white. */
function stepMotes(
  geom: BufferGeometry | null,
  mat: PointsMaterial | null,
  data: FinaleData,
  s: Scratch,
  reveal: number
) {
  if (!(geom && mat)) {
    return;
  }
  const base = data.motes;
  for (let k = 0; k < data.moteCount; k++) {
    const window = 1 - s.moteDelay[k];
    const local = clamp01((reveal - s.moteDelay[k]) / window);
    const fall = (1 - local) * s.moteRise[k];
    s.motePositions[k * 3] = base[k * 3];
    s.motePositions[k * 3 + 1] = base[k * 3 + 1] + fall;
    s.motePositions[k * 3 + 2] = base[k * 3 + 2];
  }
  geom.attributes.position.needsUpdate = true;
  mat.opacity = 0.16 + 0.34 * reveal;
}

/** Interpolate between adjacent snapshots and sweep the field tube around it. */
function stepTube(
  geom: BufferGeometry | null,
  mat: MeshBasicMaterial | null,
  data: FinaleData,
  s: Scratch,
  controller: FinaleController
) {
  if (!(geom && mat)) {
    return;
  }
  const f = snapshotFloat(controller);
  const i0 = Math.min(data.snapshotCount - 1, Math.floor(f));
  const i1 = Math.min(data.snapshotCount - 1, i0 + 1);
  lerpCenterline(
    s.workLine,
    data.centerlines[i0],
    data.centerlines[i1],
    f - i0
  );
  writeTube(s.tubePositions, s.workLine, TUBE_SAMPLES, RADIAL, TUBE_RADIUS);
  geom.attributes.position.needsUpdate = true;
  mat.opacity = 0.3 + 0.7 * smoothstep(0, 0.85, controller.progress);
}

/** Trace the comet from the start of the converged curve to its end, then fade
 *  out and fade back in at the start — the curve is open, so it never wraps. */
function stepComet(
  group: Group | null,
  trailGeom: BufferGeometry | null,
  trailMat: MeshBasicMaterial | null,
  head: Object3D | null,
  headMat: MeshBasicMaterial | null,
  data: FinaleData,
  s: Scratch,
  cometTime: number,
  converged: boolean
) {
  if (group) {
    group.visible = converged;
  }
  if (!(converged && trailGeom && trailMat && head && headMat)) {
    return;
  }
  const line = data.centerlines[data.snapshotCount - 1];
  const span = TUBE_SAMPLES - 1;
  const phase = (((cometTime / COMET_PERIOD_MS) % 1) + 1) % 1; // [0, 1)
  const headPos = phase * span;
  // Ease in over the first COMET_FADE of the loop, ease out over the last —
  // so the head dissolves at the curve's end and re-forms at its start.
  const fade =
    smoothstep(0, COMET_FADE, phase) *
    (1 - smoothstep(1 - COMET_FADE, 1, phase));
  for (let i = 0; i < COMET_TRAIL; i++) {
    // i = 0 tail .. COMET_TRAIL-1 head, walking back along the curve. Clamp
    // (never wrap) so the tail bunches at the start instead of bridging the seam.
    const idx = headPos - (COMET_TRAIL - 1 - i);
    const clamped = Math.max(0, Math.min(span, idx));
    const lo = Math.floor(clamped);
    const hi = Math.min(span, lo + 1);
    const t = clamped - lo;
    s.cometCenter[i * 3] = line[lo * 3] + (line[hi * 3] - line[lo * 3]) * t;
    s.cometCenter[i * 3 + 1] =
      line[lo * 3 + 1] + (line[hi * 3 + 1] - line[lo * 3 + 1]) * t;
    s.cometCenter[i * 3 + 2] =
      line[lo * 3 + 2] + (line[hi * 3 + 2] - line[lo * 3 + 2]) * t;
  }
  writeTube(s.cometPositions, s.cometCenter, COMET_TRAIL, RADIAL, COMET_RADIUS);
  trailGeom.attributes.position.needsUpdate = true;
  trailMat.opacity = fade;
  headMat.opacity = fade;
  const h = (COMET_TRAIL - 1) * 3;
  head.position.set(
    s.cometCenter[h],
    s.cometCenter[h + 1],
    s.cometCenter[h + 2]
  );
}

/** Swell bloom to a peak at convergence, then ease it back for the comet beat. */
function stepBloom(
  bloom: BloomEffect | null,
  clock: Clock,
  progress: number,
  now: number
) {
  if (!bloom) {
    return;
  }
  const baseGlow = 0.45 + 1.05 * smoothstep(0.5, 1, progress);
  const peak =
    clock.convergedAt < 0
      ? 0
      : 1.5 * Math.exp(-(now - clock.convergedAt) / PEAK_DECAY_MS);
  bloom.intensity = baseGlow + peak;
}

function buildScratch(data: FinaleData, accentColor: Color): Scratch {
  const cometColors = new Float32Array(COMET_TRAIL * RADIAL * 3);
  for (let i = 0; i < COMET_TRAIL; i++) {
    const fade = i / (COMET_TRAIL - 1); // 0 tail -> 1 head
    for (let j = 0; j < RADIAL; j++) {
      const v = (i * RADIAL + j) * 3;
      cometColors[v] = accentColor.r * fade;
      cometColors[v + 1] = accentColor.g * fade;
      cometColors[v + 2] = accentColor.b * fade;
    }
  }
  return {
    workLine: new Float32Array(TUBE_SAMPLES * 3),
    tubePositions: new Float32Array(TUBE_SAMPLES * RADIAL * 3),
    tubeIndex: buildTubeIndex(TUBE_SAMPLES, RADIAL),
    motePositions: new Float32Array(data.motes),
    moteRise: Float32Array.from(
      { length: data.moteCount },
      () => 22 + Math.random() * 26
    ),
    moteDelay: Float32Array.from(
      { length: data.moteCount },
      () => Math.random() * 0.4
    ),
    cometCenter: new Float32Array(COMET_TRAIL * 3),
    cometPositions: new Float32Array(COMET_TRAIL * RADIAL * 3),
    cometColors,
    cometIndex: buildTubeIndex(COMET_TRAIL, RADIAL),
  };
}

function SceneContents({ accent, controller, data }: SceneProps) {
  const tubeGeom = useRef<BufferGeometry>(null);
  const tubeMat = useRef<MeshBasicMaterial>(null);
  const motesGeom = useRef<BufferGeometry>(null);
  const motesMat = useRef<PointsMaterial>(null);
  const cometGroup = useRef<Group>(null);
  const cometTrailGeom = useRef<BufferGeometry>(null);
  const cometTrailMat = useRef<MeshBasicMaterial>(null);
  const cometHead = useRef<Mesh>(null);
  const cometHeadMat = useRef<MeshBasicMaterial>(null);
  const bloom = useRef<BloomEffect>(null);

  const accentColor = useMemo(() => new Color(accent), [accent]);
  const scratch = useMemo(
    () => buildScratch(data, accentColor),
    [data, accentColor]
  );
  const clock = useRef<Clock>({ elapsed: 0, convergedAt: -1 });

  useFrame((_state, delta) => {
    const now = performance.now();
    stepTiming(controller, clock.current, delta * 1000);
    const converged = controller.progress >= CONVERGED;
    // Latch the convergence instant before the comet/bloom read it, so both the
    // bloom decay and the comet loop share one origin and the comet fades in
    // cleanly the first time it appears.
    if (converged && clock.current.convergedAt < 0) {
      clock.current.convergedAt = now;
    }
    stepMotes(
      motesGeom.current,
      motesMat.current,
      data,
      scratch,
      controller.reveal
    );
    stepTube(tubeGeom.current, tubeMat.current, data, scratch, controller);
    stepComet(
      cometGroup.current,
      cometTrailGeom.current,
      cometTrailMat.current,
      cometHead.current,
      cometHeadMat.current,
      data,
      scratch,
      clock.current.convergedAt < 0 ? 0 : now - clock.current.convergedAt,
      converged
    );
    stepBloom(bloom.current, clock.current, controller.progress, now);
  });

  return (
    <>
      <fog args={[FOG_COLOR, FOG_NEAR, FOG_FAR]} attach="fog" />
      <OrbitControls
        dampingFactor={0.08}
        enableDamping
        enablePan={false}
        enableZoom={false}
        maxPolarAngle={Math.PI * 0.86}
        minPolarAngle={Math.PI * 0.14}
        rotateSpeed={0.55}
        target={[0, 0, 0]}
        // One finger scrolls the page (the canvas keeps touch-action: pan-y);
        // two fingers orbit. With ONE left unset, a single-finger touch falls
        // through OrbitControls to a no-op, so a swipe never traps the page.
        touches={{ TWO: TOUCH.ROTATE }}
      />

      <points>
        <bufferGeometry ref={motesGeom}>
          <bufferAttribute
            args={[scratch.motePositions, 3]}
            attach="attributes-position"
          />
        </bufferGeometry>
        <pointsMaterial
          color={MOTE_COLOR}
          depthWrite={false}
          fog
          opacity={0.16}
          ref={motesMat}
          size={0.55}
          sizeAttenuation
          transparent
        />
      </points>

      <mesh frustumCulled={false}>
        <bufferGeometry ref={tubeGeom}>
          <bufferAttribute
            args={[scratch.tubePositions, 3]}
            attach="attributes-position"
          />
          <bufferAttribute args={[scratch.tubeIndex, 1]} attach="index" />
        </bufferGeometry>
        <meshBasicMaterial
          blending={AdditiveBlending}
          color={accent}
          depthWrite={false}
          fog
          opacity={0.3}
          ref={tubeMat}
          side={DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>

      <group ref={cometGroup} visible={false}>
        <mesh frustumCulled={false}>
          <bufferGeometry ref={cometTrailGeom}>
            <bufferAttribute
              args={[scratch.cometPositions, 3]}
              attach="attributes-position"
            />
            <bufferAttribute
              args={[scratch.cometColors, 3]}
              attach="attributes-color"
            />
            <bufferAttribute args={[scratch.cometIndex, 1]} attach="index" />
          </bufferGeometry>
          <meshBasicMaterial
            blending={AdditiveBlending}
            depthWrite={false}
            ref={cometTrailMat}
            side={DoubleSide}
            toneMapped={false}
            transparent
            vertexColors
          />
        </mesh>
        <mesh ref={cometHead}>
          <sphereGeometry args={[0.7, 14, 14]} />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color={accent}
            depthWrite={false}
            ref={cometHeadMat}
            toneMapped={false}
            transparent
          />
        </mesh>
      </group>

      <EffectComposer>
        <Bloom
          intensity={0.5}
          kernelSize={KernelSize.LARGE}
          luminanceSmoothing={0.7}
          luminanceThreshold={0.15}
          mipmapBlur
          ref={bloom}
        />
      </EffectComposer>
    </>
  );
}

export default function AttractorScene({
  accent,
  active,
  controller,
  data,
  onContextLost,
}: CanvasProps) {
  const handleCreated = ({ gl }: { gl: WebGLRenderer }) => {
    gl.domElement.addEventListener(
      "webglcontextlost",
      (event) => {
        // A lost context (GPU switch, driver reset, OOM) is a DOM event, not a
        // React error — the SceneBoundary never sees it. Fall to the static tier.
        event.preventDefault();
        onContextLost();
      },
      { once: true }
    );
  };

  return (
    <Canvas
      camera={{ position: [0, 4, 72], fov: 38, near: 0.1, far: 220 }}
      className={styles.sceneCanvas}
      dpr={[1, 1.75]}
      // Pause rendering while the finale is off-screen (the perpetual comet/bloom
      // must not burn frames the visitor cannot see).
      frameloop={active ? "always" : "never"}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      onCreated={handleCreated}
      // One-finger gestures scroll the page; orbit is two-finger (OrbitControls).
      style={{ touchAction: "pan-y" }}
    >
      <SceneContents accent={accent} controller={controller} data={data} />
    </Canvas>
  );
}
