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
//   - observation motes pop in one by one, in a building crescendo (a few, then a
//     flurry), as faint cool-white points — assembling the scattered noisy-data
//     cloud the net will fit (they do not fall in: each springs to size at its own
//     moment, then the fit begins);
//   - the learned field is a glowing accent tube that uncurls across the replayed
//     snapshots and snaps into the both-lobed butterfly — fast off the tangled
//     stub, then decelerating to rest on the settled butterfly;
//   - additive bloom swells to a peak at convergence, then eases back;
//   - a comet then traces the converged attractor forever (a fading additive tail);
//   - drag orbits the genuinely-3D object; depth fog dims the far lobe.
//
// The same timeline also conducts the DOM console's entrance: stepTiming writes
// `controlReveal` then `gaugeReveal` onto the controller, and the Scrubber + Hud
// (separate rAF readers outside the Canvas) fade in off those — the progress bar
// as the cloud assembles, the parameters + loss a beat later. The console is not
// rendered here; the scene only conducts when it arrives.

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
const INTRO_MS = 2200; // motes pop in — a few, then a flurry (see MOTE_CRESCENDO)
const HOLD_MS = 400; // a beat on the assembled noisy cloud
const PLAY_MS = 7400; // uncurl 0 -> 1, fast off the tangle then easing to rest
const PEAK_DECAY_MS = 1500; // bloom eases back after convergence
// Staged entrance of the DOM console (the progress bar, then the gauges). The HUD
// does not arrive with the canvas: it fades in as a beat once the data cloud has
// assembled, so the instrument reads as powering on rather than appearing whole.
const CONSOLE_FADE_MS = 750; // the per-element fade-in span
// The progress bar LEADS: it fades in as the cloud finishes assembling, so the
// (empty) bar is in place, ready to fill, as the uncurl begins.
const CONTROL_IN_MS = INTRO_MS - 300;
// The parameters + loss gauges FOLLOW a beat later — they light up just as the
// training (and so their settling values) begins, arriving already alive.
const GAUGE_IN_MS = INTRO_MS + 450;
// Clamp the per-frame timeline step, so a pause (off-screen frame loop) or a
// throttled background tab never makes the autoplay leap on resume.
const MAX_FRAME_MS = 50;

const FOG_COLOR = "#05060c";
const FOG_NEAR = 48;
const FOG_FAR = 108;
const MOTE_COLOR = "#c7d2e8";
const MOTE_OPACITY = 0.5;
// Each mote pops in over this fraction of the intro reveal, and overshoots its
// size by this much at the top of the spring — so the cloud assembles point by
// point rather than fading or falling in.
const POP_SPAN = 0.22;
const POP_OVERSHOOT = 1.3;
// Back-loads the mote spawn: with this > 1 the cloud opens sparse — a few lonely
// points — then accelerates into a flurry, rather than a steady, uniform drizzle.
const MOTE_CRESCENDO = 2.2;
// Steepness of the uncurl's deceleration (the ease-out power). Higher = a harder
// initial kick (so the briefly-ugly tangle settling inside the cloud is over fast)
// and a longer, gentler glide to rest as the butterfly settles.
const CONVERGE_DECEL = 2.6;
const CONVERGED = 0.999;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// easeOutBack: 0 at t=0, overshoots just past 1, then settles back to 1 — the
// little spring that makes a mote pop into place.
const easeOutBack = (t: number): number => {
  const c3 = POP_OVERSHOOT + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + POP_OVERSHOOT * u * u;
};
// convergeEase: the uncurl's pacing, 0 at t=0 to 1 at t=1. An ease-out (fastest
// at the start, decelerating to a standstill) — NOT the old symmetric smoothstep,
// whose slow-in dwelt on the tangled epoch-0 stub. Paired with the settle remap
// (progress 1 -> the settled butterfly), the long slow tail lands on the butterfly
// coming to rest, not on the visually-frozen final frames.
const convergeEase = (t: number): number =>
  1 - (1 - clamp01(t)) ** CONVERGE_DECEL;

// PointsMaterial sizes every point from one `size` uniform, so per-mote popping
// needs a per-vertex multiplier: patch the vertex shader to scale gl_PointSize by
// an `aPop` attribute (0 = not yet popped, so the point is zero-size / invisible).
function patchMotePop(shader: { vertexShader: string }): void {
  shader.vertexShader = shader.vertexShader
    .replace("void main() {", "attribute float aPop;\nvoid main() {")
    .replace("gl_PointSize = size;", "gl_PointSize = size * aPop;");
}
const moteCacheKey = (): string => "mote-pop";

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
  /** Per-mote size multiplier, 0 -> ~1, written each frame as motes pop in. */
  readonly motePop: Float32Array;
  /** Per-mote reveal threshold (random) — when in [0,1] that mote starts popping. */
  readonly motePopStart: Float32Array;
  readonly motePositions: Float32Array;
  readonly tubeIndex: Uint16Array;
  readonly tubePositions: Float32Array;
  readonly workLine: Float32Array;
}

interface Clock {
  convergedAt: number;
  /** Active-time accumulator (ms) — advances only on rendered frames. */
  elapsed: number;
}

/** Advance the once-on-view timeline: motes pop in, then autoplay the training.
 *  Driven by accumulated frame time (not wall-clock), so pausing the frame loop
 *  off-screen freezes the beat rather than skipping it. */
function stepTiming(controller: FinaleController, clock: Clock, dtMs: number) {
  if (controller.userScrubbing) {
    return;
  }
  clock.elapsed += Math.min(dtMs, MAX_FRAME_MS);
  const elapsed = clock.elapsed;
  controller.reveal = smoothstep(0, INTRO_MS, elapsed);
  // The console enters as a staged beat after the cloud: the progress bar first,
  // the parameters + loss gauges a beat later (their readers fade to these).
  controller.controlReveal = smoothstep(
    CONTROL_IN_MS,
    CONTROL_IN_MS + CONSOLE_FADE_MS,
    elapsed
  );
  controller.gaugeReveal = smoothstep(
    GAUGE_IN_MS,
    GAUGE_IN_MS + CONSOLE_FADE_MS,
    elapsed
  );
  if (controller.autoplayActive) {
    const playElapsed = elapsed - INTRO_MS - HOLD_MS;
    if (playElapsed > 0) {
      const raw = clamp01(playElapsed / PLAY_MS);
      controller.progress = convergeEase(raw);
      if (raw >= 1) {
        controller.autoplayActive = false;
      }
    }
  }
}

/** Pop the observation motes in at their scattered positions, in a building
 *  crescendo (sparse, then a flurry), to assemble the noisy data cloud — each
 *  springs to full size (a small overshoot) at its own threshold; none fall in.
 *  Driven by `reveal` (0 -> 1), so every mote has finished popping before the
 *  field tube's approximation begins. */
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
  for (let k = 0; k < data.moteCount; k++) {
    const local = clamp01((reveal - s.motePopStart[k]) / POP_SPAN);
    s.motePop[k] = Math.max(0, easeOutBack(local));
  }
  geom.attributes.aPop.needsUpdate = true;
  mat.opacity = MOTE_OPACITY;
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
  // The glow grows through the back half of the uncurl and crests as the butterfly
  // settles — because the morph decelerates onto its rest here, the rising light
  // (not motion) carries the final beat, so the slow finish reads as arrival.
  const baseGlow = 0.4 + 1.25 * smoothstep(0.4, 1, progress);
  const peak =
    clock.convergedAt < 0
      ? 0
      : 1.3 * Math.exp(-(now - clock.convergedAt) / PEAK_DECAY_MS);
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
    motePop: new Float32Array(data.moteCount),
    motePopStart: Float32Array.from(
      { length: data.moteCount },
      // 1 - (1 - u)^MOTE_CRESCENDO biases the thresholds toward late: most motes
      // pop near the end of the reveal (the flurry), a few open it (the stragglers
      // — so the frame is never dead), giving the cloud an accelerating crescendo.
      () => (1 - (1 - Math.random()) ** MOTE_CRESCENDO) * (1 - POP_SPAN)
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
          <bufferAttribute
            args={[scratch.motePop, 1]}
            attach="attributes-aPop"
          />
        </bufferGeometry>
        <pointsMaterial
          color={MOTE_COLOR}
          customProgramCacheKey={moteCacheKey}
          depthWrite={false}
          fog
          onBeforeCompile={patchMotePop}
          opacity={MOTE_OPACITY}
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
