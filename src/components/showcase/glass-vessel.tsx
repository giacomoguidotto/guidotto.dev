"use client";

// GlassVessel — a single piece of work under CSS-faked glass.
//
// The vessel is a `<button>` so hover, keyboard focus, and touch tap all travel
// the same earned-color path: focusing it blooms its accent onto the root's
// `--live-accent` (via useAccent) and locally lights its own glass. Glass is a
// frame (rim light, gloss sweep, specular, inner shadow), never a lens that
// distorts the media beneath it.

import { type CSSProperties, useCallback } from "react";
import type { Motif } from "~/content";
import { ProjectMedia } from "./project-media";
import { useAccent } from "./showcase-root";

/** Orbs flatter ambient art; rects keep rectangular app UIs legible. */
export type VesselShape = "orb" | "rect";

/** The minimum a vessel needs: identity, earned accent, and its media. */
export interface PlaneSubject {
  accent: string;
  key: string;
  label: string;
  motif: Motif;
}

export function GlassVessel({
  subject,
  shape,
  depth,
  active = false,
  manageAccent = true,
  onActivate,
  style,
}: {
  subject: PlaneSubject;
  shape: VesselShape;
  /** Depth-of-field layer: 1 = near/sharp, 3 = far/blurred. */
  depth: 1 | 2 | 3;
  /** Force the focused (bloomed) state regardless of pointer. */
  active?: boolean;
  /** Whether focusing this vessel writes the root accent (default true). */
  manageAccent?: boolean;
  onActivate?: () => void;
  style?: CSSProperties;
}) {
  const accent = useAccent();

  const onEnter = useCallback(() => {
    if (manageAccent) {
      accent.set(subject.accent);
    }
    onActivate?.();
  }, [accent, manageAccent, onActivate, subject.accent]);

  const onLeave = useCallback(() => {
    if (manageAccent) {
      accent.clear();
    }
  }, [accent, manageAccent]);

  return (
    <button
      aria-label={`Focus ${subject.label}`}
      className={`vessel vessel--${shape}`}
      data-active={active}
      data-depth={depth}
      onBlur={onLeave}
      onFocus={onEnter}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      style={{ ...style, "--accent": subject.accent } as CSSProperties}
      type="button"
    >
      <span className="vessel__surface">
        <ProjectMedia motif={subject.motif} />
        <span className="vessel__glass" />
        <span className="vessel__sweep" />
      </span>
      <span className="vessel__tag">{subject.label}</span>
    </button>
  );
}
