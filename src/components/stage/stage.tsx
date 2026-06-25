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
//   - the showpiece targets a point just BELOW the grid, off-screen (its DOM home
//     IS the contact sheet, so source = home and it simply slides off as a
//     curatorial set-aside). Today that target is "below the grid"; it is the seam
//     where the finale (#9) will retarget it onto the live attractor instead.
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

// One tile measured for the morph. Every vessel — peer or showpiece — is this same
// shape: a SOURCE (vitrine) and a TARGET expressed as the poster centre's offset
// from the tile's DOM home (px) plus a scale relative to the home poster width. The
// morph lerps src -> tgt:
//   - peers home in the grid, so tgt is identity (they land in their cell) and src
//     is the vitrine offset;
//   - the showpiece homes in the vitrine, so src is identity and tgt carries it off
//     below the grid.
interface Rig {
  readonly caption: HTMLElement | null;
  readonly depthBlur: number;
  readonly depthOpacity: number;
  readonly el: HTMLElement;
  // The poster (data-poster) wears the depth blur + corner; both scale-compensated.
  readonly poster: HTMLElement;
  readonly repoUrl: string;
  readonly showpiece: boolean;
  readonly srcDx: number;
  readonly srcDy: number;
  readonly srcScale: number;
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

// Measure a peer tile at its grid home and derive the vitrine SOURCE it parks at;
// its target is its own cell (identity). Returns null for an unplaced key.
const buildPeerRig = (
  el: HTMLElement,
  pinRect: DOMRect,
  rem: number,
  vw: number
): Rig | null => {
  const place = placementFor(el);
  const poster = child(el, "[data-poster]");
  if (!(place && poster)) {
    return null;
  }
  const home = anchorPoster(el, poster);
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
    srcDx: vCx - home.cx,
    srcDy: vCy - home.cy,
    srcScale: vW / home.w,
    tgtDx: 0,
    tgtDy: 0,
    tgtScale: 1,
  };
};

// Size + place the showpiece at its vitrine point at natural size (its DOM home IS
// the contact sheet), so SOURCE is identity and blur/corner never scale. Its TARGET
// is just below the grid, off-screen — the curatorial set-aside, and the seam the
// finale will later retarget onto the live attractor.
const buildShowRig = (
  el: HTMLElement,
  pinRect: DOMRect,
  gridRect: DOMRect | null,
  rem: number,
  vw: number
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
  // Below the grid (its centre x), dropped a full height past the grid's bottom so
  // it parks off-screen. Falls back to the pin's bottom edge if the grid box is not
  // measurable yet.
  const tgtCx = gridRect ? gridRect.left + gridRect.width / 2 : home.cx;
  const tgtBottom = gridRect ? gridRect.bottom : pinRect.bottom;
  const tgtCy = tgtBottom + vW;
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
    tgtDx: tgtCx - home.cx,
    tgtDy: tgtCy - home.cy,
    tgtScale: 1,
  };
};

// Drive one vessel for the current --p (and whether it is the lit one at rest).
// Identical for all five: lerp source -> target (translate + scale about the poster
// centre), clear the depth blur soft -> sharp, assemble the caption in. The blur and
// corner are divided by the live scale so the ON-SCREEN values are exactly the
// hero's (per-depth blur, 1.4rem corner) regardless of the FLIP scale.
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
    const chrome: Chrome = { baton, copy, grain, pin, vignette };

    let rigs: Rig[] = [];
    const rigByEl = new Map<HTMLElement, Rig>();

    // FLIP measurement: read each tile's home, then derive its vitrine source and
    // its target (the peers' cell / the showpiece's off-screen park below the grid).
    const measure = () => {
      const pinRect = pin.getBoundingClientRect();
      const gridBox =
        grid.querySelector<HTMLElement>("ul")?.getBoundingClientRect() ?? null;
      const rem =
        Number.parseFloat(
          getComputedStyle(document.documentElement).fontSize
        ) || 16;
      const vw = window.innerWidth;
      rigs = [];
      rigByEl.clear();
      for (const el of grid.querySelectorAll<HTMLElement>("a[data-key]")) {
        const rig = buildPeerRig(el, pinRect, rem, vw);
        if (rig) {
          rigs.push(rig);
          rigByEl.set(el, rig);
        }
      }
      const showEl = vitrine.querySelector<HTMLElement>("a[data-key]");
      const showRig = showEl
        ? buildShowRig(showEl, pinRect, gridBox, rem, vw)
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
      const denom = stage.offsetHeight - window.innerHeight;
      const top = stage.getBoundingClientRect().top;
      const raw = denom > 0 ? clamp(-top / denom, 0, 1) : 0;
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
      const wasReady = pin.classList.contains(styles.ready);
      pin.classList.remove(styles.ready);
      measure();
      lastProgress = -1;
      compute();
      if (wasReady) {
        requestAnimationFrame(() => pin.classList.add(styles.ready));
      }
    };

    measure();
    compute();
    // Enable the eased hover transitions only after the initial placement has
    // painted, so the first frame snaps the tiles into the contact sheet instead of
    // animating them out of the grid.
    const readyRaf = requestAnimationFrame(() =>
      pin.classList.add(styles.ready)
    );

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", remeasure);
    // The coordinator listens on the whole pin so it catches both the grid peers and
    // the absolutely-placed showpiece in the vitrine layer.
    pin.addEventListener("pointerover", onOver);
    pin.addEventListener("pointerleave", onLeave);
    pin.addEventListener("focusin", onFocusIn);
    pin.addEventListener("focusout", onFocusOut);
    // The grid box (and so the scatter deltas) can shift after web fonts swap in or
    // any reflow; re-measure so the FLIP stays true.
    const observer = new ResizeObserver(remeasure);
    observer.observe(grid);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", remeasure);
      pin.removeEventListener("pointerover", onOver);
      pin.removeEventListener("pointerleave", onLeave);
      pin.removeEventListener("focusin", onFocusIn);
      pin.removeEventListener("focusout", onFocusOut);
      observer.disconnect();
      if (raf !== 0) {
        cancelAnimationFrame(raf);
      }
      cancelAnimationFrame(readyRaf);
      pin.classList.remove(styles.ready);
      for (const rig of rigs) {
        restoreRig(rig);
      }
      grain.style.opacity = "";
      vignette.style.opacity = "";
      copy.style.opacity = "";
      copy.style.transform = "";
      baton.style.opacity = "";
      pin.style.removeProperty("--live-accent");
      pin.removeAttribute("data-settling");
    };
  }, []);

  return (
    <div className={styles.stage} ref={stageRef}>
      <div className={styles.pin} ref={pinRef}>
        <div className={styles.tint} />
        <div className={styles.grain} ref={grainRef} />

        {/* the resolved 2x2's DOM home — the four peer tiles live here in grid flow,
            parked out in the contact sheet at rest and carried back on scroll */}
        <div className={styles.gridHome} ref={gridRef}>
          <section className={proofStyles.section}>
            <ul className={proofStyles.grid}>
              {PEER_MODELS.map((model) => (
                <li className={proofStyles.item} key={model.key}>
                  <ProjectTile model={model} />
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* the showpiece tile — its DOM home is the contact sheet, never the grid;
            it sets itself aside toward a point just below the grid */}
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
    </div>
  );
}
