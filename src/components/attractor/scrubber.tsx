"use client";

// Scrubber — the slim epoch control that doubles as the progress bar.
//
// It is the "epoch as a clean progress bar (no counter label)" and the "scrub
// through training" affordance in one element: its fill tracks the controller's
// progress (so during the once-on-view autoplay it fills itself), and dragging it
// (mouse, touch, or keyboard) scrubs training back and forth. Taking it over
// cancels the autoplay for good (the auto-play is a single on-view beat), but
// never locks scrolling.
//
// An rAF loop reflects the controller's progress into the fill width and the
// native input's value when the visitor is not actively dragging; while dragging,
// the input drives the controller. The same loop fades the bar in off the scene's
// `controlReveal` (the progress bar LEADS the console's staged entrance) and gates
// its pointer input shut until it is mostly present, so an invisible bar never
// swallows a drag meant to orbit. No per-frame React state.

import { useEffect, useRef } from "react";
import styles from "./attractor.module.css";
import type { FinaleController } from "./controller";

// The slider's accessible name describes what IT does — scrub the training epoch.
// (The bar wears a pointer cursor as its whole affordance; the scene's grab cursor
// carries orbit. Neither needs instruction copy.)
const SCRUBBER_LABEL = "Scrub the training epoch";

// The bar only accepts input once it is mostly faded in (so the fade never leaves
// an invisible-but-grabbable strip over the scene).
const CONTROL_INTERACTIVE = 0.6;

/** Reflect the controller's progress into the fill width + the idle input value. */
function paintProgress(
  fillEl: HTMLSpanElement | null,
  inputEl: HTMLInputElement | null,
  controller: FinaleController
): void {
  if (fillEl) {
    fillEl.style.width = `${controller.progress * 100}%`;
  }
  if (inputEl && !controller.userScrubbing) {
    inputEl.value = String(controller.progress);
  }
}

/** Fade + settle the bar in off `controlReveal`, gating pointer input until it is
 *  present. CSS reads `--enter` for both the opacity and the upward drift. */
function paintReveal(rootEl: HTMLDivElement | null, reveal: number): void {
  if (!rootEl) {
    return;
  }
  rootEl.style.setProperty("--enter", String(reveal));
  rootEl.style.pointerEvents = reveal > CONTROL_INTERACTIVE ? "auto" : "none";
}

interface ScrubberProps {
  readonly controller: FinaleController;
}

export function Scrubber({ controller }: ScrubberProps) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const fill = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let last = -1;
    let lastReveal = -1;
    const tick = () => {
      // Idle steady-state writes nothing: skip the DOM until a value moves.
      if (controller.progress !== last) {
        last = controller.progress;
        paintProgress(fill.current, input.current, controller);
      }
      if (controller.controlReveal !== lastReveal) {
        lastReveal = controller.controlReveal;
        paintReveal(root.current, controller.controlReveal);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [controller]);

  const onInput = (event: React.FormEvent<HTMLInputElement>) => {
    controller.userScrubbing = true;
    controller.autoplayActive = false;
    controller.progress = Number(event.currentTarget.value);
  };
  const release = () => {
    controller.userScrubbing = false;
  };

  return (
    <div className={styles.scrubber} ref={root}>
      <span className={styles.scrubberTrack}>
        <span className={styles.scrubberFill} ref={fill} />
      </span>
      <input
        aria-label={SCRUBBER_LABEL}
        className={styles.scrubberInput}
        defaultValue={0}
        max={1}
        min={0}
        onBlur={release}
        onInput={onInput}
        onKeyUp={release}
        onPointerCancel={release}
        onPointerUp={release}
        ref={input}
        step={0.001}
        type="range"
      />
    </div>
  );
}
