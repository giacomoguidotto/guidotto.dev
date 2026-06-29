// pager — the reels-style discrete stepper for the portrait stage.
//
// On a phone the stage stops being a continuous scroll and becomes a STEPPED
// pager: one fling = exactly one step, regardless of fling force (Instagram
// Reels / TikTok). It does not replace the scroll-scrubbed FLIP morph — it
// DRIVES it. Each step is a single `scrollTo({ behavior: "smooth" })` to the
// next stop, and the morph (which is a pure function of scroll position) simply
// scrubs through during that smooth scroll, so the hero -> card-1 handoff plays
// as a timed transition on every fling, the same way desktop tabbing animates it.
//
// Stops are scrollY targets the caller computes (hero rest, then each centred
// card). The pager owns the gesture only INSIDE that band: a fling past the last
// stop is RELEASED to native scroll so the finale below stays a clean exit, and a
// fling above the first releases back to the top. It never traps — past the edges
// it does nothing, so the page scrolls normally (the law CONTEXT 2026-06-27
// promised; a deliberate stepper inside the band, free scroll outside it).
//
// Wheel (narrow desktop windows) and touch (phones) both route here; reduced
// motion is the caller's gate, but a smooth scroll degrades to instant if the OS
// asks. Listeners are non-passive so a fling can be swallowed and re-aimed.

export interface PagerOptions {
  // How long a step is owned before the next fling may move again (ms).
  readonly settleMs?: number;
  // The ordered (ascending) scrollY stop positions; recomputed on demand so it is
  // always live against the current layout (URL bar, fonts, reflow).
  readonly stops: () => number[];
  // Touch travel (px) that counts as a fling rather than a tap/settle.
  readonly swipeThreshold?: number;
}

export interface Pager {
  readonly stop: () => void;
}

const SWIPE_THRESHOLD = 36;
const SETTLE_MS = 620;
const ARRIVE_PX = 4;

const reduce = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The stop nearest the current scroll — the step the pager treats as "where we
// are" before a fling nudges to the next.
const nearest = (stops: number[], y: number): number => {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < stops.length; i++) {
    const dist = Math.abs(stops[i] - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
};

export function startPager(options: PagerOptions): Pager {
  const swipe = options.swipeThreshold ?? SWIPE_THRESHOLD;
  const settle = options.settleMs ?? SETTLE_MS;
  let locked = false;
  let unlockTimer = 0;
  let touchY = 0;
  let touchOwned = false;

  // Step one stop in `dir` (+1 down, -1 up). Returns true if the pager owns the
  // gesture (a step inside the band); false at the edges, where the caller lets
  // native scroll through to the finale / top — never trapped.
  const step = (dir: number): boolean => {
    const stops = options.stops();
    if (stops.length === 0) {
      return false;
    }
    const here = nearest(stops, window.scrollY);
    const next = here + dir;
    if (next < 0 || next >= stops.length) {
      return false;
    }
    locked = true;
    window.scrollTo({
      top: stops[next],
      behavior: reduce() ? "auto" : "smooth",
    });
    window.clearTimeout(unlockTimer);
    unlockTimer = window.setTimeout(() => {
      locked = false;
    }, settle);
    return true;
  };

  const onWheel = (event: WheelEvent) => {
    if (locked) {
      event.preventDefault();
      return;
    }
    const dir = event.deltaY > 0 ? 1 : -1;
    if (step(dir)) {
      event.preventDefault();
    }
  };

  const onTouchStart = (event: TouchEvent) => {
    touchY = event.touches[0]?.clientY ?? 0;
    touchOwned = false;
  };

  const onTouchMove = (event: TouchEvent) => {
    const dy = touchY - (event.touches[0]?.clientY ?? touchY);
    if (Math.abs(dy) < swipe) {
      return;
    }
    const dir = dy > 0 ? 1 : -1;
    const stops = options.stops();
    const next = nearest(stops, window.scrollY) + dir;
    // Own the gesture only when the next step stays in the band; at an edge let
    // the browser scroll into the finale / back to top.
    if (next >= 0 && next < stops.length) {
      touchOwned = true;
      event.preventDefault();
    }
  };

  const onTouchEnd = (event: TouchEvent) => {
    if (!touchOwned || locked) {
      return;
    }
    const dy = touchY - (event.changedTouches[0]?.clientY ?? touchY);
    if (Math.abs(dy) >= swipe) {
      step(dy > 0 ? 1 : -1);
    }
    touchOwned = false;
  };

  // Drop the lock as soon as the smooth scroll lands, so a quick second fling
  // isn't eaten longer than needed.
  const onScroll = () => {
    if (!locked) {
      return;
    }
    const stops = options.stops();
    const idx = nearest(stops, window.scrollY);
    if (Math.abs(stops[idx] - window.scrollY) <= ARRIVE_PX) {
      locked = false;
      window.clearTimeout(unlockTimer);
    }
  };

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });

  return {
    stop: () => {
      window.clearTimeout(unlockTimer);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("scroll", onScroll);
    },
  };
}
