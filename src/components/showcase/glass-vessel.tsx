"use client";

// GlassVessel — a single piece of work under CSS-faked glass.
//
// Hover, keyboard focus, and touch tap all travel the same earned-color path:
// focusing the vessel blooms its accent onto the root's `--live-accent` (via
// useAccent) and locally lights its own glass. Glass is a frame (rim light,
// gloss sweep, specular, inner shadow), never a lens that distorts the media
// beneath it.
//
// The vessel is polymorphic over its job. Given an `href` it renders an `<a>`
// that navigates to the work (the hero's contact-sheet planes link to their
// repos, the same cross-origin destination the proof cards use); without one it
// is a `<button>` that only earns color. Either element is natively focusable,
// so the keyboard path is identical.

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
  href,
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
  /** When set, the vessel navigates here (an `<a>`); otherwise it is a `<button>`. */
  href?: string;
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

  const className = `vessel vessel--${shape}`;
  const vesselStyle = { ...style, "--accent": subject.accent } as CSSProperties;
  const inner = (
    <>
      <span className="vessel__surface">
        <ProjectMedia motif={subject.motif} />
        <span className="vessel__glass" />
        <span className="vessel__sweep" />
      </span>
      <span className="vessel__tag">{subject.label}</span>
    </>
  );

  // A link when the vessel navigates to its work, a button when it only earns
  // color. Same classes, data-attributes, and focus/hover handlers either way.
  if (href) {
    return (
      <a
        aria-label={subject.label}
        className={className}
        data-active={active}
        data-depth={depth}
        href={href}
        onBlur={onLeave}
        onFocus={onEnter}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
        rel="noreferrer"
        style={vesselStyle}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      aria-label={`Focus ${subject.label}`}
      className={className}
      data-active={active}
      data-depth={depth}
      onBlur={onLeave}
      onFocus={onEnter}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      style={vesselStyle}
      type="button"
    >
      {inner}
    </button>
  );
}
