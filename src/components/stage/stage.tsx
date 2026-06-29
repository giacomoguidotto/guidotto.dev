"use client";

// Stage — the scroll choreography that ties the hero contact sheet and the proof
// grid into one continuous scroll story (Option C: the showpiece is excluded from
// the grid).
//
// Deep module: <Stage /> is the entire interface. Behind it sit three
// presentations and one physics:
//
//   - PLAIN (the default, and what reduced-motion / no-JS / a 40-48rem fine pointer
//     always get): the verified <Hero /> then <ProofGrid /> as two stacked sections.
//     Server-rendered, indexable, fully legible. This is also the SSR + first-client
//     render, so there is never a hydration mismatch; the morph is layered on only
//     after mount, and only where welcome.
//
//   - MOTION (a progressive enhancement on motion-welcome fine pointers wide enough
//     for the 2x2): the SINGLE-DOM-NODE handoff. Each project is ONE <a> (a
//     ProjectTile) that is the vitrine vessel at rest and becomes the proof card once
//     landed — never two elements that cross-fade (see CONTEXT -> "Decision
//     (2026-06-25): one DOM node per project").
//
//   - MOBILE (the portrait twin of MOTION, on motion-welcome viewports <= 40rem, any
//     pointer): a portrait scroll-handoff FLIP morph that feeds the page-flow
//     center-focus carousel (issue #27, Part C). It is a SEPARATE component
//     (<MobileMotionStage />) so the desktop MotionStage stays byte-for-byte
//     untouched. Built incrementally: the portrait CONTACT SHEET at rest (showpiece
//     + Orray + Tempo in the tile path, with the hero's tap/hover lighting) is live
//     now (#27 C.2); it sits above the page-flow carousel and does NOT yet morph. The
//     rigs + portrait FLIP, the single lit coordinator across the seam, and the chrome
//     hand-off grow into it in the later slices (#27 C.3-C.5), at which point the
//     contact-sheet tiles become the carousel cards (one DOM node) the way the desktop
//     peers are their grid cells.
//
// THE FIVE VESSELS ARE UNIFORM. Every tile — the four peers AND the AnyPINN
// showpiece — is one Rig with a SOURCE (its vitrine scatter point + size) and a
// TARGET (where it lands), and is driven by the SAME `drive()`. A single
// scroll-progress --p lerps each tile from source to target (transform + opacity
// only), clears its depth blur soft -> sharp, and assembles its caption in:
//   - the four peers target their own grid cell (source = vitrine, target = grid),
//     and resolve into navigable proof cards;
//   - the showpiece targets the curatorial set-aside, off-screen below the pin (its
//     DOM home IS the contact sheet, so source = home and it simply slides off). When
//     the finale (#9) is present below the grid, that set-aside is AIMED at the
//     finale's landing slot — it shrinks and drifts to the slot before sliding off,
//     and the finale parks the AnyPINN vessel there, so all five vessels end in place.
//
// AT REST IT IS THE HERO, 1:1. A peer's grid cell is larger than its vitrine
// scatter slot, so at rest the tile is FLIP-scaled down — and `filter: blur()` and
// `border-radius` live in the element's local space, so a naive radius/blur would
// be shrunk by that scale (the "blur too soft / corners too tight" regressions).
// `drive()` therefore COMPENSATES: it divides the blur radius and the corner radius
// by the live scale, so the on-screen blur is exactly the hero's per-depth radius
// and the corner is exactly the hero's 1.4rem. The showpiece sits at natural size
// (scale 1), so the same formula is a no-op for it — one rule, five consistent
// vessels. At rest the tiles are also hover-reactive exactly like the hero vessels
// (a hovered/focused tile clears its blur, lifts, blooms its accent, and washes the
// field), driven through the same coordinator that lights the resolved grid.
//
// The morph is transform / opacity / filter only (GPU-composited, zero reflow),
// driven imperatively so there is no per-frame React work.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Hero } from "~/components/hero";
import { ProofGrid } from "~/components/proof-grid/proof-grid";
import proofStyles from "~/components/proof-grid/proof-grid.module.css";
import { startGyroTilt } from "~/components/showcase/gyro-tilt";
import { ShowcaseRoot } from "~/components/showcase/showcase-root";
import { content, type Project } from "~/content";
import { haptic } from "~/lib/haptic";
import { ProjectTile, type TileModel } from "./project-tile";
import styles from "./stage.module.css";

type Mode = "plain" | "motion" | "mobile";
type Phase = "rest" | "flight" | "live";

// The desktop morph is enhancement-only: it needs a fine pointer (to read the
// contact sheet), motion permission, and enough width for the 2x2 (above the grid's
// own 40rem carousel switch, so the two layouts never fight).
const MOTION_QUERY =
  "(pointer: fine) and (prefers-reduced-motion: no-preference) and (min-width: 48rem)";

// The portrait morph (#27 Part C) takes the narrow band the desktop morph leaves to
// the carousel: motion-welcome viewports <= 40rem, ANY pointer (a phone, or a narrow
// fine-pointer window). It matches the grid's own MOBILE_QUERY (proof-grid.tsx) so
// the portrait morph and the page-flow carousel it feeds switch on at the same width.
// The 40-48rem gap (a fine pointer too narrow for the 2x2 but wider than a phone)
// matches NEITHER query and falls back to PLAIN, as does reduced-motion / no-JS.
const MOBILE_MOTION_QUERY =
  "(prefers-reduced-motion: no-preference) and (max-width: 40rem)";

// The morph completes over the first MORPH_END of the one-viewport pin; the rest is
// a hold where the resolved grid reads as a normal grid before the page continues.
const MORPH_END = 0.8;
// At/below this progress the tiles are the live, interactive hero contact sheet;
// the first whiff of scroll hands interaction to the resolving grid.
const HERO_REST = 0.02;
// Above this progress the resolved cards are navigable / focusable.
const RESOLVE_AT = 0.85;
// The positional morph fills the WHOLE pinned distance: each tile finishes landing
// exactly as the sticky pin releases, so there is no "looks done but keep scrolling"
// dead tail. The earlier morph completed its easing at ~0.72 of the pin, leaving the
// last ~0.28 (≈22% of a viewport) as a hold where the grid read as done but the page
// was still pinned — the "you're at .9, scroll a bit more" dangle. Filling the pin
// removes that: the smoothstep's hard ease-out near the end reads as a settle without
// any static hold, and the morph stays in motion right up to the release into normal
// scroll. Pull this below 1 to trade a sliver of pre-release hold for a snappier morph.
const MORPH_LANDING = 1;

// Both the hero vessel and the proof card use a 1.4rem corner: it is CONSTANT
// across the morph (the earlier "rounder vitrine radius" is dropped so rest matches
// the hero 1:1). The on-screen value is kept here while `drive()` compensates for
// the FLIP scale so the rasterised corner never shrinks.
const RADIUS_REM = 1.4;
// The hero's :hover / :focus scale bump, applied to a lit at-rest tile.
const HOVER_SCALE = 1.04;

// The hero's floating name tag (its .vessel__tag): a small mono label that fades in
// under a lit vessel at rest. Like the blur + corner, its font size and offset live
// in the poster's local space, so the stage divides them by the live FLIP scale so
// the on-screen tag is exactly the hero's (0.6rem, 1.9rem below the vessel).
const TAG_FONT_REM = 0.6;
const TAG_OFFSET_REM = 1.9;
const TAG_LIT_OPACITY = 0.95;

const clamp = (value: number, lo: number, hi: number): number =>
  Math.min(Math.max(value, lo), hi);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// Smooth (ease-in-out) ramp between two edges; the whole choreography is phrased as
// overlapping smoothsteps on --p so there is no piecewise CSS and no jerk.
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const TWO_PI = Math.PI * 2;

// The handoff "dance" envelope (see the DANCE block below). A bounded deviation that
// each vessel rides OFF its straight FLIP line and back. It is gated by `m` (the same
// eased morph parameter `drive()` uses), so it is a pure function of scroll progress —
// it scrubs forwards/backwards with the scrollbar and never drifts on a clock.
// Crucially it is ZERO at both ends and lands with ZERO velocity (the `(1 - m)` taper),
// so the morph still settles on the EXACT FLIP target with no snap and the timing
// window is unchanged — the path bends, the budget does not. Single hump early, then a
// long calm settle: dance first, arrive composed.
const danceEnv = (m: number): number => Math.sin(Math.PI * m) * (1 - m);

// ---- the vitrine contact sheet placement (the hero's own scatter) ----

interface VitrinePlacement {
  /** Depth-of-field layer: 1 = near/sharp, 3 = far/blurred. */
  readonly depth: 1 | 2 | 3;
  /** Fixed vessel width in rem (clamped against 40vw, exactly like the hero). */
  readonly w: number;
  /** Centre position as a fraction of the pinned field. */
  readonly x: number;
  readonly y: number;
}

// The same scatter the hero uses: two flanking clusters that leave a central band
// clear for the thesis. The showpiece (anypinn) is present in the sheet but never
// joins the grid.
const VITRINE: Record<string, VitrinePlacement> = {
  anypinn: { depth: 2, x: 0.24, y: 0.33, w: 16.5 },
  orray: { depth: 1, x: 0.23, y: 0.69, w: 15 },
  scry: { depth: 2, x: 0.74, y: 0.27, w: 16.5 },
  tempo: { depth: 3, x: 0.73, y: 0.67, w: 15 },
  ginevra: { depth: 3, x: 0.5, y: 0.16, w: 12.5 },
};

// Depth -> the hero's own depth-of-field values: the static blur radius (px), the
// recede opacity, and the per-depth scale the hero applies via `--scale`. The blur
// is the on-screen radius `drive()` reproduces (compensated for the FLIP scale); the
// scale is folded into the source size so a far vessel sits at the hero's size.
const DEPTH_BLUR: Record<1 | 2 | 3, number> = { 1: 1.5, 2: 4, 3: 8 };
const DEPTH_OPACITY: Record<1 | 2 | 3, number> = { 1: 0.9, 2: 0.74, 3: 0.52 };
const DEPTH_SCALE: Record<1 | 2 | 3, number> = { 1: 1, 2: 0.97, 3: 0.92 };

// Depth -> the hero's own per-depth PARALLAX FACTOR (px): the same `--pf` the hero's
// .vessel reads (globals.css), so the rest contact sheet sways with the pointer / gyro
// exactly like the standalone hero — near vessels (depth 1) travel more than far ones
// (depth 3). `drive()` multiplies the field offset by this and fades it out as the
// morph leaves rest, so the sway is a rest-only echo of the hero and never fights the
// FLIP flight.
const DEPTH_PF: Record<1 | 2 | 3, number> = { 1: 26, 2: 16, 3: 8 };

// ---- the handoff choreography (the "dance") ----
//
// Each vessel still FLIPs from its vitrine source to its landing target, but instead
// of sliding the straight line between them it takes a curved excursion that returns
// to the exact target (the deviation is enveloped to zero — see `danceEnv`). The shape
// is read in each vessel's own frame: a unit vector `u` that points from its source
// toward the point it is ATTRACTED to (only the DIRECTION matters — the magnitude is
// normalised away), with `v = perp(u)` the swirl axis. For orbit angle
// `a = spin * 2π * m`, the deviation is `amp·env·(cos a · u + sin a · v)`:
//   - spin 0   -> a == 0 -> a pure BOW that bulges along `u` and eases straight back;
//   - small ±spin -> the bulge starts along `u` then curls a quarter-ish turn toward
//     `v` as it grows — a directional HOOK ("out, then bank");
//   - spin ±1  -> a full pirouette (the offset rotates away from `u` early, so the
//     lean reads weakly — avoid it when the START direction must be legible).
//
// The choreography (initial direction is what the eye locks onto, so each is aimed
// explicitly rather than at a shared centre):
//   - ginevra + scry are the upper pair: they SCISSOR. ginevra swings right and dips,
//     scry swings left and lifts, so the two cross through each other before peeling
//     off to their cells. Big amp so they actually overlap, not just lean.
//   - orray + tempo are the lower pair: each throws a visible HOOK inward-and-up —
//     orray out to the right then banking up, tempo out to the left then banking up.
// (The showpiece weaves its own S on the way out — handled in `danceDelta`.)
//
// Amplitudes are a fraction of the pinned field WIDTH (responsive + tunable by eye, and
// crossing scales with the layout); `attract` is a point in the pinned field (fraction)
// — only its direction from the vessel matters.

interface DanceRole {
  /** Peak deviation off the straight FLIP line, as a fraction of the field width. */
  readonly amp: number;
  /** A point in the pinned field (fraction); only its DIRECTION from the vessel is used. */
  readonly attract: { readonly x: number; readonly y: number };
  /** Signed orbit turns over the morph: 0 = a pure bow, small ± = a directional hook. */
  readonly spin: number;
}

// Keyed by project key (the four peers; the showpiece dances by a separate rule).
const DANCE: Record<string, DanceRole> = {
  // The upper pair scissor through each other: ginevra heads right and dips, scry heads
  // left and lifts. Same-row attract points keep the start near-horizontal; the +spin
  // banks ginevra down and scry up so they cross in the middle. Amp ~0.3·field so the
  // two horizontal reaches together exceed their 0.24·field gap and the centres pass.
  ginevra: { amp: 0.32, spin: 0.35, attract: { x: 1, y: 0.16 } },
  scry: { amp: 0.32, spin: 0.35, attract: { x: 0, y: 0.27 } },
  // The lower pair hook inward-and-up: orray right-then-up (−spin banks up), tempo
  // left-then-up (+spin banks up, mirrored because its `u` points the other way).
  orray: { amp: 0.12, spin: -0.4, attract: { x: 1, y: 0.69 } },
  tempo: { amp: 0.12, spin: 0.4, attract: { x: 0, y: 0.67 } },
};

// The showpiece's set-aside weaves a single, wide, time-lopsided S on its way out: one
// long first bow swings it ACROSS to the far side of the viewport, then it sweeps back
// THROUGH centre (without pausing) into a short, small overshoot the other way before
// settling as it aims below the pinned viewport. It is ONE continuous gesture, not two:
// a sine over a WARPED clock crosses the centreline exactly once, at SHOW_SPLIT, and the
// `(1 - m)` taper both shrinks the overshoot and lands it velocity-free (pixel-true).
// Tunable by eye:
//   - SHOW_SWAY_VW  nominal reach of the first bow, as a fraction of viewport width;
//   - SHOW_SPLIT    the morph point where the bow sweeps back through centre (> 0.5, so
//                   the first bow owns most of the time; raising it lengthens that bow).
const SHOW_SWAY_VW = 0.6;
// The PORTRAIT (#27 C.5) sway, smaller than the landscape 0.6. The desktop showpiece
// starts off to one side (VITRINE anypinn x≈0.24), so 0.6·vw traverses it the full width
// to the far side. The portrait showpiece starts horizontally CENTRED (MOBILE_SCATTER
// resolves AnyPINN to x≈0.5), so the SAME "sweep across to the far side" only needs to
// reach an edge — about half the traverse. At 0.6·vw a centred start flings AnyPINN fully
// off the narrow viewport at the bow's peak (it vanishes, then returns); 0.34·vw sweeps it
// to the far side and back while it stays on screen. Eyeball-tunable on a real phone.
const MOBILE_SHOW_SWAY_VW = 0.34;
const SHOW_SPLIT = 0.68;
// Time warp exponent: m**SHOW_WARP maps SHOW_SPLIT -> 0.5, so sin(2π·warp) has its sole
// interior zero (the centre sweep) at SHOW_SPLIT, with zero slope at m=0 (smooth start).
const SHOW_WARP = Math.log(0.5) / Math.log(SHOW_SPLIT);

const toPeerModel = (p: Project): TileModel => ({
  accent: p.accent,
  atRestLine: p.atRestLine,
  key: p.key,
  label: p.label,
  motif: p.motif,
  onFocus: p.onFocus,
  repoUrl: p.repoUrl,
  tag: p.tag,
});

const PEER_MODELS: TileModel[] = content.projects.map(toPeerModel);
const SHOWPIECE_MODEL: TileModel = {
  accent: content.showpiece.accent,
  key: content.showpiece.key,
  label: content.showpiece.label,
  motif: content.showpiece.motif,
  repoUrl: content.showpiece.repoUrl,
  showpiece: true,
};

// One tile measured for the morph. Every vessel — peer or showpiece — lerps a SOURCE
// (its vitrine scatter point + size) to a TARGET (where it lands), expressed as plain
// viewport-space offsets from the tile's own home box (srcD*/tgtD* + scales). This
// works for ALL five because during the morph BOTH frames are viewport-fixed:
//   - the showpiece's home is the viewport-pinned contact sheet (it never joins the
//     grid); its source is identity and its target carries it off below the viewport;
//   - the peers' home is their grid cell, and the grid is BROWSER-PINNED (position:
//     sticky) for the whole morph, so a cell sits at a constant viewport point too.
//     Their source is the vitrine scatter point. Because the cell is pinned by the
//     browser (not held by a JS scroll-compensating transform), the morph is a pure
//     function of progress with no scroll term — which is what removes the jitter.
// Once the morph completes the grid un-sticks and scrolls; the peers carry tgtD* = 0
// (identity), so they simply ride the flow to the grid's end.
interface Rig {
  readonly caption: HTMLElement | null;
  // The handoff dance, precomputed once per measure (see the DANCE block). `danceUx/Uy`
  // is the unit vector from this vessel's source toward the point it is attracted to;
  // `danceAmp` is the peak deviation in px; `danceSpin` is the signed orbit turn count
  // (0 = a pure bow). The showpiece reuses `danceAmp` as its S-curve sway and ignores
  // the rest. All four are enveloped to zero at m=1, so the FLIP target is untouched.
  readonly danceAmp: number;
  readonly danceSpin: number;
  readonly danceUx: number;
  readonly danceUy: number;
  readonly depthBlur: number;
  readonly depthOpacity: number;
  readonly el: HTMLElement;
  // The hero's per-depth field-parallax factor (px): `drive()` multiplies the live
  // pointer / gyro offset by this (faded out as the morph leaves rest) so the rest
  // contact sheet sways exactly like the standalone hero's .vessel.
  readonly pf: number;
  // The poster (data-poster) wears the depth blur + corner; both scale-compensated.
  readonly poster: HTMLElement;
  readonly showpiece: boolean;
  // Viewport-space source/target offsets from the tile's home box, and the FLIP scale.
  readonly srcDx: number;
  readonly srcDy: number;
  readonly srcScale: number;
  // The hero's floating name tag (rest-only), sized + offset against the live scale.
  readonly tag: HTMLElement | null;
  readonly tgtDx: number;
  readonly tgtDy: number;
  readonly tgtScale: number;
}

const child = (el: HTMLElement, selector: string): HTMLElement | null =>
  el.querySelector<HTMLElement>(selector);

const placementFor = (el: HTMLElement): VitrinePlacement | undefined => {
  const key = el.dataset.key;
  return key ? VITRINE[key] : undefined;
};

// The hero's vessel sizing: a fixed rem width clamped against 40vw, then taken down
// by the per-depth scale so a far vessel sits at exactly the hero's rendered size.
const vitrineWidth = (
  place: VitrinePlacement,
  rem: number,
  vw: number
): number => clamp(9 * rem, 0.4 * vw, place.w * rem) * DEPTH_SCALE[place.depth];

// Resolve a peer's dance basis from its DANCE role: the unit vector `u` pointing from
// its vitrine source toward the point it is attracted to (in viewport px, so the field
// fractions are scaled by the pin's own dimensions), its peak deviation in px, and its
// orbit turns. The amplitude is a fraction of the FIELD WIDTH (not rem): the gap between
// vessels is a fraction of the field, so a field-relative reach crosses the same on any
// width — a fixed-rem reach would fail to close the gap on wide screens. A keyless /
// unconfigured peer simply does not dance (amp 0).
const peerDance = (
  el: HTMLElement,
  place: VitrinePlacement,
  pinRect: DOMRect
): { ux: number; uy: number; amp: number; spin: number } => {
  const role = el.dataset.key ? DANCE[el.dataset.key] : undefined;
  if (!role) {
    return { ux: 0, uy: 0, amp: 0, spin: 0 };
  }
  const dx = (role.attract.x - place.x) * pinRect.width;
  const dy = (role.attract.y - place.y) * pinRect.height;
  const len = Math.hypot(dx, dy) || 1;
  return {
    ux: dx / len,
    uy: dy / len,
    amp: role.amp * pinRect.width,
    spin: role.spin,
  };
};

// Clear any prior transform, read the poster's untransformed rect, and pin the
// tile's transform-origin to the poster centre so every scale pivots there (so a
// translate is a pure position change). Returns the poster centre (viewport px) +
// width.
const anchorPoster = (
  el: HTMLElement,
  poster: HTMLElement
): { cx: number; cy: number; w: number } => {
  el.style.transform = "";
  el.style.opacity = "";
  const g = poster.getBoundingClientRect();
  const e = el.getBoundingClientRect();
  const cx = g.left + g.width / 2;
  const cy = g.top + g.height / 2;
  el.style.transformOrigin = `${(cx - e.left).toFixed(2)}px ${(cy - e.top).toFixed(2)}px`;
  return { cx, cy, w: g.width };
};

// Measure a peer tile at its grid-cell home and derive the viewport-fixed vitrine
// SOURCE it parks at; its target is its own cell (identity). The grid is browser-pinned
// (position: sticky; top: 0) for the whole morph, so the cell's viewport position is
// constant during the morph — we read it as the cell's offset INSIDE the grid
// container (`home.cy - gridTop`), which is the pinned viewport position and is robust
// to whatever scroll measure() happens to run at. Returns null for an unplaced key.
const buildPeerRig = (
  el: HTMLElement,
  pinRect: DOMRect,
  gridTop: number,
  rem: number,
  vw: number
): Rig | null => {
  const place = placementFor(el);
  const poster = child(el, "[data-poster]");
  if (!(place && poster)) {
    return null;
  }
  const home = anchorPoster(el, poster);
  // The grid is sticky-pinned at top: 0 during the morph, so the cell's pinned home is
  // its offset within the grid container (scroll-independent). Horizontally the grid
  // is not sticky, so home.cx is already its stable layout centre.
  const homeCx = home.cx;
  const homeCy = home.cy - gridTop;
  const vCx = pinRect.left + place.x * pinRect.width;
  // The pin is ALSO sticky-pinned at top: 0 during the morph, so the vitrine point's
  // pinned viewport-y is `place.y * pinRect.height` from that top: 0. Adding the LIVE
  // pinRect.top would lock the source to whatever scroll measure() runs at — wrong when
  // the page loads already scrolled (browser scroll restoration on reload) and the pin
  // has scrolled out of view (pinRect.top << 0), flinging the vessels off. Normalising
  // to the pinned top (like homeCy subtracts gridTop) makes srcDy scroll-independent.
  const vCy = place.y * pinRect.height;
  const vW = vitrineWidth(place, rem, vw);
  const dance = peerDance(el, place, pinRect);
  return {
    caption: child(el, "[data-caption]"),
    depthBlur: DEPTH_BLUR[place.depth],
    depthOpacity: DEPTH_OPACITY[place.depth],
    el,
    pf: DEPTH_PF[place.depth],
    poster,
    showpiece: false,
    srcDx: vCx - homeCx,
    srcDy: vCy - homeCy,
    srcScale: vW / home.w,
    tag: child(el, "[data-tag]"),
    tgtDx: 0,
    tgtDy: 0,
    tgtScale: 1,
    danceUx: dance.ux,
    danceUy: dance.uy,
    danceAmp: dance.amp,
    danceSpin: dance.spin,
  };
};

// Size + place the showpiece at its vitrine point at natural size (its DOM home IS
// the contact sheet), so SOURCE is identity and blur/corner never scale. It stays in
// the viewport-fixed pin (it never joins the grid) — so the morph is jitter-free.
//
// Its TARGET is the curatorial set-aside: it slides off below the pinned viewport as
// the grid resolves. When the finale (#9) is present below the grid, the set-aside is
// AIMED at the finale's landing slot — it shrinks to the slot's size and drifts to the
// slot's horizontal centre before sliding off, so the departing vessel reads as
// heading to its resting place. The finale parks the AnyPINN vessel at that slot, so
// once the handoff is over all five vessels are in place (four in the grid, this one
// small at the top-left of the attractor). With no finale present it simply slides
// straight down at natural size — the standalone set-aside (the finale must not depend
// on the loop). `landing` is the finale slot's viewport rect, or null when absent.
// `place` + `widthOverride` default to the DESKTOP read (placementFor / vitrineWidth)
// so the desktop MotionStage call is byte-for-byte unchanged. The portrait morph
// (#27 C.3) reuses this whole helper — the S-curve set-aside aimed at the finale, the
// scroll-stable target math — by passing its own CENTRE-fraction placement and an
// explicit width (the portrait vessel is sized in vw, not the desktop rem clamp).
const buildShowRig = (
  el: HTMLElement,
  pinRect: DOMRect,
  rem: number,
  vw: number,
  landing: DOMRect | null,
  place: VitrinePlacement | undefined = placementFor(el),
  widthOverride?: number,
  // The first-bow reach of the S-curve set-aside, as a fraction of viewport width.
  // Defaults to the landscape SHOW_SWAY_VW so the desktop call is byte-for-byte; the
  // portrait morph (#27 C.5) passes its own narrower MOBILE_SHOW_SWAY_VW.
  sway: number = SHOW_SWAY_VW
): Rig | null => {
  const poster = child(el, "[data-poster]");
  if (!(place && poster)) {
    return null;
  }
  const vW = widthOverride ?? vitrineWidth(place, rem, vw);
  // Home the poster centred on the vitrine point: left/top are the point minus half
  // the width, so no centring translate is needed and the morph translate is pure.
  el.style.position = "absolute";
  el.style.width = `${vW.toFixed(2)}px`;
  el.style.height = `${vW.toFixed(2)}px`;
  el.style.left = `${(place.x * pinRect.width - vW / 2).toFixed(2)}px`;
  el.style.top = `${(place.y * pinRect.height - vW / 2).toFixed(2)}px`;
  const home = anchorPoster(el, poster);
  // Default (no finale): straight down past the pin's bottom edge, at natural size.
  // With a finale present: shrink to the landing slot and aim at its horizontal
  // centre, then slide off below the pin toward it. The slot's width + x are
  // scroll-independent, so this stays robust whatever scroll measure() runs at; the
  // set-aside still lives in the viewport-fixed pin, so the morph stays jitter-free.
  // Guard the ratio: a not-yet-laid-out slot (zero width) or a degenerate home must
  // fall back to the natural-size set-aside, never a divide-by-zero scale (Infinity)
  // or a collapse to nothing (0).
  const aimed = landing !== null && landing.width > 0 && home.w > 0;
  const tgtScale = aimed ? landing.width / home.w : 1;
  const tgtCx = aimed ? landing.left + landing.width / 2 : home.cx;
  const tgtCy = pinRect.bottom + vW * tgtScale;
  return {
    caption: null,
    depthBlur: DEPTH_BLUR[place.depth],
    depthOpacity: DEPTH_OPACITY[place.depth],
    el,
    pf: DEPTH_PF[place.depth],
    poster,
    showpiece: true,
    srcDx: 0,
    srcDy: 0,
    srcScale: 1,
    tag: child(el, "[data-tag]"),
    tgtDx: tgtCx - home.cx,
    tgtDy: tgtCy - home.cy,
    tgtScale,
    // The showpiece weaves an S on the way out: `danceAmp` is its first-bow reach in
    // px (a fraction of the viewport); the direction/spin fields are unused (its rule
    // lives in `danceDelta`).
    danceUx: 0,
    danceUy: 0,
    danceAmp: sway * vw,
    danceSpin: 0,
  };
};

// ---- the PORTRAIT contact-sheet scatter (#27 Part C) ----
//
// The mobile twin of VITRINE. The portrait morph carries only THREE vessels (the
// showpiece + Orray + Tempo); Scry + Ginevra are static flow cards and are never
// rigged. These mirror the C.2 contact-sheet placement (the tall first screen
// re-author) so the rest state of the FLIP is exactly the contact sheet the rest
// slice already shipped. Placement is TOP-LEFT anchored (a fraction of the pinned
// sheet for x/y, a fraction of the VIEWPORT WIDTH for w — the `Nvw` the sheet uses),
// matching the global portrait re-author frame (globals.css @media max-width:640px).
interface MobilePlacement {
  /** Depth-of-field layer (reuses the desktop DEPTH_* tables). */
  readonly depth: 1 | 2 | 3;
  /** Vessel width as a fraction of the viewport width (square; height = width). */
  readonly w: number;
  /** Top-left x as a fraction of the pinned sheet width. */
  readonly x: number;
  /** Top-left y as a fraction of the pinned sheet height. */
  readonly y: number;
}

const MOBILE_SCATTER: Record<string, MobilePlacement> = {
  anypinn: { depth: 2, x: 0.27, y: 0.05, w: 0.46 },
  // Tempo comes forward (depth 1) and Orray drops a layer behind it (depth 2): on
  // portrait Orray's near-white logo reads too bright at the front of the depth field,
  // so it recedes (lower opacity + more blur) and Tempo leads the lower pair instead.
  orray: { depth: 2, x: 0.05, y: 0.64, w: 0.45 },
  tempo: { depth: 1, x: 0.53, y: 0.7, w: 0.42 },
};

// Measure a PORTRAIT peer tile (Orray / Tempo) at its carousel-card home and derive the
// viewport-fixed contact-sheet SOURCE it parks at; its target is its own card (identity),
// exactly like the desktop buildPeerRig but for the single-column carousel. The carousel
// is browser-pinned (position: sticky; top: 0) for the morph, so the card's pinned home
// is its offset INSIDE the carousel container (`home.cy - carouselTop`) — scroll-stable
// like the desktop grid. The scatter point is the top-left placement resolved to the
// pinned sheet (its centre, in viewport px). Portrait peers do not dance for now (a
// straight FLIP; a portrait choreography is a C.5 polish), so the dance fields are zero.
const buildMobilePeerRig = (
  el: HTMLElement,
  place: MobilePlacement,
  pinRect: DOMRect,
  carouselTop: number,
  vw: number
): Rig | null => {
  const poster = child(el, "[data-poster]");
  if (!poster) {
    return null;
  }
  const home = anchorPoster(el, poster);
  const homeCx = home.cx;
  const homeCy = home.cy - carouselTop;
  const wPx = place.w * vw;
  // The scatter vessel's centre in the pinned sheet (top-left + half its square box).
  // Normalised to the pin's top: 0 (like the desktop vCy), so it is scroll-independent.
  const vCx = pinRect.left + place.x * pinRect.width + wPx / 2;
  const vCy = place.y * pinRect.height + wPx / 2;
  return {
    caption: child(el, "[data-caption]"),
    depthBlur: DEPTH_BLUR[place.depth],
    depthOpacity: DEPTH_OPACITY[place.depth],
    el,
    pf: DEPTH_PF[place.depth],
    poster,
    showpiece: false,
    srcDx: vCx - homeCx,
    srcDy: vCy - homeCy,
    srcScale: wPx / home.w,
    tag: child(el, "[data-tag]"),
    tgtDx: 0,
    tgtDy: 0,
    tgtScale: 1,
    danceUx: 0,
    danceUy: 0,
    danceAmp: 0,
    danceSpin: 0,
  };
};

// Reuse the desktop buildShowRig for the PORTRAIT showpiece: convert its top-left
// scatter to the CENTRE-fraction placement buildShowRig expects (top-left + half the
// square box), and pass the vw width explicitly so the rem-clamp sizing is bypassed.
// The S-curve set-aside / finale aim / scroll-stable target are all reused verbatim; the
// only portrait retune (#27 C.5) is a narrower sway (MOBILE_SHOW_SWAY_VW) for the
// centred portrait start.
const buildMobileShowRig = (
  showEl: HTMLElement,
  pinRect: DOMRect,
  rem: number,
  vw: number,
  landing: DOMRect | null
): Rig | null => {
  const place = MOBILE_SCATTER[content.showpiece.key];
  const showW = place.w * vw;
  return buildShowRig(
    showEl,
    pinRect,
    rem,
    vw,
    landing,
    {
      depth: place.depth,
      w: place.w,
      x: place.x + showW / 2 / pinRect.width,
      y: place.y + showW / 2 / pinRect.height,
    },
    showW,
    // Portrait exit retune (#27 C.5): a narrower sway, since the portrait showpiece
    // starts horizontally centred (above) rather than off to one side.
    MOBILE_SHOW_SWAY_VW
  );
};

// Resolve one carousel tile: a rigged portrait peer (Orray / Tempo) gets a FLIP rig;
// anything else (Scry / Ginevra) is a STATIC flow card — resolved live now so it is
// navigable from the start (the #27 observer that lights it is C.4). Returns the rig,
// or null for a static card (which it mutates in place to the live phase).
const buildCarouselRig = (
  el: HTMLElement,
  pinRect: DOMRect,
  carouselTop: number,
  vw: number
): Rig | null => {
  const place = el.dataset.key ? MOBILE_SCATTER[el.dataset.key] : undefined;
  if (place) {
    return buildMobilePeerRig(el, place, pinRect, carouselTop, vw);
  }
  // A static flow card is navigable from the start: its href is already on the node
  // (React render), so we only flip it live and arm the tab order.
  el.dataset.phase = "live";
  el.removeAttribute("tabindex");
  return null;
};

// Centre the first carousel card (Orray) on the viewport middle during the pin, so the
// morph lands it exactly on the proximity-snap centre (scroll-snap-align: center) when
// the sticky releases — the #27 seam with no flicker. The carousel is browser-pinned at
// top: 0, so we add lead padding above the cards equal to the gap between the card's
// pinned centre and 50svh. Pinned-relative (minus the carousel top) so it is robust to
// whatever scroll measure() runs at.
const centerFirstCard = (
  section: HTMLElement,
  carousel: HTMLElement,
  firstTile: HTMLElement | undefined,
  vh: number
) => {
  section.style.paddingTop = "";
  if (!firstTile) {
    return;
  }
  // Clear any prior morph transform so the home reads the true (untransformed) box; the
  // `.mobile` CSS pins the tile transition to none, so the clear is instant.
  firstTile.style.transform = "";
  const firstPoster = firstTile.querySelector<HTMLElement>("[data-poster]");
  if (!firstPoster) {
    return;
  }
  const carTop = carousel.getBoundingClientRect().top;
  const r = firstPoster.getBoundingClientRect();
  const centerWithin = r.top + r.height / 2 - carTop;
  const curPad = Number.parseFloat(getComputedStyle(section).paddingTop) || 0;
  const pad = Math.max(0, curPad + (0.5 * vh - centerWithin));
  section.style.paddingTop = `${pad.toFixed(2)}px`;
};

// The dance deviation (viewport px) this vessel rides off its straight FLIP line at
// morph parameter `m`. Enveloped to zero at both ends (so the FLIP source + target are
// untouched and the settle is pixel-true). Two shapes:
//   - the showpiece weaves ONE time-lopsided S — a sine over a warped clock so it swings
//     across to the far side, sweeps back through centre once (at SHOW_SPLIT), and a
//     `(1 - m)`-tapered short overshoot the other way before settling velocity-free;
//   - every peer rides `amp·env·(cos a · u + sin a · v)` with `a = spin · 2π · m`,
//     `u` toward its attractor and `v = perp(u)`: spin 0 is a pure bow toward the
//     field, small ±spin a directional hook that banks toward `v` as it grows.
const danceDelta = (rig: Rig, m: number): { x: number; y: number } => {
  if (rig.danceAmp === 0) {
    return { x: 0, y: 0 };
  }
  if (rig.showpiece) {
    // One continuous S: sin(2π·warp) has a single interior zero at SHOW_SPLIT, so the
    // vessel sweeps THROUGH centre once (no pause, no second gesture); `(1 - m)` tapers
    // the trailing overshoot small and lands it with zero velocity.
    const warp = m ** SHOW_WARP;
    return { x: rig.danceAmp * (1 - m) * Math.sin(TWO_PI * warp), y: 0 };
  }
  const env = danceEnv(m);
  if (env <= 0.0001) {
    return { x: 0, y: 0 };
  }
  const r = rig.danceAmp * env;
  const a = rig.danceSpin * TWO_PI * m;
  const along = Math.cos(a) * r; // toward the attractor (u) and back
  const across = Math.sin(a) * r; // the swirl (v = perp(u))
  return {
    x: along * rig.danceUx - across * rig.danceUy,
    y: along * rig.danceUy + across * rig.danceUx,
  };
};

// Drive one vessel for the current --p (and whether it is the lit one at rest).
// Identical for all five: lerp source -> target (translate + scale about the poster
// centre), clear the depth blur soft -> sharp, assemble the caption in. The blur and
// corner are divided by the live scale so the ON-SCREEN values are exactly the
// hero's (per-depth blur, 1.4rem corner) regardless of the FLIP scale.
//
// The translate is a PURE function of progress (no scroll term): both the source
// (vitrine scatter) and the target (grid cell / set-aside) are viewport-fixed during
// the morph because the grid is browser-pinned (sticky) and the showpiece lives in
// the pin. At p=1 the offset is the identity target (0 for peers), so when the grid
// un-sticks the tile simply rides the flow — no per-frame compensation, no jitter.
//
// On top of that straight base each vessel rides a `danceDelta` excursion — a bow or a
// pirouette that returns to exactly the target — so the handoff arrives composed but
// gets there by dancing (see the DANCE block).
//
// `fx` / `fy` are the live field-parallax offset (the pointer position on desktop, the
// gyro tilt on a phone; normalised like the hero's `--mx` / `--my`). They are folded in
// the SAME way the hero's .vessel reads them — multiplied by this vessel's depth factor
// (`rig.pf`) — but tapered by `(1 - m)` so the sway is a REST-ONLY echo of the hero: it
// is at full reach in the contact sheet and gone by the time the tiles take flight, so
// it never fights the FLIP. They default to 0, so a caller that does not drive the field
// (the initial measure, a released card) gets the exact prior, parallax-free transform.
const drive = (rig: Rig, p: number, lit: boolean, fx = 0, fy = 0) => {
  const m = smoothstep(0, MORPH_LANDING, p);
  const delta = danceDelta(rig, m);
  const rest = 1 - m;
  const dx = lerp(rig.srcDx, rig.tgtDx, m) + delta.x + fx * rig.pf * rest;
  const dy = lerp(rig.srcDy, rig.tgtDy, m) + delta.y + fy * rig.pf * rest;
  const base = lerp(rig.srcScale, rig.tgtScale, m);
  const scale = lit ? base * HOVER_SCALE : base;
  rig.el.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
  rig.el.style.opacity = (lit ? 1 : lerp(rig.depthOpacity, 1, m)).toFixed(3);
  const blur = lit ? 0 : rig.depthBlur * (1 - m);
  rig.poster.style.filter =
    blur > 0.02 ? `blur(${(blur / scale).toFixed(2)}px)` : "none";
  rig.poster.style.borderRadius = `${(RADIUS_REM / scale).toFixed(3)}rem`;
  // The floating name tag is the hero's, restored at rest: divide its size + offset by
  // the live scale so it reads at the hero's pixel size, and reveal it only when this
  // is the lit vessel at rest (`lit` is false the moment the morph leaves rest).
  if (rig.tag) {
    rig.tag.style.fontSize = `${(TAG_FONT_REM / scale).toFixed(3)}rem`;
    rig.tag.style.bottom = `${(-TAG_OFFSET_REM / scale).toFixed(3)}rem`;
    rig.tag.style.opacity = lit ? `${TAG_LIT_OPACITY}` : "0";
  }
  if (rig.caption) {
    rig.caption.style.opacity = smoothstep(0.62, 0.96, p).toFixed(3);
  }
};

// A tile's interactivity phase: a calm display vessel at rest (hover-reactive, no
// navigation), inert mid-flight, a real navigable card once resolved. The showpiece
// never goes live (it sets itself aside), so its "live" collapses to flight.
const phaseFor = (p: number, showpiece: boolean): Phase => {
  if (p <= HERO_REST) {
    return "rest";
  }
  if (p > RESOLVE_AT) {
    return showpiece ? "flight" : "live";
  }
  return "flight";
};

// The href is always on the tile (crawlable from first paint); the phase only ARMS
// navigation for humans. Live joins the tab order and lets the click through; off
// live the tile keeps its href (crawlers still follow it) but sits out of the tab
// order, and the stage's click guard swallows the navigation.
const setPhase = (rig: Rig, phase: Phase) => {
  rig.el.dataset.phase = phase;
  if (phase === "live") {
    rig.el.removeAttribute("tabindex");
  } else {
    rig.el.setAttribute("tabindex", "-1");
  }
};

interface Chrome {
  readonly baton: HTMLElement;
  readonly copy: HTMLElement;
  readonly grain: HTMLElement;
  readonly label: HTMLElement;
  readonly pin: HTMLElement;
  readonly vignette: HTMLElement;
}

// The chrome hand-off tuning. The desktop morph and the portrait morph share the SAME
// dissolve timing (the smoothsteps below) but want a different exit GESTURE for the two
// pieces of moving chrome, because a portrait viewport has far more vertical room:
//   - thesisLift  rem the centred thesis rises as it hands the baton out;
//   - batonDrop   rem the "DIVE IN ↓" scroll cue physically DROPS as it fades (0 keeps the
//                 desktop cue a pure fade — its transform is then never touched, so the
//                 desktop call stays byte-for-byte).
interface ChromeTuning {
  readonly batonDrop: number;
  readonly thesisLift: number;
}

// Desktop (landscape) keeps its exact shipped numbers: a 2rem thesis lift and a pure-fade
// baton (no drop). This is the default, so the desktop driveChrome call is unchanged.
const DESKTOP_CHROME: ChromeTuning = { batonDrop: 0, thesisLift: 2 };
// Portrait (#27 C.5): a tall viewport, so the thesis lifts a touch further and the
// down-arrow "DIVE IN ↓" cue drops as it hands off, reading as the baton passed downward
// into the scroll. Eyeball-tunable on a real phone.
const MOBILE_CHROME: ChromeTuning = { batonDrop: 1.4, thesisLift: 3 };

// The contact-sheet chrome hands the baton out: the grain and vignette dissolve, the
// thesis rises + fades, the scroll cue drops. The accent wash is owned by the
// coordinator at rest (hover) and once resolved (the lit card); only mid-flight does
// the chrome release it, so a half-formed grid never carries a stale tint. `tuning`
// shapes the two moving-chrome exit gestures (desktop vs portrait); it defaults to the
// desktop values so the MotionStage call is byte-for-byte.
const driveChrome = (
  chrome: Chrome,
  p: number,
  phase: Phase,
  tuning: ChromeTuning = DESKTOP_CHROME
) => {
  chrome.grain.style.opacity = (0.11 * (1 - smoothstep(0.2, 0.6, p))).toFixed(
    3
  );
  chrome.vignette.style.opacity = (1 - smoothstep(0.25, 0.62, p)).toFixed(3);
  chrome.copy.style.opacity = (1 - smoothstep(0.3, 0.66, p)).toFixed(3);
  chrome.copy.style.transform = `translate(-50%, calc(-50% - ${(p * tuning.thesisLift).toFixed(3)}rem))`;
  chrome.baton.style.opacity = (1 - Math.min(1, p * 6)).toFixed(3);
  // The down-arrow cue drops as it fades on portrait; desktop (batonDrop 0) leaves the
  // baton transform untouched, so its CSS translateX(-50%) centring is byte-for-byte.
  if (tuning.batonDrop !== 0) {
    chrome.baton.style.transform = `translate(-50%, ${(p * tuning.batonDrop).toFixed(3)}rem)`;
  }
  // The grid's section label is the baton's counterpart: it hands IN as the grid
  // resolves (the same late ramp the peer captions use), so it is invisible over
  // the contact sheet and reads as the title of the settled grid. It lives in the
  // sticky grid, so it carries no scroll term — pure function of progress.
  chrome.label.style.opacity = smoothstep(0.62, 0.96, p).toFixed(3);
  chrome.pin.dataset.settling = p > 0.001 && p < 0.999 ? "true" : "false";
  if (phase === "flight") {
    chrome.pin.style.removeProperty("--live-accent");
  }
};

// Release one tile back to its natural state (used on unmount).
const restoreRig = (rig: Rig) => {
  const s = rig.el.style;
  s.transform = "";
  s.opacity = "";
  s.transformOrigin = "";
  s.position = "";
  s.width = "";
  s.height = "";
  s.left = "";
  s.top = "";
  rig.el.removeAttribute("tabindex");
  rig.el.removeAttribute("data-phase");
  rig.el.removeAttribute("data-active");
  rig.poster.style.filter = "";
  rig.poster.style.borderRadius = "";
  if (rig.tag) {
    rig.tag.style.fontSize = "";
    rig.tag.style.bottom = "";
    rig.tag.style.opacity = "";
  }
  if (rig.caption) {
    rig.caption.style.opacity = "";
  }
};

// The hero's field-parallax input, restored for a morph stage's REST contact sheet.
// The morph stages replace <Hero> (which owned `--mx` / `--my`) with their own tiles,
// so without this the rest sheet sits static — no mouse parallax on desktop, no gyro
// sway on a phone. This is the same one physics, wired to the same two channels:
//   - a FINE pointer tracks the cursor against the pin (the viewport-sized contact
//     sheet), normalised to ±0.5 per axis exactly like the hero;
//   - a COARSE pointer has no mouse, so device tilt drives the same offset (reusing the
//     hero's `startGyroTilt`: a subtle, smoothed, clamped sway, with the iOS permission
//     piggyback surfaced through `enable()` for the stage's first tap-to-light).
// Offsets are rAF-coalesced and handed to `onField`; the caller folds them into `drive()`
// (tapered to zero as the morph leaves rest). The input choice is a mount-time snapshot,
// like ShowcaseRoot. Reduced motion never reaches here — both morph stages are gated
// behind `no-preference` — so the field is always welcome once this runs.
interface FieldInput {
  /** iOS gyro permission piggyback; a no-op on the pointer path / non-iOS. */
  readonly enable: () => void;
  /** Remove every listener + cancel the pending frame (called on unmount). */
  readonly stop: () => void;
}

const startFieldInput = (
  pin: HTMLElement,
  onField: (fx: number, fy: number) => void
): FieldInput => {
  let raf = 0;
  let fx = 0;
  let fy = 0;
  const flush = () => {
    if (raf !== 0) {
      return;
    }
    raf = requestAnimationFrame(() => {
      raf = 0;
      onField(fx, fy);
    });
  };
  const cancel = () => {
    if (raf !== 0) {
      cancelAnimationFrame(raf);
    }
  };

  // No mouse to track: device tilt drives the same field instead (Android starts
  // silently; iOS waits for the stage's tap to call `enable()`).
  if (window.matchMedia("(pointer: coarse)").matches) {
    const gyro = startGyroTilt((mx, my) => {
      fx = mx;
      fy = my;
      flush();
    });
    return {
      enable: () => gyro.enable(),
      stop: () => {
        gyro.stop();
        cancel();
      },
    };
  }

  const onMove = (event: PointerEvent) => {
    const rect = pin.getBoundingClientRect();
    fx = (event.clientX - rect.left) / rect.width - 0.5;
    fy = (event.clientY - rect.top) / rect.height - 0.5;
    flush();
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  return {
    enable: () => {
      // The pointer path has no gesture gate to satisfy.
    },
    stop: () => {
      window.removeEventListener("pointermove", onMove);
      cancel();
    },
  };
};

export function Stage() {
  // Default to plain so SSR and the first client render agree (no hydration
  // mismatch); the effect upgrades to a morph only where it is welcome.
  const [mode, setMode] = useState<Mode>("plain");

  useEffect(() => {
    const desktop = window.matchMedia(MOTION_QUERY);
    const mobile = window.matchMedia(MOBILE_MOTION_QUERY);
    // The desktop morph wins where both could nominally apply (its 48rem floor and
    // the mobile 40rem ceiling never overlap, but evaluating it first keeps the
    // precedence explicit). Anything matching neither — reduced-motion, no-JS, or a
    // 40-48rem fine pointer — stays plain. Re-evaluated on resize / orientation /
    // pointer / reduced-motion change, so a window that crosses a boundary swaps
    // cleanly instead of latching on the first match.
    const sync = () => {
      if (desktop.matches) {
        setMode("motion");
      } else if (mobile.matches) {
        setMode("mobile");
      } else {
        setMode("plain");
      }
    };
    sync();
    desktop.addEventListener("change", sync);
    mobile.addEventListener("change", sync);
    return () => {
      desktop.removeEventListener("change", sync);
      mobile.removeEventListener("change", sync);
    };
  }, []);

  if (mode === "motion") {
    return <MotionStage />;
  }
  if (mode === "mobile") {
    return <MobileMotionStage />;
  }
  return <PlainStage />;
}

// The plain sectioned story: hero, then the 2x2 grid, composed straight from the
// verified deep modules. No morph, no set-aside, no single-node tile.
function PlainStage() {
  return (
    <>
      <Hero />
      <ShowcaseRoot className={proofStyles.stage}>
        <div className={proofStyles.tint} />
        <ProofGrid />
      </ShowcaseRoot>
    </>
  );
}

// MobileMotionStage — the portrait twin of MotionStage (#27 Part C), the
// scroll-handoff FLIP morph that feeds the page-flow center-focus carousel on
// phones. It is its OWN component, so the desktop MotionStage stays byte-for-byte
// untouched (the explicit ownership contract of #27 Part C), but it reuses the same
// PURE machinery — `drive`, `danceDelta`, `buildShowRig`, `restoreRig`, the `Rig`
// type, the chrome driver — and the same sticky-pin-releases mechanic, so the two
// share one physics.
//
// The contact sheet is the PIN; the page-flow carousel is the pulled-up sticky
// `.gridStick`. Three vessels are rigged, the other two stream in:
//   - the showpiece (AnyPINN) sets itself aside down toward the finale (the same
//     buildShowRig set-aside the desktop uses, re-aimed + sway-retuned for portrait);
//   - Orray morphs into carousel card #1 and LANDS ON THE VIEWPORT-CENTRED slot at
//     the pin release, so the #27 proximity snap + observer pick it up with no flicker;
//   - Tempo morphs into carousel card #2.
// Orray + Tempo are ONE DOM node each (their home is the carousel card, pulled back to
// the contact-sheet scatter at rest — exactly as the desktop peers are their grid
// cells). Scry (#3) + Ginevra (#4) are NEVER rigged: static flow cards in the same
// carousel <ul>.
//
// ONE lit coordinator spans every phase (#27 C.4): a coarse tap / fine hover lights a
// vessel AT REST; the first scroll clears that and the tiles go INERT through the
// flight; at the RELEASE (p === 1) the morph hands the four cards to the page-flow
// carousel — it lights the centred card (Orray) and the #27 VIEWPORT observer takes
// over, lighting Tempo / Scry / Ginevra (and firing the snap haptic) as each reaches
// the centre band. The hand-off is seamless: the rig releases its inline transform so
// the proof card's own recede + [data-active] bloom own the cards (`.released`, see
// stage.module.css), the seam seeds the lit centre so there is no dark frame and the
// observer's first tick is a no-op (no double-light).
//
// The chrome hand-off + the showpiece exit are portrait-retuned (#27 C.5): a taller
// thesis lift, a dropping "DIVE IN ↓" baton (MOBILE_CHROME), and a narrower set-aside
// sway for the centred portrait showpiece (MOBILE_SHOW_SWAY_VW).
function MobileMotionStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const vitrineRef = useRef<HTMLDivElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);
  const vignetteRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const batonRef = useRef<HTMLParagraphElement>(null);
  const labelRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const pin = pinRef.current;
    const carousel = carouselRef.current;
    const section = sectionRef.current;
    const vitrine = vitrineRef.current;
    const grain = grainRef.current;
    const vignette = vignetteRef.current;
    const copy = copyRef.current;
    const baton = batonRef.current;
    if (
      !(
        stage &&
        pin &&
        carousel &&
        section &&
        vitrine &&
        grain &&
        vignette &&
        copy &&
        baton
      )
    ) {
      return;
    }
    const label = labelRef.current;
    if (!label) {
      return;
    }
    const chrome: Chrome = { baton, copy, grain, label, pin, vignette };

    let rigs: Rig[] = [];
    const rigByEl = new Map<HTMLElement, Rig>();
    // The four carousel cards in document order ([Orray, Tempo, Scry, Ginevra]) — the
    // #27 viewport observer + the release seam read positions off these, so they are
    // re-captured each measure() (the same nodes survive a reflow, but the array is
    // rebuilt for clarity).
    let carouselTiles: HTMLElement[] = [];
    // The morph's scroll distance (px), captured in measure() as MORPH_END * the
    // viewport height the stage was SIZED with — i.e. the sticky stick-distance
    // (stageHeight - carouselHeight). compute() maps progress against THIS, not a live
    // window.innerHeight, so p === 1 always lands exactly where the carousel sticky
    // RELEASES. Reading innerHeight live in compute() instead would desync the two when
    // the viewport height changes between measure and scroll (the mobile URL bar, the
    // soft keyboard, a view transition): the carousel would un-stick while p was still
    // < 1, stranding the showpiece set-aside in mid-flight over the resolved cards.
    let morphTravel = 0;

    // FLIP measurement (portrait): rig Orray + Tempo from their carousel-card homes to
    // the contact-sheet scatter, rig the showpiece's set-aside, and centre Orray's
    // card on the viewport so the morph lands it on the proximity-snap centre.
    const measure = () => {
      const pinRect = pin.getBoundingClientRect();
      const rem =
        Number.parseFloat(
          getComputedStyle(document.documentElement).fontSize
        ) || 16;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const tiles = Array.from(
        carousel.querySelectorAll<HTMLElement>("a[data-key]")
      );
      carouselTiles = tiles;

      // Centre Orray's card on the viewport middle during the pin (the #27 seam), then
      // read each card's PINNED home (the carousel is browser-pinned at top: 0, so its
      // container top recovers the home regardless of scroll).
      centerFirstCard(section, carousel, tiles[0], vh);
      const carouselTop = carousel.getBoundingClientRect().top;

      rigs = [];
      rigByEl.clear();
      for (const el of tiles) {
        const rig = buildCarouselRig(el, pinRect, carouselTop, vw);
        if (rig) {
          rigs.push(rig);
          rigByEl.set(el, rig);
        }
      }

      // The showpiece's set-aside, aimed at the finale landing slot when present (its
      // width + x are scroll-stable, so the live rect is robust to any scroll).
      const landingEl = document.querySelector<HTMLElement>(
        "[data-finale-landing]"
      );
      const landing = landingEl?.getBoundingClientRect() ?? null;
      const showEl = vitrine.querySelector<HTMLElement>("a[data-key]");
      const showRig = showEl
        ? buildMobileShowRig(showEl, pinRect, rem, vw, landing)
        : null;
      if (showRig) {
        rigs.push(showRig);
        rigByEl.set(showRig.el, showRig);
      }

      // Size the stage so the carousel's sticky pin RELEASES exactly when the morph
      // completes: it stays pinned for the first MORPH_END of a viewport of scroll, then
      // un-sticks and scrolls to its end (the page-flow carousel). The sticky
      // stick-distance equals stageHeight - carouselHeight.
      const carouselHeight = carousel.offsetHeight;
      stage.style.height = `${(carouselHeight + MORPH_END * vh).toFixed(2)}px`;
      // The stick-distance the stage was just sized to: compute() maps progress to 1
      // exactly here, so the morph completes the instant the carousel sticky releases —
      // even if window.innerHeight differs by the time the user scrolls (URL bar /
      // keyboard / view transition between this measure and that scroll).
      morphTravel = MORPH_END * vh;
    };

    // ---- the single-lit coordinator (rest hover/tap -> inert flight -> morph lights
    //      the centre at release -> the #27 viewport observer owns the carousel) ----
    let phase: Phase = "rest";
    let lastProgress = -1;
    let activeEl: HTMLElement | null = null;
    let focusedEl: HTMLElement | null = null;
    // The live field-parallax offset (the hero's `--mx` / `--my`): device tilt on a
    // phone, the pointer on a narrow fine-pointer window. `drive()` folds it in, faded
    // to zero off rest.
    let fieldX = 0;
    let fieldY = 0;
    // The key the #27 observer last SETTLED at centre, so the snap haptic fires once
    // per NEW centre (not on every observer tick), and so the release seam can seed it
    // (it lights Orray, so the observer's first Orray tick is a no-op, not a re-buzz).
    let centeredKey: string | null = null;
    // Live primary-pointer read: a coarse (touch) pointer taps to light and KEEPS lit;
    // a fine pointer (a narrow desktop window, or a hovering pen) lights on hover. Read
    // from a media query updated in place, so a hybrid device flips without re-running
    // this whole effect.
    const coarseMql = window.matchMedia("(pointer: coarse)");
    let coarse = coarseMql.matches;
    const onCoarseChange = () => {
      coarse = coarseMql.matches;
    };
    coarseMql.addEventListener("change", onCoarseChange);

    const setActive = (el: HTMLElement | null) => {
      if (el === activeEl) {
        return;
      }
      if (activeEl) {
        activeEl.dataset.active = "false";
      }
      activeEl = el;
      if (el) {
        el.dataset.active = "true";
        const accent = el.style.getPropertyValue("--accent").trim();
        if (accent) {
          pin.style.setProperty("--live-accent", accent);
        }
      } else {
        pin.style.removeProperty("--live-accent");
      }
    };

    // Light a tile. At rest a rigged tile is re-driven so it lifts + clears its blur in
    // place (there is no scroll frame to do it); a static card's loud look is its own
    // [data-active] CSS, so only the accent + flag change.
    const redrive = (el: HTMLElement | null, lit: boolean) => {
      const rig = el ? rigByEl.get(el) : undefined;
      if (rig) {
        drive(rig, lastProgress, lit, fieldX, fieldY);
      }
    };
    const light = (el: HTMLElement | null) => {
      const prev = activeEl;
      setActive(el);
      if (phase !== "rest") {
        return;
      }
      if (prev !== el) {
        redrive(prev, false);
      }
      redrive(el, true);
    };

    // The tilt / pointer moved: re-drive the rest contact sheet so it sways under the
    // new offset. Only at rest — off rest the scroll's `apply()` owns the tiles and the
    // `(1 - m)` taper has already faded the sway.
    const onField = (fx: number, fy: number) => {
      fieldX = fx;
      fieldY = fy;
      if (phase !== "rest") {
        return;
      }
      for (const rig of rigs) {
        drive(rig, lastProgress, rig.el === activeEl, fieldX, fieldY);
      }
    };

    // The carousel card whose poster centre sits nearest the viewport's vertical middle
    // — the one the page-flow carousel reads as "centred". Used to seed the lit card at
    // the morph release (Orray lands centred there) so the hand-off to the observer
    // starts from an already-lit centre, with no dark frame.
    const centeredCard = (): HTMLElement | null => {
      const mid = window.innerHeight / 2;
      let best: HTMLElement | null = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const el of carouselTiles) {
        const poster = el.querySelector<HTMLElement>("[data-poster]");
        const box = (poster ?? el).getBoundingClientRect();
        const dist = Math.abs(box.top + box.height / 2 - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = el;
        }
      }
      return best;
    };

    // The release seam: at p === 1 the morph has landed the centred card (Orray) exactly
    // on the proximity-snap centre. Light it and seed `centeredKey`, so the #27 observer
    // takes over from an ALREADY-lit centre — no double-light (the observer's first tick
    // on Orray is a no-op + no re-buzz) and no dark frame.
    const lightCentered = () => {
      const el = centeredCard();
      if (!el) {
        return;
      }
      light(el);
      centeredKey = el.dataset.key ?? null;
    };

    // Hand a landed peer (Orray / Tempo) to the page-flow carousel: drop the rig's
    // per-frame transform / opacity / filter so the proof card's OWN mobile recede +
    // [data-active] bloom (and its 0.45s settle) govern it again — identical to the
    // static cards and the standalone grid (see stage.module.css `.released`). Its
    // data-phase ("live"), tab order, and lit flag are preserved (the href has been
    // on the node since first paint).
    const releaseToCarousel = (rig: Rig) => {
      const s = rig.el.style;
      s.transform = "";
      s.opacity = "";
      s.transformOrigin = "";
      rig.poster.style.filter = "";
      rig.poster.style.borderRadius = "";
      if (rig.tag) {
        rig.tag.style.opacity = "";
      }
      if (rig.caption) {
        rig.caption.style.opacity = "";
      }
    };

    // The #27 observer's settle: the card that just reached the centre band becomes the
    // single loud one (through the same coordinator), and a NEW centre fires the snap
    // haptic (Android buzzes; iOS Safari has no Vibration API and silently no-ops; off
    // under reduced motion). Only acts once the morph has released to the carousel
    // (phase "live"); during rest / flight the morph owns lighting and these ticks
    // (rigged tiles transforming through centre) are ignored.
    const settle = (el: HTMLElement) => {
      if (phase !== "live") {
        return;
      }
      light(el);
      const key = el.dataset.key;
      if (key && key !== centeredKey) {
        centeredKey = key;
        haptic(15);
      }
    };

    // A rig's interactivity phase WHILE THE MORPH RUNS: the showpiece reads phaseFor (it
    // never goes live — it sets itself aside); a peer is the rest vessel at the very top
    // and inert flight through the whole morph. A peer only becomes a navigable, CSS-owned
    // carousel card at the release (p === 1), which apply() drives directly.
    const morphPhase = (rig: Rig, p: number): Phase => {
      if (rig.showpiece) {
        return phaseFor(p, true);
      }
      return p <= HERO_REST ? "rest" : "flight";
    };

    // The stage phase: rest at the very top, inert flight through the morph, and live
    // ONLY at the release (p === 1) — not at RESOLVE_AT — so the per-frame FLIP never
    // wears the carousel transition and the rig -> CSS hand-off happens in one clean step.
    const stagePhase = (p: number, landed: boolean): Phase => {
      if (landed) {
        return "live";
      }
      return p <= HERO_REST ? "rest" : "flight";
    };

    // Drive every rig for the current progress. Landed peers are RELEASED to the page
    // -flow carousel (CSS owns recede + bloom); everything else (the still-morphing peers
    // and the always-rig-driven showpiece set-aside) rides the FLIP.
    const driveRigs = (p: number, landed: boolean) => {
      for (const rig of rigs) {
        if (landed && !rig.showpiece) {
          releaseToCarousel(rig);
          setPhase(rig, "live");
        } else {
          drive(
            rig,
            p,
            phase === "rest" && rig.el === activeEl,
            fieldX,
            fieldY
          );
          setPhase(rig, morphPhase(rig, p));
        }
      }
    };

    const apply = (p: number) => {
      stage.style.setProperty("--p", p.toFixed(4));
      const landed = p >= 1;
      phase = stagePhase(p, landed);
      // Leaving rest for the inert flight drops any hover/tap lighting so a half-formed
      // card is never lit. The release (landed) keeps the centred card lit instead.
      if (!landed && phase !== "rest" && activeEl) {
        setActive(null);
      }
      // Flip the released gate so the proof card's own recede + transition take the
      // four cards back once the carousel free-scrolls (stage.module.css `.released`).
      stage.classList.toggle(styles.released, landed);
      driveChrome(chrome, p, phase, MOBILE_CHROME);
      driveRigs(p, landed);
      // At the release, light the centred card so the #27 observer inherits an already
      // -lit centre (no dark frame). Skipped if a card is already lit (the observer or a
      // prior released frame owns it), so the seam never double-lights.
      if (landed && !activeEl) {
        lightCentered();
      }
    };

    const compute = () => {
      // The morph runs over the first MORPH_END of a viewport of scroll, where the
      // carousel stays sticky-pinned; -top is how far the stage top has scrolled above
      // the viewport top. Progress is mapped against morphTravel (the stick-distance
      // captured in measure()), NOT a live window.innerHeight, so p === 1 lands exactly
      // where the carousel releases regardless of any viewport-height change since the
      // last measure — otherwise the showpiece set-aside strands mid-flight over the
      // already-resolved cards (the URL-bar / soft-keyboard / view-transition seam).
      const top = stage.getBoundingClientRect().top;
      const progress = morphTravel > 0 ? clamp(-top / morphTravel, 0, 1) : 0;
      if (progress === lastProgress) {
        return;
      }
      lastProgress = progress;
      apply(progress);
      // The proximity snap only exists to finish a half-done morph: once resolved
      // (p === 1) drop it so the snap never re-grabs near the resolved target; restore
      // it on the way back up so it can still assist a reverse handoff.
      document.documentElement.style.scrollSnapType =
        progress >= 1 ? "none" : "y proximity";
    };

    const tileFrom = (target: EventTarget | null): HTMLElement | null =>
      target instanceof Element
        ? target.closest<HTMLElement>("a[data-key]")
        : null;
    // A tile may be lit at rest (any rigged tile) or once resolved (a live card).
    const lightable = (el: HTMLElement): boolean =>
      phase === "rest" || el.dataset.phase === "live";

    // Fine-pointer (hover / pen) lighting — never bound on a coarse tap-scroll.
    const onOver = (event: PointerEvent) => {
      if (coarse) {
        return;
      }
      const el = tileFrom(event.target);
      if (el) {
        if (lightable(el)) {
          light(el);
        }
        return;
      }
      light(focusedEl);
    };
    const onLeave = () => {
      if (!coarse) {
        light(focusedEl);
      }
    };
    // Keyboard focus lights on either pointer (assistive / hardware keyboard).
    const onFocusIn = (event: FocusEvent) => {
      const el = tileFrom(event.target);
      if (el && lightable(el)) {
        focusedEl = el;
        light(el);
      }
    };
    const onFocusOut = () => {
      focusedEl = null;
    };
    // Coarse-pointer tap: light a tile and KEEP it lit (re-tap replays its lift, never
    // toggles off). A tap that resolves nothing is left to the outside-dismiss below.
    // The tap doubles as the iOS gyro permission piggyback (like the hero): the first
    // tap that lights a vessel also asks for DeviceOrientation access, so the gyro field
    // parallax can take over. `enable()` is idempotent and a no-op once granted/denied.
    const onClick = (event: MouseEvent) => {
      if (!coarse) {
        return;
      }
      const el = tileFrom(event.target);
      if (el && lightable(el)) {
        field.enable();
        light(el);
      }
    };
    // Crawlable but inert until live: every tile carries its href from first paint
    // (so search crawlers can follow it to the repo), but only a live tile may
    // navigate. The static flow cards (Scry / Ginevra) are live from the start; a
    // rigged peer and the showpiece swallow the tap until the release seam makes
    // them live, so a mid-morph card never navigates.
    const onNavGuard = (event: MouseEvent) => {
      const el = tileFrom(event.target);
      if (el && el.dataset.phase !== "live") {
        event.preventDefault();
      }
    };
    // Touch dismissal: a tap outside every tile releases the lit one (a tap on a tile is
    // handled by onClick and must not also dismiss).
    const onDocPointerDown = (event: PointerEvent) => {
      if (!(coarse && activeEl)) {
        return;
      }
      if (!tileFrom(event.target)) {
        light(null);
      }
    };

    let raf = 0;
    const onScroll = () => {
      if (raf === 0) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          compute();
        });
      }
    };
    const remeasure = () => {
      measure();
      lastProgress = -1;
      compute();
    };
    // A resize whose WIDTH is unchanged is a mobile chrome change — the URL bar
    // collapsing or the soft keyboard opening (the contact form, near the page foot)
    // — not a layout change. Remeasuring on it re-pads centerFirstCard against the
    // new vh while we are scrolled well below the pin, recentring the whole carousel
    // and stranding the showpiece mid-deck until the next handoff overrides it. So
    // only remeasure on a width/orientation change; compute() already maps progress
    // against the captured morphTravel, so the height shift needs no re-measure.
    let lastVW = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lastVW) {
        return;
      }
      lastVW = window.innerWidth;
      remeasure();
    };

    measure();
    compute();
    // Enable the eased rest transitions only after the initial placement paints, so the
    // first frame snaps the tiles into the contact sheet instead of animating them out
    // of the carousel.
    const readyRaf = requestAnimationFrame(() =>
      stage.classList.add(styles.ready)
    );

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    // Enable the handoff's proximity scroll-snap (Part B / #27). The document is the
    // scroller, so the snap type lives on the root element; it is scoped to this stage's
    // lifetime and is `proximity` — never `mandatory` — so it only assists a half-finished
    // handoff and never traps free scroll. The carousel items carry scroll-snap-align:
    // center (proof-grid mobile CSS), so a settled scroll eases the nearest card to centre.
    const rootStyle = document.documentElement.style;
    const prevSnapType = rootStyle.scrollSnapType;
    rootStyle.scrollSnapType = "y proximity";

    // The coordinator listens on the whole stage so it catches both the carousel cards
    // and the absolutely-placed showpiece in the pin's vitrine layer.
    stage.addEventListener("pointerover", onOver);
    stage.addEventListener("pointerleave", onLeave);
    stage.addEventListener("focusin", onFocusIn);
    stage.addEventListener("focusout", onFocusOut);
    stage.addEventListener("click", onClick);
    stage.addEventListener("click", onNavGuard);
    document.addEventListener("pointerdown", onDocPointerDown);

    // Restore the hero's field parallax for the rest contact sheet: a phone (coarse)
    // sways the vessels by device tilt (the iOS permission is piggybacked on the first
    // tap, in onClick); a narrow fine-pointer window tracks the cursor. Re-drives only
    // at rest; `drive()` fades it out through the morph.
    const field = startFieldInput(pin, onField);

    // The carousel box (and so the scatter deltas + the Orray-centre lead) can shift
    // after web fonts swap in or any reflow; re-measure so the FLIP stays true.
    const observer = new ResizeObserver(remeasure);
    observer.observe(carousel);

    // The #27 center-focus observer (the SAME mechanic the standalone ProofGrid uses):
    // viewport-rooted (`root: null`, the cards flow in the page's own scroll), watching a
    // thin band at the viewport's vertical centre. Once the morph has released (phase
    // "live"), the card that lands in the band becomes the single loud one and a new
    // centre fires the snap haptic — so a swipe lights Tempo, then Scry, then Ginevra.
    // It observes through rest / flight too, but `settle` ignores those ticks (the morph
    // owns lighting until the release), which is what unifies the two systems into one.
    const centerObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            settle(entry.target as HTMLElement);
          }
        }
      },
      { root: null, rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    for (const tile of carouselTiles) {
      centerObserver.observe(tile);
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      stage.removeEventListener("pointerover", onOver);
      stage.removeEventListener("pointerleave", onLeave);
      stage.removeEventListener("focusin", onFocusIn);
      stage.removeEventListener("focusout", onFocusOut);
      stage.removeEventListener("click", onClick);
      stage.removeEventListener("click", onNavGuard);
      document.removeEventListener("pointerdown", onDocPointerDown);
      coarseMql.removeEventListener("change", onCoarseChange);
      field.stop();
      observer.disconnect();
      centerObserver.disconnect();
      if (raf !== 0) {
        cancelAnimationFrame(raf);
      }
      cancelAnimationFrame(readyRaf);
      stage.classList.remove(styles.ready);
      stage.classList.remove(styles.released);
      for (const rig of rigs) {
        restoreRig(rig);
      }
      grain.style.opacity = "";
      vignette.style.opacity = "";
      copy.style.opacity = "";
      copy.style.transform = "";
      baton.style.opacity = "";
      baton.style.transform = "";
      label.style.opacity = "";
      pin.style.removeProperty("--live-accent");
      pin.removeAttribute("data-settling");
      stage.style.height = "";
      section.style.paddingTop = "";
      rootStyle.scrollSnapType = prevSnapType;
    };
  }, []);

  return (
    <div className={`${styles.stage} ${styles.mobile}`} ref={stageRef}>
      <div className={styles.pin} ref={pinRef}>
        <div className={styles.tint} />
        <div className={styles.grain} ref={grainRef} />

        {/* the showpiece tile — its DOM home is the contact sheet, never the
            carousel; it sets itself aside off-screen, aimed at the finale's landing
            slot when the attractor is present below (else straight down) */}
        <div className={styles.vitrine} ref={vitrineRef}>
          <ProjectTile model={SHOWPIECE_MODEL} priority />
        </div>

        <div className={styles.vignette} ref={vignetteRef} />

        <div className={`vitrine__copy ${styles.copy}`} ref={copyRef}>
          <p className="eyebrow">{content.hero.eyebrow}</p>
          <h1 aria-label={content.hero.thesis} className="thesis">
            {content.hero.thesisLines.map((line) => (
              <span className="thesis__line" key={line}>
                {line}
              </span>
            ))}
          </h1>
          <p className="subline">{content.hero.subline}</p>
        </div>

        <p className={`scroll-baton ${styles.baton}`} ref={batonRef}>
          {content.hero.scrollBaton}
        </p>
      </div>

      {/* the page-flow carousel's home — pulled up over the pinned contact sheet
          (negative margin) and BROWSER-PINNED there (position: sticky) for the morph,
          so Orray + Tempo morph across it by pure transform with no JS scroll
          compensation (no jitter). When the morph completes the sticky releases and
          this scrolls away as the #27 page-flow carousel, read to its end. Orray (#1)
          + Tempo (#2) are rigged; Scry (#3) + Ginevra (#4) are static flow cards. */}
      <div className={styles.gridStick} ref={carouselRef}>
        <section className={proofStyles.section} ref={sectionRef}>
          {/* the carousel's section title — invisible over the contact sheet, handed
              in by the stage (opacity on --p) as the cards settle. */}
          <h2 className={proofStyles.label} ref={labelRef}>
            {content.work.label}
          </h2>
          <ul className={proofStyles.grid}>
            {PEER_MODELS.map((model) => (
              <li className={proofStyles.item} key={model.key}>
                <ProjectTile model={model} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* the contact-sheet rest snap point (Part B / #27): an invisible, zero-size
          proximity snap target at the stage top; the carousel items carry their own
          scroll-snap-align: center for the resolved cards, so the morph lands Orray on
          the centred slot and free scroll is never trapped. */}
      <div className={`${styles.snap} ${styles.snapRest}`} />
    </div>
  );
}

function MotionStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const vitrineRef = useRef<HTMLDivElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);
  const vignetteRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const batonRef = useRef<HTMLParagraphElement>(null);
  const labelRef = useRef<HTMLHeadingElement>(null);
  // The resolved-grid scroll-snap target (Part B); positioned from JS in measure() to
  // sit at the morph's release point.
  const snapResolvedRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const pin = pinRef.current;
    const grid = gridRef.current;
    const vitrine = vitrineRef.current;
    const grain = grainRef.current;
    const vignette = vignetteRef.current;
    const copy = copyRef.current;
    const baton = batonRef.current;
    if (
      !(stage && pin && grid && vitrine && grain && vignette && copy && baton)
    ) {
      return;
    }
    const label = labelRef.current;
    if (!label) {
      return;
    }
    const chrome: Chrome = { baton, copy, grain, label, pin, vignette };

    let rigs: Rig[] = [];
    const rigByEl = new Map<HTMLElement, Rig>();

    // FLIP measurement: read each tile's home, then derive its vitrine source and
    // its target (the peers' in-flow cell / the showpiece's off-screen park below the
    // pinned viewport).
    const measure = () => {
      const pinRect = pin.getBoundingClientRect();
      const rem =
        Number.parseFloat(
          getComputedStyle(document.documentElement).fontSize
        ) || 16;
      const vw = window.innerWidth;
      // Size the stage so the grid's sticky pin RELEASES exactly when the morph
      // completes: the grid (height = its own natural box) stays pinned for the first
      // MORPH_END of a viewport of scroll, then un-sticks and scrolls to its end. The
      // sticky stick-distance equals stageHeight - gridHeight, so set the stage to
      // gridHeight + the morph distance.
      const gridHeight = grid.offsetHeight;
      stage.style.height = `${(gridHeight + MORPH_END * window.innerHeight).toFixed(2)}px`;
      // Park the resolved scroll-snap target (Part B) at the morph's release — the
      // same distance the progress reaches 1 — so the proximity snap lines up exactly
      // with where the pin frees. Kept here so it tracks viewport resizes with the
      // stage height; the rest target is static at the stage top (top: 0 in CSS).
      const snapResolved = snapResolvedRef.current;
      if (snapResolved) {
        snapResolved.style.top = `${(MORPH_END * window.innerHeight).toFixed(2)}px`;
      }
      // The grid is sticky-pinned at top: 0 during the morph; its current container
      // top lets buildPeerRig recover each cell's PINNED viewport home regardless of
      // the scroll measure() runs at.
      const gridTop = grid.getBoundingClientRect().top;
      rigs = [];
      rigByEl.clear();
      for (const el of grid.querySelectorAll<HTMLElement>("a[data-key]")) {
        const rig = buildPeerRig(el, pinRect, gridTop, rem, vw);
        if (rig) {
          rigs.push(rig);
          rigByEl.set(el, rig);
        }
      }
      // The finale's landing slot, if it is composed below the grid: the showpiece
      // set-aside is aimed at it (shrink + drift to its centre) so the AnyPINN vessel
      // reads as heading to where the finale parks it. Its width + x are scroll-stable,
      // so reading the live rect is robust to whatever scroll measure() runs at.
      const landingEl = document.querySelector<HTMLElement>(
        "[data-finale-landing]"
      );
      const landing = landingEl?.getBoundingClientRect() ?? null;
      const showEl = vitrine.querySelector<HTMLElement>("a[data-key]");
      const showRig = showEl
        ? buildShowRig(showEl, pinRect, rem, vw, landing)
        : null;
      if (showRig) {
        rigs.push(showRig);
        rigByEl.set(showRig.el, showRig);
      }
    };

    // ---- the single-lit coordinator (rest hover + resolved grid) ----
    let phase: Phase = "rest";
    let lastProgress = -1;
    let activeEl: HTMLElement | null = null;
    let focusedEl: HTMLElement | null = null;
    // The live field-parallax offset (the hero's `--mx` / `--my`, here the pointer
    // position against the pin). `drive()` folds it in, tapered to zero off rest.
    let fieldX = 0;
    let fieldY = 0;

    const setActive = (el: HTMLElement | null) => {
      if (el === activeEl) {
        return;
      }
      if (activeEl) {
        activeEl.dataset.active = "false";
      }
      activeEl = el;
      if (el) {
        el.dataset.active = "true";
        const accent = el.style.getPropertyValue("--accent").trim();
        if (accent) {
          pin.style.setProperty("--live-accent", accent);
        }
      } else {
        pin.style.removeProperty("--live-accent");
      }
    };

    // Light a tile. At rest a lit tile is re-driven so it lifts + clears its blur in
    // place (there is no scroll frame to do it); once resolved, the grid's own
    // [data-active] CSS carries the loud look, so only the accent + flag change.
    const redrive = (el: HTMLElement | null, lit: boolean) => {
      const rig = el ? rigByEl.get(el) : undefined;
      if (rig) {
        drive(rig, lastProgress, lit, fieldX, fieldY);
      }
    };
    const light = (el: HTMLElement | null) => {
      const prev = activeEl;
      setActive(el);
      if (phase !== "rest") {
        return;
      }
      if (prev !== el) {
        redrive(prev, false);
      }
      redrive(el, true);
    };

    // The pointer / gyro moved: re-drive the rest contact sheet so it sways under the
    // new offset. Only at rest — off rest the scroll's own `apply()` owns the tiles and
    // the `(1 - m)` taper has already faded the sway, so a mid-flight tick is wasted.
    const onField = (fx: number, fy: number) => {
      fieldX = fx;
      fieldY = fy;
      if (phase !== "rest") {
        return;
      }
      for (const rig of rigs) {
        drive(rig, lastProgress, rig.el === activeEl, fieldX, fieldY);
      }
    };

    const apply = (p: number) => {
      stage.style.setProperty("--p", p.toFixed(4));
      phase = phaseFor(p, false);
      // Leaving rest drops any hover lighting so a half-formed grid is never lit.
      if (phase !== "rest" && activeEl) {
        setActive(null);
      }
      driveChrome(chrome, p, phase);
      for (const rig of rigs) {
        drive(rig, p, phase === "rest" && rig.el === activeEl, fieldX, fieldY);
        setPhase(rig, phaseFor(p, rig.showpiece));
      }
    };

    const compute = () => {
      // The morph runs over the FIRST viewport of scroll (MORPH_END of it), which is
      // also where the grid stays sticky-pinned; -top is how far the stage top has
      // scrolled above the viewport top.
      const travel = window.innerHeight;
      const top = stage.getBoundingClientRect().top;
      const raw = travel > 0 ? clamp(-top / travel, 0, 1) : 0;
      const progress = clamp(raw / MORPH_END, 0, 1);
      if (progress === lastProgress) {
        return;
      }
      lastProgress = progress;
      apply(progress);
      // The proximity snap only exists to finish a half-done morph: once resolved
      // (p === 1) drop it so the snap never re-grabs near the resolved target; restore
      // it on the way back up so it can still assist a reverse handoff.
      document.documentElement.style.scrollSnapType =
        progress >= 1 ? "none" : "y proximity";
    };

    const tileFrom = (target: EventTarget | null): HTMLElement | null =>
      target instanceof Element
        ? target.closest<HTMLElement>("a[data-key]")
        : null;
    // A tile may be lit at rest (any tile) or once resolved (live tiles only).
    const lightable = (el: HTMLElement): boolean =>
      phase === "rest" || (phase === "live" && el.dataset.phase === "live");

    const onOver = (event: PointerEvent) => {
      const el = tileFrom(event.target);
      if (el) {
        if (lightable(el)) {
          light(el);
        }
        return;
      }
      // Pointer over empty field: fall back to the keyboard-focused tile (or none),
      // exactly as the hero releases an un-hovered vessel.
      light(focusedEl);
    };
    const onLeave = () => light(focusedEl);
    const onFocusIn = (event: FocusEvent) => {
      const el = tileFrom(event.target);
      if (el && lightable(el)) {
        focusedEl = el;
        light(el);
      }
    };
    const onFocusOut = () => {
      focusedEl = null;
    };

    // Crawlable but inert until live: every tile carries its href from first paint
    // (so search crawlers can follow it to the repo), but only a live tile may
    // navigate. Off live — the at-rest contact sheet and every mid-flight frame —
    // swallow the click so a display vessel never navigates. Keyboard is gated in
    // parallel by the tile's tabindex, which setPhase drops only at the live phase.
    const onNavGuard = (event: MouseEvent) => {
      const el = tileFrom(event.target);
      if (el && el.dataset.phase !== "live") {
        event.preventDefault();
      }
    };

    // --- Keyboard entry into the contact sheet -----------------------------
    // In motion mode the work tiles are not in the tab order until the morph
    // resolves (they carry tabindex="-1" until they go live past RESOLVE_AT), and
    // the masthead is the only focusable before the stage — so a forward Tab from it
    // would skip the whole showcase. We intercept that single Tab: drive the handoff
    // to its resolved snap, then move focus onto the first landed work, so the
    // keyboard walks the same narrative the scroll tells. Everything after stays
    // native — once the tiles are live anchors the browser's own scroll-into-view
    // drives the morph, and Shift+Tab steps back to the masthead on its own. This
    // couples to the masthead link's global `.masthead__home` class (first focusable).
    let landRaf = 0;
    const onEntryTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.shiftKey || event.defaultPrevented) {
        return;
      }
      const active = document.activeElement;
      if (
        !(active instanceof HTMLElement && active.matches(".masthead__home"))
      ) {
        return;
      }
      const snap = snapResolvedRef.current;
      const firstTile = grid.querySelector<HTMLElement>("a[data-key]");
      if (!(snap && firstTile)) {
        return; // not measured yet — let the native Tab fall through
      }
      event.preventDefault();
      snap.scrollIntoView({ behavior: "smooth", block: "start" });
      // The scroll drives setPhase every frame; focus the work the instant it
      // goes live, with preventScroll so the focus call never interrupts the
      // in-flight smooth scroll.
      const deadline = performance.now() + 1500;
      const land = () => {
        if (firstTile.dataset.phase === "live") {
          firstTile.focus({ preventScroll: true });
          return;
        }
        if (performance.now() > deadline) {
          // The smooth scroll never reached resolve (blocked or aborted): land
          // the snap hard, force a phase pass, then focus so the user is never
          // stranded on the masthead.
          snap.scrollIntoView({ block: "start" });
          compute();
          firstTile.focus({ preventScroll: true });
          return;
        }
        landRaf = requestAnimationFrame(land);
      };
      landRaf = requestAnimationFrame(land);
    };

    let raf = 0;
    const onScroll = () => {
      if (raf === 0) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          compute();
        });
      }
    };
    const remeasure = () => {
      // Freeze the eased at-rest hover transition while we re-read homes. measure()
      // clears each tile's inline transform to read its true (untransformed) grid
      // box; if the `.ready` transition is live, that clear is caught mid-transition
      // (the tile is still painted at its morphed vitrine size), so getBoundingClientRect
      // reports the morphed box as "home" — collapsing the FLIP source onto the target
      // (srcScale -> 1, srcDx -> 0) so every peer resolves straight to the grid ("the
      // morph is already done at the hero"). Dropping `.ready` makes the clear instant,
      // so the read is the real grid cell; it is restored after the re-placement paints.
      const wasReady = stage.classList.contains(styles.ready);
      stage.classList.remove(styles.ready);
      measure();
      lastProgress = -1;
      compute();
      if (wasReady) {
        requestAnimationFrame(() => stage.classList.add(styles.ready));
      }
    };
    // Skip width-unchanged resizes: on touch laptops/tablets these are mobile chrome
    // changes (URL bar, soft keyboard) firing while scrolled below the pin, where the
    // live pinRect is off-screen, not real layout changes. Remeasure only on a
    // width/orientation change; the ResizeObserver still catches grid reflows.
    let lastVW = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lastVW) {
        return;
      }
      lastVW = window.innerWidth;
      remeasure();
    };

    measure();
    compute();
    // Enable the eased hover transitions only after the initial placement has
    // painted, so the first frame snaps the tiles into the contact sheet instead of
    // animating them out of the grid.
    const readyRaf = requestAnimationFrame(() =>
      stage.classList.add(styles.ready)
    );

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    // Enable the handoff's proximity scroll-snap (Part B). The document is the
    // scroller, so the snap type lives on the root element; it is scoped to the motion
    // stage's lifetime (restored on cleanup) and is `proximity` — not `mandatory` — so
    // it only assists a half-finished handoff and never traps free scroll. Reduced
    // motion never reaches here (the motion stage is gated behind no-preference), and
    // the snap uses the browser's own scroll physics, so there is no second animator.
    const rootStyle = document.documentElement.style;
    const prevSnapType = rootStyle.scrollSnapType;
    rootStyle.scrollSnapType = "y proximity";
    // The coordinator listens on the whole stage so it catches both the in-flow grid
    // peers and the absolutely-placed showpiece in the pin's vitrine layer.
    stage.addEventListener("pointerover", onOver);
    stage.addEventListener("pointerleave", onLeave);
    stage.addEventListener("focusin", onFocusIn);
    stage.addEventListener("focusout", onFocusOut);
    stage.addEventListener("click", onNavGuard);
    // Bound on the document, not the stage: the masthead link it watches lives
    // outside the stage subtree.
    document.addEventListener("keydown", onEntryTab);
    // Restore the hero's field parallax for the rest contact sheet: a fine pointer
    // (the only kind that reaches the desktop morph) sways the vessels under the cursor
    // exactly like the standalone hero. Re-drives only at rest; `drive()` fades it out
    // through the morph.
    const field = startFieldInput(pin, onField);
    // The grid box (and so the scatter deltas) can shift after web fonts swap in or
    // any reflow; re-measure so the FLIP stays true.
    //
    // The observer watches only the grid, NOT the finale below. measure() reads the
    // finale's [data-finale-landing] rect live, but caches it; when the finale's
    // <LiveInstrument> lazy-mounts on scroll-into-view it can reflow that slot and
    // leave the cached rect stale. That is harmless by construction: buildShowRig
    // uses only the slot's scroll-stable left/width, and the morph resolves within
    // the first viewport — long before the finale (and its lazy instrument) is
    // reached. If that timing contract is ever broken (a longer morph, or eagerly
    // mounting the scene), observe the finale here too so the set-aside re-aims.
    const observer = new ResizeObserver(remeasure);
    observer.observe(grid);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      stage.removeEventListener("pointerover", onOver);
      stage.removeEventListener("pointerleave", onLeave);
      stage.removeEventListener("focusin", onFocusIn);
      stage.removeEventListener("focusout", onFocusOut);
      stage.removeEventListener("click", onNavGuard);
      document.removeEventListener("keydown", onEntryTab);
      field.stop();
      observer.disconnect();
      if (raf !== 0) {
        cancelAnimationFrame(raf);
      }
      if (landRaf !== 0) {
        cancelAnimationFrame(landRaf);
      }
      cancelAnimationFrame(readyRaf);
      stage.classList.remove(styles.ready);
      for (const rig of rigs) {
        restoreRig(rig);
      }
      grain.style.opacity = "";
      vignette.style.opacity = "";
      copy.style.opacity = "";
      copy.style.transform = "";
      baton.style.opacity = "";
      label.style.opacity = "";
      pin.style.removeProperty("--live-accent");
      pin.removeAttribute("data-settling");
      stage.style.height = "";
      rootStyle.scrollSnapType = prevSnapType;
    };
  }, []);

  return (
    <div className={styles.stage} ref={stageRef}>
      <div className={styles.pin} ref={pinRef}>
        <div className={styles.tint} />
        <div className={styles.grain} ref={grainRef} />

        {/* the showpiece tile — its DOM home is the contact sheet, never the grid;
            it sets itself aside off-screen, aimed at the finale's landing slot when
            the attractor is present below the grid (else straight down) */}
        <div className={styles.vitrine} ref={vitrineRef}>
          <ProjectTile model={SHOWPIECE_MODEL} priority />
        </div>

        <div className={styles.vignette} ref={vignetteRef} />

        <div className={`vitrine__copy ${styles.copy}`} ref={copyRef}>
          <p className="eyebrow">{content.hero.eyebrow}</p>
          <h1 aria-label={content.hero.thesis} className="thesis">
            {content.hero.thesisLines.map((line) => (
              <span className="thesis__line" key={line}>
                {line}
              </span>
            ))}
          </h1>
          <p className="subline">{content.hero.subline}</p>
        </div>

        <p className={`scroll-baton ${styles.baton}`} ref={batonRef}>
          {content.hero.scrollBaton}
        </p>
      </div>

      {/* the resolved 2x2's home — pulled up over the pinned contact sheet (negative
          margin) and BROWSER-PINNED there (position: sticky) for the morph, so the
          four peer tiles morph across it by pure transform with no JS scroll
          compensation (no jitter). When the morph completes the sticky releases and
          this scrolls away as a plain grid, read to its end. */}
      <div className={styles.gridStick} ref={gridRef}>
        <section className={proofStyles.section}>
          {/* the grid's section title — invisible over the contact sheet, handed in
              by the stage (opacity on --p) as the 2x2 settles, so it reads as the
              title of the resolved grid. It lives in the sticky grid, so it carries
              no scroll term (no jitter). */}
          <h2 className={proofStyles.label} ref={labelRef}>
            {content.work.label}
          </h2>
          <ul className={proofStyles.grid}>
            {PEER_MODELS.map((model) => (
              <li className={proofStyles.item} key={model.key}>
                <ProjectTile model={model} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* the two handoff snap points (Part B): invisible, zero-size proximity snap
          targets — one at the contact-sheet rest (the stage top) and one at the
          resolved grid (the morph's release, positioned from JS in measure() so it
          tracks the pin distance). With `scroll-snap-type: y proximity` on the
          document (set only while the motion stage is mounted), the browser's own
          scroll physics gently completes a half-finished handoff to the nearer end
          when the scroll comes to rest mid-morph, and never traps free scroll —
          below the resolved point there are no snap targets, so the grid and the rest
          of the page scroll normally. */}
      <div className={`${styles.snap} ${styles.snapRest}`} />
      <div className={styles.snap} ref={snapResolvedRef} />
    </div>
  );
}
