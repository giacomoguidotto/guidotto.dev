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
  /** Training progress, 0 (epoch 0) -> 1 (converged). Scene + scrubber write. */
  progress: number;
  /** Observation motes pop in, 0 -> 1 (scene writes during the intro beat). */
  reveal: number;
  readonly snapshotCount: number;
  /** True while a pointer is down on the scrubber, pausing autoplay. */
  userScrubbing: boolean;
}

export function createController(snapshotCount: number): FinaleController {
  return {
    progress: 0,
    autoplayActive: true,
    userScrubbing: false,
    reveal: 0,
    snapshotCount,
  };
}

/** Fractional snapshot index for a progress value (for morph interpolation).
 *  Progress is clamped to [0, 1] here so a stray out-of-range write (a future
 *  input path, a rounding overshoot) can never derive an out-of-bounds snapshot
 *  index — `Showpiece.params`/`loss` assert their index and would otherwise throw
 *  inside the HUD's animation frame. */
export function snapshotFloat(controller: FinaleController): number {
  const progress = Math.min(1, Math.max(0, controller.progress));
  return progress * (controller.snapshotCount - 1);
}

/** Nearest integer snapshot index for a progress value (for HUD params/loss). */
export function snapshotIndex(controller: FinaleController): number {
  return Math.round(snapshotFloat(controller));
}
