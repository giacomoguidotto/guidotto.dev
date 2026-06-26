"use client";

// Stage — the scroll choreography that ties the hero contact sheet and the proof
// grid into one continuous scroll story (Option C: the showpiece is excluded from
// the grid).
//
// Deep module: <Stage /> is the entire interface. Behind it sit two presentations
// and one physics:
//
//   - PLAIN (the default, and what reduced-motion / coarse pointer / narrow / no-JS
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
import { ShowcaseRoot } from "~/components/showcase/showcase-root";
import { content, type Project } from "~/content";
import { ProjectTile, type TileModel } from "./project-tile";
import styles from "./stage.module.css";

type Mode = "plain" | "motion";
type Phase = "rest" | "flight" | "live";

// The morph is enhancement-only: it needs a fine pointer (to read the contact
// sheet), motion permission, and enough width for the 2x2 (above the grid's own
// 40rem carousel switch, so the two layouts never fight). Everything else gets the
// plain sectioned story.
const MOTION_QUERY =
  "(pointer: fine) and (prefers-reduced-motion: no-preference) and (min-width: 48rem)";

// The morph completes over the first MORPH_END of the one-viewport pin; the rest is
// a hold where the resolved grid reads as a normal grid before the page continues.
const MORPH_END = 0.8;
// At/below this progress the tiles are the live, interactive hero contact sheet;
// the first whiff of scroll hands interaction to the resolving grid.
const HERO_REST = 0.02;
// Above this progress the resolved cards are navigable / focusable.
const RESOLVE_AT = 0.85;

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
  readonly depthBlur: number;
  readonly depthOpacity: number;
  readonly el: HTMLElement;
  // The poster (data-poster) wears the depth blur + corner; both scale-compensated.
  readonly poster: HTMLElement;
  readonly repoUrl: string;
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
  const vCy = pinRect.top + place.y * pinRect.height;
  const vW = vitrineWidth(place, rem, vw);
  return {
    caption: child(el, "[data-caption]"),
    depthBlur: DEPTH_BLUR[place.depth],
    depthOpacity: DEPTH_OPACITY[place.depth],
    el,
    poster,
    repoUrl: el.dataset.href ?? "",
    showpiece: false,
    srcDx: vCx - homeCx,
    srcDy: vCy - homeCy,
    srcScale: vW / home.w,
    tag: child(el, "[data-tag]"),
    tgtDx: 0,
    tgtDy: 0,
    tgtScale: 1,
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
const buildShowRig = (
  el: HTMLElement,
  pinRect: DOMRect,
  rem: number,
  vw: number,
  landing: DOMRect | null
): Rig | null => {
  const place = placementFor(el);
  const poster = child(el, "[data-poster]");
  if (!(place && poster)) {
    return null;
  }
  const vW = vitrineWidth(place, rem, vw);
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
    poster,
    repoUrl: "",
    showpiece: true,
    srcDx: 0,
    srcDy: 0,
    srcScale: 1,
    tag: child(el, "[data-tag]"),
    tgtDx: tgtCx - home.cx,
    tgtDy: tgtCy - home.cy,
    tgtScale,
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
const drive = (rig: Rig, p: number, lit: boolean) => {
  const m = smoothstep(0, 0.72, p);
  const dx = lerp(rig.srcDx, rig.tgtDx, m);
  const dy = lerp(rig.srcDy, rig.tgtDy, m);
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

const setPhase = (rig: Rig, phase: Phase) => {
  rig.el.dataset.phase = phase;
  if (phase === "live") {
    rig.el.setAttribute("href", rig.repoUrl);
  } else {
    rig.el.removeAttribute("href");
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

// The contact-sheet chrome hands the baton out: the grain and vignette dissolve, the
// thesis rises + fades, the scroll cue drops. The accent wash is owned by the
// coordinator at rest (hover) and once resolved (the lit card); only mid-flight does
// the chrome release it, so a half-formed grid never carries a stale tint.
const driveChrome = (chrome: Chrome, p: number, phase: Phase) => {
  chrome.grain.style.opacity = (0.11 * (1 - smoothstep(0.2, 0.6, p))).toFixed(
    3
  );
  chrome.vignette.style.opacity = (1 - smoothstep(0.25, 0.62, p)).toFixed(3);
  chrome.copy.style.opacity = (1 - smoothstep(0.3, 0.66, p)).toFixed(3);
  chrome.copy.style.transform = `translate(-50%, calc(-50% - ${(p * 2).toFixed(3)}rem))`;
  chrome.baton.style.opacity = (1 - Math.min(1, p * 6)).toFixed(3);
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
  rig.el.removeAttribute("href");
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

export function Stage() {
  // Default to plain so SSR and the first client render agree; the effect upgrades to
  // motion only where it is welcome.
  const [mode, setMode] = useState<Mode>("plain");

  useEffect(() => {
    const mql = window.matchMedia(MOTION_QUERY);
    const sync = () => setMode(mql.matches ? "motion" : "plain");
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  if (mode === "motion") {
    return <MotionStage />;
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
        drive(rig, lastProgress, lit);
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

    const apply = (p: number) => {
      stage.style.setProperty("--p", p.toFixed(4));
      phase = phaseFor(p, false);
      // Leaving rest drops any hover lighting so a half-formed grid is never lit.
      if (phase !== "rest" && activeEl) {
        setActive(null);
      }
      driveChrome(chrome, p, phase);
      for (const rig of rigs) {
        drive(rig, p, phase === "rest" && rig.el === activeEl);
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

    measure();
    compute();
    // Enable the eased hover transitions only after the initial placement has
    // painted, so the first frame snaps the tiles into the contact sheet instead of
    // animating them out of the grid.
    const readyRaf = requestAnimationFrame(() =>
      stage.classList.add(styles.ready)
    );

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", remeasure);
    // The coordinator listens on the whole stage so it catches both the in-flow grid
    // peers and the absolutely-placed showpiece in the pin's vitrine layer.
    stage.addEventListener("pointerover", onOver);
    stage.addEventListener("pointerleave", onLeave);
    stage.addEventListener("focusin", onFocusIn);
    stage.addEventListener("focusout", onFocusOut);
    // The grid box (and so the scatter deltas) can shift after web fonts swap in or
    // any reflow; re-measure so the FLIP stays true.
    const observer = new ResizeObserver(remeasure);
    observer.observe(grid);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", remeasure);
      stage.removeEventListener("pointerover", onOver);
      stage.removeEventListener("pointerleave", onLeave);
      stage.removeEventListener("focusin", onFocusIn);
      stage.removeEventListener("focusout", onFocusOut);
      observer.disconnect();
      if (raf !== 0) {
        cancelAnimationFrame(raf);
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
          <ProjectTile model={SHOWPIECE_MODEL} />
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
    </div>
  );
}
