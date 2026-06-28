"use client";

// GlassVessel — a single piece of work under CSS-faked glass.
//
// Purely presentational: it never navigates and it owns no lit state. The
// browsable links to the work live in the proof grid below the hero, so the
// vitrine stays a calm display case, not a wall of outbound links. Glass is a
// frame (rim light, gloss sweep, specular, inner shadow), never a lens that
// distorts the media beneath it.
//
// The vessel only ever earns color, and a single coordinator (VitrineStage)
// decides which one is lit at a time and writes the root `--live-accent`. The
// vessel just reports intent and reflects the `active` flag:
//   - "hover" (fine pointer): hover / keyboard focus reports activation, leave /
//     blur reports release; the lit look is CSS-driven (:hover / :focus-visible)
//     and transient.
//   - "tap" (coarse pointer): finger touch has no hover, so a tap reports
//     activation and the coordinator keeps `active` set (a tap outside dismisses).
//     The FIRST tap just selects (its bloom + sweep are the CSS activation).
//     Re-tapping the already-lit vessel replays a soft, springy press + gloss so it
//     still feels alive without ever toggling off. A hovering stylus is the one
//     exception: a pen (Apple Pencil / S Pen) hovering above the glass is treated
//     exactly like a mouse hover (see pen-hover.ts), lighting the vessel on enter
//     and clearing it on leave — finger touch still taps.

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useRef,
} from "react";
import type { Motif } from "~/content";
import { haptic } from "~/lib/haptic";
import { isPenHover } from "./pen-hover";
import { ProjectMedia } from "./project-media";

/** Orbs flatter ambient art; rects keep rectangular app UIs legible. */
export type VesselShape = "orb" | "rect";

/** How the vessel earns its lit state: hover/focus, or an explicit tap. */
export type VesselInteraction = "hover" | "tap";

/** The minimum a vessel needs: identity, earned accent, and its media. */
export interface PlaneSubject {
  accent: string;
  key: string;
  label: string;
  motif: Motif;
}

// A soft tactile press, derived from real spring physics rather than a hand-drawn
// curve: the underdamped impulse response of a damped harmonic oscillator,
//   d(t) = -A · e^(-ζω·t) · sin(ω_d·t),   ω_d = ω · √(1 - ζ²),
// sampled into keyframes (CSS has no native spring). It starts and ends exactly
// at rest (scale 1), dips a little under the finger, and settles back with one
// gentle, decaying overshoot. Softer = small amplitude + heavier damping; these
// numbers give roughly a 2% dip and a sub-1% overshoot.
function dampedPress(): Keyframe[] {
  const amplitude = 0.05; // peak displacement (a soft ~2% dip after the envelope)
  const zeta = 0.62; // damping ratio (higher = softer, fewer bounces)
  const omega = 6; // angular frequency over the normalized duration
  const samples = 24;
  const omegaD = omega * Math.sqrt(1 - zeta * zeta);
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples;
    const displacement =
      i === samples
        ? 0
        : -amplitude * Math.exp(-zeta * omega * t) * Math.sin(omegaD * t);
    return { offset: t, transform: `scale(${(1 + displacement).toFixed(4)})` };
  });
}

const SPRING_PRESS: Keyframe[] = dampedPress();
const SPRING_MS = 560;

const SWEEP: Keyframe[] = [
  { transform: "translateX(-130%)" },
  { transform: "translateX(130%)" },
];
const SWEEP_MS = 850;

// A soft confirm buzz on every tap (Android only; silent on iOS; off under
// reduced motion — see ~/lib/haptic). Short, on the order of the scroll-snap
// settle, so the vessel feels touched without buzzing like an alert.
const TAP_BUZZ_MS = 10;

export function GlassVessel({
  subject,
  shape,
  depth,
  active = false,
  interaction = "hover",
  onActivate,
  onDeactivate,
}: {
  subject: PlaneSubject;
  shape: VesselShape;
  /** Depth-of-field layer: 1 = near/sharp, 3 = far/blurred. */
  depth: 1 | 2 | 3;
  /** Whether this is the coordinator's single lit vessel (drives the loud CSS). */
  active?: boolean;
  /** Lighting trigger: hover/focus, or an explicit tap (default hover). */
  interaction?: VesselInteraction;
  /** Activation intent (hover-enter / focus, or tap), reported with this key. */
  onActivate?: (key: string) => void;
  /** Release intent (hover-leave / blur); unused in tap mode. */
  onDeactivate?: () => void;
}) {
  const tap = interaction === "tap";
  const surfaceRef = useRef<HTMLSpanElement>(null);
  const sweepRef = useRef<HTMLSpanElement>(null);

  const activate = () => onActivate?.(subject.key);
  const deactivate = () => onDeactivate?.();

  // A hovering stylus reads as a mouse hover in BOTH modes: a fine pointer always
  // lights (mouse / trackpad, as before), and in tap mode only a pen hover passes
  // the gate — finger touch never does, so it stays a tap and the coarse
  // sticky-hover glitch the gating kills stays killed.
  const handlePointerEnter = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!tap || isPenHover(event)) {
      activate();
    }
  };
  const handlePointerLeave = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!tap || isPenHover(event)) {
      deactivate();
    }
  };

  // A tap always (re)activates and always gives a soft confirm buzz; the
  // coordinator never toggles off. The spring is a re-tap reward only: the first
  // tap just selects (the CSS activation handles its bloom + sweep), so we only
  // play the press + replay the gloss when this vessel is already the lit one.
  // Reduced-motion skips both the buzz (inside haptic) and the motion.
  const handleTap = () => {
    activate();
    haptic(TAP_BUZZ_MS);
    if (
      !active ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    surfaceRef.current?.animate(SPRING_PRESS, {
      duration: SPRING_MS,
      easing: "linear",
    });
    sweepRef.current?.animate(SWEEP, { duration: SWEEP_MS, easing: "ease" });
  };

  const vesselStyle = { "--accent": subject.accent } as CSSProperties;

  // A button in both modes (the vessel never navigates). On a fine pointer it
  // reports hover/focus and the lit look is CSS-driven; on a coarse pointer a
  // tap reports activation, springs on re-tap, and the coordinator keeps `active`.
  return (
    <button
      aria-label={tap ? subject.label : `Focus ${subject.label}`}
      className={`vessel vessel--${shape}`}
      data-active={active}
      data-depth={depth}
      onBlur={tap ? undefined : deactivate}
      onClick={tap ? handleTap : undefined}
      onFocus={tap ? undefined : activate}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      style={vesselStyle}
      type="button"
    >
      <span className="vessel__surface" ref={surfaceRef}>
        <ProjectMedia motif={subject.motif} />
        <span className="vessel__glass" />
        <span className="vessel__sweep" ref={sweepRef} />
      </span>
      <span className="vessel__tag">{subject.label}</span>
    </button>
  );
}
