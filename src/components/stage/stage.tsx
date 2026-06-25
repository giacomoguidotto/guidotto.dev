"use client";

// Stage — the scroll choreography that ties the hero contact sheet and the proof
// grid into one continuous scroll story (Option C: the showpiece is excluded from
// the grid and sets itself aside). This is the enhancement layer over the plain
// hero (#4) and grid (#3); the plain sectioned versions those slices ship are the
// reduced-motion / fallback presentation.
//
// Deep module: <Stage /> is the entire interface. Behind it sit two presentations
// and one physics:
//
//   - PLAIN (the default, and what reduced-motion / coarse pointer / narrow /
//     no-JS always get): the already-verified <Hero /> then <ProofGrid /> as two
//     stacked sections. Server-rendered, indexable, fully legible. This is also
//     the SSR + first-client-render output, so there is never a hydration
//     mismatch; the morph is layered on only after mount, and only where welcome.
//
//   - MOTION (a progressive enhancement on motion-welcome fine pointers wide
//     enough for the 2x2): the SAME curated <Hero /> is the at-rest contact sheet
//     (so the initial frame is pixel-identical to the standalone hero — this
//     branch only adds the handoff, it never re-authors the hero). A sticky pin
//     holds the stage for ~one viewport of free scrolling (a visual pin, never a
//     scroll-jack or scroll-lock), while a single scroll-progress property --p
//     drives the handoff: the hero's own vitrine vessels travel out toward the
//     2x2 while the real <ProofGrid /> cross-fades in beneath them at those exact
//     spots (a position-matched dissolve — the spec's sanctioned shared-element
//     fallback, kept here because the vitrine vessels and the proof cards are
//     deliberately different components owned by different slices). The thesis
//     hands the baton (rises + fades); the AnyPINN showpiece vessel gives a brief
//     "wait for me" lift then slides off-stage (a curatorial set-aside, never a
//     vanish), seeding the "where did it go" loop the finale (#9) pays off.
//
// The morph is transform / opacity only (GPU-composited, zero reflow). The hero
// vessel travel is measured and written imperatively from JS (an internal seam,
// driving the already-rendered DOM of the composed hero / grid — never editing
// their source); the layer cross-fade and accent tint read --p / the earned
// --live-accent straight from CSS. There is no per-frame React work and no
// animated blur radius: the contact-sheet softness is the hero's own static,
// depth-led blur, and it resolves soft -> sharp simply by cross-fading out as the
// sharp grid cards cross-fade in (the "develops like a photograph" beat, for
// free). The grid keeps its own single-active-card coordinator, captions, and
// repo links untouched, so once resolved it behaves exactly like the standalone.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Hero } from "~/components/hero";
import { ProofGrid } from "~/components/proof-grid/proof-grid";
import proofStyles from "~/components/proof-grid/proof-grid.module.css";
import { ShowcaseRoot } from "~/components/showcase/showcase-root";
import { content } from "~/content";
import styles from "./stage.module.css";

type Mode = "plain" | "motion";

// The morph is enhancement-only: it needs a fine pointer (hover precision to read
// the contact sheet), motion permission, and enough width for the 2x2 (below the
// grid's own 40rem carousel switch, so the two layouts never fight). Everything
// else gets the plain sectioned story. One query covers all three so a reduced-
// motion toggle, an input-mode switch, or a resize across the threshold all flip
// the presentation live.
const MOTION_QUERY =
  "(pointer: fine) and (prefers-reduced-motion: no-preference) and (min-width: 48rem)";

// The morph completes over the first MORPH_END of the track's one-viewport pin;
// the remaining sliver is a hold where the resolved grid reads as a normal grid
// before the page continues (so the settle is bounded, never a journey).
const MORPH_END = 0.8;
// Below this progress the half-formed grid is not yet meant to be clicked.
const RESOLVE_AT = 0.85;
// The hero is the live, interactive contact sheet only while genuinely at rest;
// the first whiff of scroll hands interaction to the resolving grid.
const HERO_REST = 0.02;

const clamp = (value: number, lo: number, hi: number): number =>
  Math.min(Math.max(value, lo), hi);

// Smooth (ease-in-out) ramp between two edges; the whole choreography is phrased
// as overlapping smoothsteps on --p so there is no piecewise CSS and no jerk.
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export function Stage() {
  // Default to plain so SSR and the first client render agree; the effect upgrades
  // to motion only where it is welcome.
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
// verified deep modules (the grid on the same cool stage + accent tint as its own
// standalone preview). No morph, no set-aside.
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

// One hero vitrine vessel under the morph: its DOM node (the `.case` wrapper) plus
// either the FLIP delta onto its matching grid card (project peers) or a flag that
// it is the showpiece (which sets itself aside instead of joining the grid).
interface MorphVessel {
  // FLIP delta + target scale onto the grid card's square poster (project peers).
  readonly dx: number;
  readonly dy: number;
  readonly el: HTMLElement;
  readonly scale: number;
  readonly showpiece: boolean;
}

// Resolve a vitrine vessel's content key from its visible tag label (the vessels
// expose no key, but each prints its subject label, which is unique). Built once
// from the canonical content surface, so it never couples to the hero's internal
// plane ordering.
const KEY_BY_LABEL = new Map<string, string>(
  [content.showpiece, ...content.projects].map((s) => [s.label, s.key])
);

// A grid card's morph target: the centre + width of its square poster, in pin
// coordinates (the poster is a full-width square pinned to the card top, so its
// centre is half a width below the card top — independent of caption height,
// which web-font swaps can still be shifting at measure time).
interface MorphTarget {
  readonly cx: number;
  readonly cy: number;
  readonly w: number;
}

// The eased phase of the handoff at a given --p, shared by every vessel.
interface MorphPhase {
  readonly atRest: boolean;
  readonly exit: number;
  readonly lift: number;
  readonly travel: number;
}

const collectTargets = (
  grid: HTMLElement,
  pinRect: DOMRect
): Map<string, MorphTarget> => {
  const targets = new Map<string, MorphTarget>();
  for (const cell of grid.querySelectorAll<HTMLElement>("[data-key]")) {
    const r = cell.getBoundingClientRect();
    targets.set(cell.dataset.key ?? "", {
      cx: r.left - pinRect.left + r.width / 2,
      cy: r.top - pinRect.top + r.width / 2,
      w: r.width,
    });
  }
  return targets;
};

// Resolve a vessel's content key from its visible tag label.
const vesselKey = (el: HTMLElement): string | undefined => {
  const label = el.querySelector(".vessel__tag")?.textContent?.trim();
  return label ? KEY_BY_LABEL.get(label) : undefined;
};

// Measure one hero vessel into a MorphVessel: pause its float + clear any prior
// transform so the read is its true rest box, then derive the FLIP delta onto its
// peer card. The showpiece is tagged for the set-aside; an unmatched vessel
// (renamed/removed content) is skipped.
const buildVessel = (
  el: HTMLElement,
  targets: Map<string, MorphTarget>,
  pinRect: DOMRect,
  showpieceKey: string
): MorphVessel | null => {
  const key = vesselKey(el);
  el.style.transform = "";
  el.style.animation = "none";
  const r = el.getBoundingClientRect();
  if (key === showpieceKey) {
    return { el, showpiece: true, dx: 0, dy: 0, scale: 1 };
  }
  const target = key ? targets.get(key) : undefined;
  if (!target) {
    return null;
  }
  return {
    el,
    showpiece: false,
    dx: target.cx - (r.left - pinRect.left + r.width / 2),
    dy: target.cy - (r.top - pinRect.top + r.height / 2),
    scale: target.w / r.width,
  };
};

// Hand the vessels back to their CSS float (the at-rest hero is exactly the
// standalone hero).
const restVessel = (el: HTMLElement) => {
  el.style.transform = "";
  el.style.opacity = "";
  el.style.animation = "";
};

// Drive one vessel for the current phase: project peers FLIP onto their card; the
// showpiece lifts then slides off the left with a fade tail.
const driveVessel = (v: MorphVessel, phase: MorphPhase) => {
  if (phase.atRest) {
    restVessel(v.el);
    return;
  }
  v.el.style.animation = "none";
  if (v.showpiece) {
    const tx = -phase.exit * window.innerWidth * 0.95;
    const ty = -phase.lift * 16 - phase.exit * 36;
    v.el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
    v.el.style.opacity = (1 - phase.exit).toFixed(3);
    return;
  }
  const sc = (1 + (v.scale - 1) * phase.travel).toFixed(4);
  v.el.style.transform = `translate3d(${(v.dx * phase.travel).toFixed(2)}px, ${(v.dy * phase.travel).toFixed(2)}px, 0) scale(${sc})`;
};

function MotionStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const pin = pinRef.current;
    const hero = heroRef.current;
    const grid = gridRef.current;
    if (!(stage && pin && hero && grid)) {
      return;
    }

    const showpieceKey = content.showpiece.key;
    const cases = Array.from(
      hero.querySelectorAll<HTMLElement>(".field__vessels .case")
    );
    const copy = hero.querySelector<HTMLElement>(".vitrine__copy");
    const baton = hero.querySelector<HTMLElement>(".scroll-baton");
    let vessels: MorphVessel[] = [];

    // FLIP measurement: read each grid card's poster target, then carry each hero
    // vessel onto its peer card (or tag the showpiece for the set-aside).
    const measure = () => {
      const pinRect = pin.getBoundingClientRect();
      const targets = collectTargets(grid, pinRect);
      vessels = [];
      for (const el of cases) {
        const v = buildVessel(el, targets, pinRect, showpieceKey);
        if (v) {
          vessels.push(v);
        }
      }
    };

    // The thesis hands the baton: the hero fades to a backdrop (and leaves the
    // interaction tree once scroll begins), the thesis rises, the scroll cue drops.
    const handBaton = (progress: number, atRest: boolean) => {
      hero.toggleAttribute("inert", !atRest);
      hero.style.opacity = (1 - smoothstep(0.3, 0.66, progress)).toFixed(3);
      if (copy) {
        copy.style.transform = `translate(-50%, calc(-50% - ${(progress * 2).toFixed(3)}rem))`;
      }
      if (baton) {
        baton.style.opacity = (1 - Math.min(1, progress * 6)).toFixed(3);
      }
    };

    const apply = (progress: number) => {
      stage.style.setProperty("--p", progress.toFixed(4));
      const atRest = progress <= HERO_REST;
      handBaton(progress, atRest);

      // The grid cross-fades up into the vessels' destination, and stays out of the
      // interaction tree (inert) until the cards have fully resolved.
      grid.style.opacity = smoothstep(0.3, 0.72, progress).toFixed(3);
      grid.toggleAttribute("inert", !(progress > RESOLVE_AT));

      const phase: MorphPhase = {
        atRest,
        travel: smoothstep(0, 0.72, progress),
        lift: smoothstep(0, 0.18, progress),
        exit: smoothstep(0.2, 0.62, progress),
      };
      for (const v of vessels) {
        driveVessel(v, phase);
      }

      // A hook for video media to freeze to its poster during the settle, then
      // resume (today the media is a static logo, so this is already satisfied).
      stage.dataset.settling =
        progress > 0.001 && progress < 0.999 ? "true" : "false";
    };

    let lastProgress = -1;
    const compute = () => {
      const denom = stage.offsetHeight - window.innerHeight;
      const top = stage.getBoundingClientRect().top;
      const rawProgress = denom > 0 ? clamp(-top / denom, 0, 1) : 0;
      const progress = clamp(rawProgress / MORPH_END, 0, 1);
      if (progress === lastProgress) {
        return;
      }
      lastProgress = progress;
      apply(progress);
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
    // The grid box (and so the vessels' targets) can shift after web fonts swap in
    // or any reflow; re-measure so the FLIP deltas stay true.
    const observer = new ResizeObserver(remeasure);
    observer.observe(grid);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", remeasure);
      observer.disconnect();
      if (raf !== 0) {
        cancelAnimationFrame(raf);
      }
      // Release every driven node back to its natural state on unmount.
      hero.removeAttribute("inert");
      hero.style.opacity = "";
      grid.removeAttribute("inert");
      grid.style.opacity = "";
      if (copy) {
        copy.style.transform = "";
      }
      if (baton) {
        baton.style.opacity = "";
      }
      for (const v of vessels) {
        v.el.style.transform = "";
        v.el.style.opacity = "";
        v.el.style.animation = "";
      }
    };
  }, []);

  return (
    <div className={styles.stage} ref={stageRef}>
      <div className={styles.pin} ref={pinRef}>
        {/* the at-rest contact sheet IS the curated hero, untouched */}
        <div className={styles.heroLayer} ref={heroRef}>
          <Hero />
        </div>

        {/* the resolved 2x2, cross-faded in beneath the travelling vessels */}
        <div className={styles.gridLayer} ref={gridRef}>
          <ShowcaseRoot className={styles.gridStage}>
            <div className={styles.tint} />
            <ProofGrid />
          </ShowcaseRoot>
        </div>
      </div>
    </div>
  );
}
