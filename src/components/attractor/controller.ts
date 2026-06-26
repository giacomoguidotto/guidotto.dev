// FinaleController — the one mutable channel the finale's three readers/writers
// share, so per-frame state never flows through React.
//
// The scene's `useFrame` (inside the Canvas) advances `progress` during the
// autoplay and reads it to morph the tube; the scrubber writes `progress` and
// flips `userScrubbing`; the HUD (a DOM overlay outside the Canvas) reads
// `progress` on its own rAF and writes the numbers straight to the DOM. Routing
// this 60fps state through `useState` would re-render the tree every frame, so —
// exactly like the site's no-re-render reactivity law (`--live-accent`, `--mx`) —
// it lives on a plain mutable object passed by ref.

export interface FinaleController {
  /** Scene advances `progress` while true; cleared once the play-through ends
   *  or the visitor takes over the scrubber (autoplay is a once-on-view beat). */
  autoplayActive: boolean;
  /** The console's staged entrance — the scene fades it in as a beat AFTER the
   *  data cloud assembles, not all at once with the canvas. The progress bar
   *  leads (`controlReveal`) and the parameters + loss gauges follow a beat later
   *  (`gaugeReveal`). The Scrubber and Hud read these on their own rAF and write
   *  opacity straight to the DOM (no re-render). Static / frozen tiers hold both
   *  at 1 (see freezeConverged). */
  controlReveal: number;
  gaugeReveal: number;
  /** Training progress, 0 (epoch 0) -> 1 (converged). Scene + scrubber write. */
  progress: number;
  /** Observation motes pop in, 0 -> 1 (scene writes during the intro beat). */
  reveal: number;
  /** Snapshot the morph rests on at progress 1 — the first one indistinguishable
   *  from the converged butterfly. The last training snapshots are visually
   *  frozen (the net has settled), so progress 1 lands here rather than on the
   *  identical final frame, and the autoplay eases to a stop on the settling
   *  butterfly instead of crawling through dead frames. */
  readonly settleIndex: number;
  readonly snapshotCount: number;
  /** True while a pointer is down on the scrubber, pausing autoplay. */
  userScrubbing: boolean;
}

export function createController(
  snapshotCount: number,
  settleIndex: number = snapshotCount - 1
): FinaleController {
  return {
    progress: 0,
    autoplayActive: true,
    userScrubbing: false,
    reveal: 0,
    controlReveal: 0,
    gaugeReveal: 0,
    settleIndex,
    snapshotCount,
  };
}

/** Fractional snapshot index for a progress value (for morph interpolation).
 *  Progress is clamped to [0, 1] here so a stray out-of-range write (a future
 *  input path, a rounding overshoot) can never derive an out-of-bounds snapshot
 *  index — `Showpiece.params`/`loss` assert their index and would otherwise throw
 *  inside the HUD's animation frame. Progress 1 maps to `settleIndex`, not the
 *  final snapshot, so the morph (and the scrubber) rest on the settled butterfly
 *  and never dwell on the visually-frozen tail. */
export function snapshotFloat(controller: FinaleController): number {
  const progress = Math.min(1, Math.max(0, controller.progress));
  return progress * controller.settleIndex;
}

/** Nearest integer snapshot index for a progress value (for HUD params/loss). */
export function snapshotIndex(controller: FinaleController): number {
  return Math.round(snapshotFloat(controller));
}
