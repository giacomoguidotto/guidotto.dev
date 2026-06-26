"use client";

// Hud — the quiet mono readout over the instrument.
//
// It shows the solver settling: sigma / rho / beta as knobs whose dots drift to
// their recovered values (NO ground-truth target is ever drawn, and NO numbers —
// the bare numerals read as distracting noise; the trajectory is the payoff, the
// parameters are garnish). The loss is no longer a ticking numeral either: it is
// a quiet line chart — a dimmed ground line with a soft shadow fading beneath it
// (there is no negative loss, so the floor is drawn as a floor) and the real loss
// curve descending toward that ground as training replays. No axes, no labels but
// the word LOSS.
//
// Like the rest of the page's reactivity, the 60fps values never flow through
// React: an rAF loop reads the shared controller and writes straight to the DOM
// (each knob's CSS custom property, and the chart's reveal-clip width), so the HUD
// costs no re-renders. The loss path itself is static geometry built once from the
// real per-epoch numbers; only how much of it is revealed animates.
//
// The HUD also FOLLOWS the progress bar into view: the same rAF fades the whole
// readout in off the scene's `gaugeReveal` (the parameters + loss are the second
// beat of the console's staged entrance), so they arrive already alive — their
// values have begun settling by the time they become visible.
//
// In the static / reduced-motion tier there is no animation loop: the converged
// snapshot's knobs are written once, the whole loss curve is revealed and held,
// and the readout shows at full opacity at once (no `entering` fade).

import { useEffect, useId, useMemo, useRef } from "react";
import type { Showpiece } from "~/showpiece/lorenz-forward";
import styles from "./attractor.module.css";
import { type FinaleController, snapshotIndex } from "./controller";

// Plausible display spans for each knob (NOT truth targets — just the dial
// range the settling dot travels within). Kept generous so the recovered values
// sit mid-dial rather than pinned to an edge.
const KNOB_RANGE = {
  sigma: [0, 20],
  rho: [0, 30],
  beta: [0, 10],
} as const;

// The loss chart's user-space box (viewBox 0 0 100 100, stretched to fit). The
// ground line sits near the bottom; the shadow fades from it to the floor; the
// loss curve climbs from the ground (loss 0) up to TOP_Y (the run's worst loss).
const GROUND_Y = 84;
const TOP_Y = 12;

interface KnobProps {
  readonly dotRef: React.RefObject<HTMLSpanElement | null>;
  readonly symbol: string;
}

function Knob({ symbol, dotRef }: KnobProps) {
  return (
    <div className={styles.knob}>
      <span className={styles.knobSymbol}>{symbol}</span>
      <span className={styles.knobTrack}>
        <span className={styles.knobDot} ref={dotRef} />
      </span>
    </div>
  );
}

/** Loss at a snapshot, falling back to the first measured epoch (epoch 0 is null). */
function lossAt(showpiece: Showpiece, index: number): number {
  for (let i = index; i < showpiece.snapshotCount; i++) {
    const loss = showpiece.loss(i);
    if (loss !== null) {
      return loss;
    }
  }
  return showpiece.loss(showpiece.snapshotCount - 1) ?? 0;
}

/** Build the static loss polyline in the chart's 0..100 user space, from the real
 *  per-epoch numbers. x is training progress (epoch order); y maps loss linearly
 *  so 0 sits on the ground line and the run's worst loss reaches TOP_Y — at
 *  convergence the curve meets the ground. (The path is honest: it includes the
 *  real early bump before the descent, not an idealised slide.) */
function buildLossPath(showpiece: Showpiece): string {
  const n = showpiece.snapshotCount;
  const losses = Array.from({ length: n }, (_, i) => lossAt(showpiece, i));
  const max = Math.max(...losses) || 1;
  const span = GROUND_Y - TOP_Y;
  return losses
    .map((loss, i) => {
      const x = n === 1 ? 0 : (i / (n - 1)) * 100;
      const y = GROUND_Y - (loss / max) * span;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

const norm = (value: number, [lo, hi]: readonly [number, number]): number =>
  Math.min(1, Math.max(0, (value - lo) / (hi - lo)));

interface HudProps {
  readonly controller: FinaleController;
  /** When false, the converged snapshot is written once and held (static tier). */
  readonly live: boolean;
  readonly lossLabel: string;
  readonly parametersLabel: string;
  readonly showpiece: Showpiece;
}

export function Hud({
  controller,
  live,
  parametersLabel,
  lossLabel,
  showpiece,
}: HudProps) {
  const sigmaDot = useRef<HTMLSpanElement>(null);
  const rhoDot = useRef<HTMLSpanElement>(null);
  const betaDot = useRef<HTMLSpanElement>(null);
  // The readout shell, faded in off `gaugeReveal` (the second console beat).
  const shell = useRef<HTMLDivElement>(null);
  // The rect that clips the loss path; its width (0..100) is how much of the
  // descending curve has been revealed so far.
  const reveal = useRef<SVGRectElement>(null);

  const lossPath = useMemo(() => buildLossPath(showpiece), [showpiece]);
  const ids = useId();
  const clipId = `${ids}-loss-clip`;
  const shadeId = `${ids}-loss-shade`;

  useEffect(() => {
    const paintKnobs = (index: number) => {
      const { sigma, rho, beta } = showpiece.params(index);
      const set = (
        dot: HTMLSpanElement | null,
        value: number,
        range: readonly [number, number]
      ) => {
        if (dot) {
          dot.style.setProperty("--knob", `${norm(value, range) * 100}%`);
        }
      };
      set(sigmaDot.current, sigma, KNOB_RANGE.sigma);
      set(rhoDot.current, rho, KNOB_RANGE.rho);
      set(betaDot.current, beta, KNOB_RANGE.beta);
    };
    const revealTo = (progress: number) => {
      reveal.current?.setAttribute("width", String(progress * 100));
    };

    if (!live) {
      paintKnobs(showpiece.snapshotCount - 1);
      revealTo(1);
      // No `entering` class in this tier; clear any staged-entrance value left by
      // a live phase that just dropped to static, so the readout shows at rest.
      shell.current?.style.removeProperty("--enter");
      return;
    }

    let raf = 0;
    let lastIndex = -1;
    let lastProgress = -1;
    let lastGauge = -1;
    const tick = () => {
      // The loss curve reveals continuously (it traces the descent smoothly), so
      // it follows raw progress every frame it moves.
      const progress = controller.progress;
      if (progress !== lastProgress) {
        lastProgress = progress;
        revealTo(progress);
      }
      // The knobs only step on a snapshot boundary; skip the DOM otherwise.
      const index = snapshotIndex(controller);
      if (index !== lastIndex) {
        lastIndex = index;
        paintKnobs(index);
      }
      // The staged entrance: the whole readout fades + settles in off the scene's
      // gaugeReveal (CSS reads `--enter` for both opacity and the lift).
      const gauge = controller.gaugeReveal;
      if (gauge !== lastGauge) {
        lastGauge = gauge;
        if (shell.current) {
          shell.current.style.setProperty("--enter", String(gauge));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [controller, live, showpiece]);

  return (
    <div
      className={live ? `${styles.hud} ${styles.entering}` : styles.hud}
      ref={shell}
    >
      <div className={styles.hudParams}>
        <span className={styles.hudLabel}>{parametersLabel}</span>
        <Knob dotRef={sigmaDot} symbol="σ" />
        <Knob dotRef={rhoDot} symbol="ρ" />
        <Knob dotRef={betaDot} symbol="β" />
      </div>
      <div className={styles.hudLoss}>
        <span className={styles.hudLabel}>{lossLabel}</span>
        <div className={styles.lossChartBox}>
          <svg
            aria-hidden="true"
            className={styles.lossChart}
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            <defs>
              <linearGradient id={shadeId} x1="0" x2="0" y1="0" y2="1">
                <stop className={styles.lossShadeTop} offset="0%" />
                <stop className={styles.lossShadeBottom} offset="100%" />
              </linearGradient>
              <clipPath id={clipId}>
                <rect height="100" ref={reveal} width="0" x="0" y="0" />
              </clipPath>
            </defs>
            {/* the soft shadow under the ground line: there is no negative loss,
                so the floor is suggested as a fading floor, not an open axis. */}
            <rect
              className={styles.lossShadow}
              fill={`url(#${shadeId})`}
              height={100 - GROUND_Y}
              width="100"
              x="0"
              y={GROUND_Y}
            />
            <line
              className={styles.lossGround}
              x1="0"
              x2="100"
              y1={GROUND_Y}
              y2={GROUND_Y}
            />
            <path
              className={styles.lossLine}
              clipPath={`url(#${clipId})`}
              d={lossPath}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
