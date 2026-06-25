"use client";

// Stage — the scroll choreography that ties the hero contact sheet and the proof
// grid into one continuous scroll story (Option C: the showpiece is excluded from
// the grid and sets itself aside).
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
//     (2026-06-25): one DOM node per project"). A sticky pin holds the scene for ~one
//     viewport of free scrolling (a visual pin, never a scroll-jack); a single
//     scroll-progress --p carries the four peer tiles from their scattered contact
//     sheet onto a centred 2x2 (transform + opacity), clears each tile's depth blur
//     soft -> sharp (the hero's filter:blur, cornering down to the card radius),
//     assembles the captions in, hands the thesis
//     baton out, and slides the AnyPINN showpiece off-stage (a curatorial set-aside).
//     A tile is a calm, non-navigating display vessel until it resolves, at which
//     point the stage gives it back its href + interactivity (behaviour swapped at
//     the boundary, events blocked mid-flight).
//
// The morph is transform / opacity only (GPU-composited, zero reflow), driven
// imperatively so there is no per-frame React work. Once resolved, a tiny single-
// active-card coordinator (hover / keyboard focus -> one lit accent) makes the grid
// behave like the standalone grid it reuses the CSS of.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Hero } from "~/components/hero";
import { ProofGrid } from "~/components/proof-grid/proof-grid";
import proofStyles from "~/components/proof-grid/proof-grid.module.css";
import { ShowcaseRoot } from "~/components/showcase/showcase-root";
import { content, type Project } from "~/content";
import { ProjectTile, type TileModel } from "./project-tile";
import styles from "./stage.module.css";

type Mode = "plain" | "motion";

// The morph is enhancement-only: it needs a fine pointer (to read the contact
// sheet), motion permission, and enough width for the 2x2 (above the grid's own
// 40rem carousel switch, so the two layouts never fight). Everything else gets the
// plain sectioned story.
const MOTION_QUERY =
  "(pointer: fine) and (prefers-reduced-motion: no-preference) and (min-width: 48rem)";

// The morph completes over the first MORPH_END of the one-viewport pin; the rest is
// a hold where the resolved grid reads as a normal grid before the page continues.
const MORPH_END = 0.8;
// Below this progress the half-formed cards are not yet navigable / focusable.
const RESOLVE_AT = 0.85;

// The corner softens at rest (a rounder vitrine vessel) and tightens to the proof
// card's own 1.4rem as the tile lands; both in rem, interpolated across the morph.
const REST_RADIUS = 2.4;
const CARD_RADIUS = 1.4;

const clamp = (value: number, lo: number, hi: number): number =>
  Math.min(Math.max(value, lo), hi);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// Smooth (ease-in-out) ramp between two edges; the whole choreography is phrased as
// overlapping smoothsteps on --p so there is no piecewise CSS and no jerk.
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the vitrine contact sheet placement (ported from the hero) ----

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

// Depth -> the contact sheet's static blur radius and recede opacity (the hero's
// own depth-of-field values). The poster wears the blur directly (filter: blur),
// exactly as the hero vessel does, and the stage fades the radius to 0 on landing.
const DEPTH_BLUR: Record<1 | 2 | 3, number> = { 1: 1.5, 2: 4, 3: 8 };
const DEPTH_OPACITY: Record<1 | 2 | 3, number> = { 1: 0.9, 2: 0.74, 3: 0.52 };

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

// One tile measured for the morph: its node plus the FLIP delta from its grid home
// out to its vitrine scatter point (peers) or just its recede opacity (showpiece).
interface Rig {
  readonly caption: HTMLElement | null;
  readonly depthBlur: number;
  readonly depthOpacity: number;
  readonly el: HTMLElement;
  // The poster (data-poster) wears the depth blur + softened corner directly.
  readonly poster: HTMLElement;
  readonly repoUrl: string;
  readonly showpiece: boolean;
  // FLIP delta + target scale: grid home -> vitrine scatter (peers only).
  readonly vscale: number;
  readonly vx: number;
  readonly vy: number;
}

const child = (el: HTMLElement, selector: string): HTMLElement | null =>
  el.querySelector<HTMLElement>(selector);

const placementFor = (el: HTMLElement): VitrinePlacement | undefined => {
  const key = el.dataset.key;
  return key ? VITRINE[key] : undefined;
};

// The hero's vessel sizing: a fixed rem width, clamped down only in the final
// sliver before the portrait re-author (which motion mode never reaches).
const vitrineWidth = (
  place: VitrinePlacement,
  rem: number,
  vw: number
): number => clamp(9 * rem, 0.4 * vw, place.w * rem);

// Measure a peer tile at its grid home (transform cleared) and derive the FLIP that
// places its poster at the vitrine scatter point. Returns null for an unplaced key.
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
  el.style.transform = "";
  el.style.opacity = "";
  const g = poster.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const posterCx = g.left + g.width / 2;
  const posterCy = g.top + g.height / 2;
  el.style.transformOrigin = `${(posterCx - elRect.left).toFixed(2)}px ${(posterCy - elRect.top).toFixed(2)}px`;
  const vCx = pinRect.left + place.x * pinRect.width;
  const vCy = pinRect.top + place.y * pinRect.height;
  return {
    caption: child(el, "[data-caption]"),
    depthBlur: DEPTH_BLUR[place.depth],
    depthOpacity: DEPTH_OPACITY[place.depth],
    el,
    poster,
    repoUrl: el.dataset.href ?? "",
    showpiece: false,
    vscale: vitrineWidth(place, rem, vw) / g.width,
    vx: vCx - posterCx,
    vy: vCy - posterCy,
  };
};

// The showpiece is absolutely placed in the vitrine (its DOM home is the sheet, not
// the grid) and sets itself aside; size + position it here, drive the exit later.
const buildShowRig = (
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
  const w = vitrineWidth(place, rem, vw);
  el.style.position = "absolute";
  el.style.width = `${w.toFixed(2)}px`;
  // The poster is square; pin the card's height to it. Without this the card keeps
  // the proof grid's `height: 100%`, fills the whole pin once absolute, and the
  // centring translate(-50%) lifts the poster off the top of the screen.
  el.style.height = `${w.toFixed(2)}px`;
  el.style.left = `${(place.x * pinRect.width).toFixed(2)}px`;
  el.style.top = `${(place.y * pinRect.height).toFixed(2)}px`;
  el.style.transformOrigin = "50% 50%";
  // The showpiece never resolves into a card, so its softness + rounder corner stay
  // at the rest values the whole time it lingers and then sets itself aside.
  poster.style.filter = `blur(${DEPTH_BLUR[place.depth].toFixed(2)}px)`;
  poster.style.borderRadius = `${REST_RADIUS}rem`;
  return {
    caption: null,
    depthBlur: DEPTH_BLUR[place.depth],
    depthOpacity: DEPTH_OPACITY[place.depth],
    el,
    poster,
    repoUrl: "",
    showpiece: true,
    vscale: 1,
    vx: 0,
    vy: 0,
  };
};

// Drive one peer for the current --p: it slides + scales from its scatter point back
// to its grid home, the hero's filter:blur on its poster clears soft -> sharp, its
// corner tightens to the card radius, its caption assembles in, and at the resolve
// threshold it regains its href + navigability.
const drivePeer = (rig: Rig, p: number) => {
  const morph = smoothstep(0, 0.72, p);
  const vit = 1 - morph;
  rig.el.style.transform = `translate3d(${(rig.vx * vit).toFixed(2)}px, ${(rig.vy * vit).toFixed(2)}px, 0) scale(${(1 + (rig.vscale - 1) * vit).toFixed(4)})`;
  rig.el.style.opacity = lerp(rig.depthOpacity, 1, morph).toFixed(3);
  const blur = rig.depthBlur * vit;
  rig.poster.style.filter = blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : "none";
  rig.poster.style.borderRadius = `${lerp(REST_RADIUS, CARD_RADIUS, morph).toFixed(3)}rem`;
  if (rig.caption) {
    rig.caption.style.opacity = smoothstep(0.62, 0.96, p).toFixed(3);
  }
  const live = p > RESOLVE_AT;
  rig.el.dataset.live = live ? "true" : "false";
  if (live) {
    rig.el.setAttribute("href", rig.repoUrl);
  } else {
    rig.el.removeAttribute("href");
    rig.el.dataset.active = "false";
  }
};

// The showpiece gives a brief "wait for me" lift, then slides off the left with a
// fade tail (a curatorial set-aside, never a vanish). It never joins the grid.
const driveShowpiece = (rig: Rig, p: number) => {
  const lift = smoothstep(0, 0.18, p);
  const exit = smoothstep(0.2, 0.62, p);
  const slideX = -exit * window.innerWidth * 0.95;
  const liftY = -lift * 16 - exit * 36;
  rig.el.style.transform = `translate(calc(-50% + ${slideX.toFixed(1)}px), calc(-50% + ${liftY.toFixed(1)}px))`;
  rig.el.style.opacity = ((1 - exit) * rig.depthOpacity).toFixed(3);
};

interface Chrome {
  readonly baton: HTMLElement;
  readonly copy: HTMLElement;
  readonly grain: HTMLElement;
  readonly pin: HTMLElement;
  readonly vignette: HTMLElement;
}

// The contact-sheet chrome hands the baton out: the grain and vignette dissolve, the
// thesis rises + fades, the scroll cue drops, and the accent wash is released until a
// resolved card re-lights it.
const driveChrome = (chrome: Chrome, p: number) => {
  chrome.grain.style.opacity = (0.11 * (1 - smoothstep(0.2, 0.6, p))).toFixed(
    3
  );
  chrome.vignette.style.opacity = (1 - smoothstep(0.25, 0.62, p)).toFixed(3);
  chrome.copy.style.opacity = (1 - smoothstep(0.3, 0.66, p)).toFixed(3);
  chrome.copy.style.transform = `translate(-50%, calc(-50% - ${(p * 2).toFixed(3)}rem))`;
  chrome.baton.style.opacity = (1 - Math.min(1, p * 6)).toFixed(3);
  chrome.pin.dataset.settling = p > 0.001 && p < 0.999 ? "true" : "false";
  if (p <= RESOLVE_AT) {
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
  rig.el.removeAttribute("data-live");
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

    let peers: Rig[] = [];
    let show: Rig | null = null;

    // FLIP measurement: read each tile's grid home, then derive the transform that
    // parks it in the contact sheet (peers) / size + place the showpiece (sheet only).
    const measure = () => {
      const pinRect = pin.getBoundingClientRect();
      const rem =
        Number.parseFloat(
          getComputedStyle(document.documentElement).fontSize
        ) || 16;
      const vw = window.innerWidth;
      peers = [];
      for (const el of grid.querySelectorAll<HTMLElement>("a[data-key]")) {
        const rig = buildPeerRig(el, pinRect, rem, vw);
        if (rig) {
          peers.push(rig);
        }
      }
      const showEl = vitrine.querySelector<HTMLElement>("a[data-key]");
      show = showEl ? buildShowRig(showEl, pinRect, rem, vw) : null;
    };

    const apply = (p: number) => {
      stage.style.setProperty("--p", p.toFixed(4));
      driveChrome(chrome, p);
      for (const rig of peers) {
        drivePeer(rig, p);
      }
      if (show) {
        driveShowpiece(show, p);
      }
    };

    let lastProgress = -1;
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

    // Resolved-grid coordinator: hover / keyboard focus lights exactly one card and
    // writes the one --live-accent, so the grid behaves like the standalone grid.
    // Tiles below the resolve threshold are not live, so events never reach them.
    let activeEl: HTMLElement | null = null;
    let focusedEl: HTMLElement | null = null;
    const tileFrom = (target: EventTarget | null): HTMLElement | null =>
      target instanceof Element
        ? target.closest<HTMLElement>("a[data-key]")
        : null;
    const light = (el: HTMLElement | null) => {
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
    const onOver = (event: PointerEvent) => {
      const el = tileFrom(event.target);
      if (el?.dataset.live === "true") {
        light(el);
      }
    };
    const onLeave = () => light(focusedEl);
    const onFocusIn = (event: FocusEvent) => {
      const el = tileFrom(event.target);
      if (el?.dataset.live === "true") {
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
      measure();
      lastProgress = -1;
      compute();
    };

    measure();
    compute();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", remeasure);
    grid.addEventListener("pointerover", onOver);
    grid.addEventListener("pointerleave", onLeave);
    grid.addEventListener("focusin", onFocusIn);
    grid.addEventListener("focusout", onFocusOut);
    // The grid box (and so the scatter deltas) can shift after web fonts swap in or
    // any reflow; re-measure so the FLIP stays true.
    const observer = new ResizeObserver(remeasure);
    observer.observe(grid);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", remeasure);
      grid.removeEventListener("pointerover", onOver);
      grid.removeEventListener("pointerleave", onLeave);
      grid.removeEventListener("focusin", onFocusIn);
      grid.removeEventListener("focusout", onFocusOut);
      observer.disconnect();
      if (raf !== 0) {
        cancelAnimationFrame(raf);
      }
      for (const rig of peers) {
        restoreRig(rig);
      }
      if (show) {
        restoreRig(show);
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

        {/* the showpiece tile — present in the sheet, never in the grid; it sets
            itself aside */}
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
