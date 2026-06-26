"use client";

// StaticButterfly — the no-WebGL / reduced-motion tier of the degradation ladder.
//
// It draws the CONVERGED attractor once into a plain 2D canvas (the final
// snapshot's centerline projected face-on, plus the faint observation motes), so
// a visitor without WebGL, or one who asked for reduced motion, still gets the
// payoff: order risen from chaos, held still. No animation loop, no three.js — it
// reads the same `FinaleData` the live scene would, so the butterfly is the real
// recovered trajectory, not a picture.

import { useEffect, useRef } from "react";
import styles from "./attractor.module.css";
import type { FinaleData } from "./finale-data";
import { TUBE_SAMPLES } from "./finale-data";

interface StaticButterflyProps {
  readonly accent: string;
  readonly data: FinaleData;
}

/** Scene-space bounds of the final centerline AND the motes, for a fit that
 *  never clips the noisy data this tier is partly here to show. */
function boundsOf(data: FinaleData): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const fit = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  const line = data.centerlines[data.snapshotCount - 1];
  for (let i = 0; i < TUBE_SAMPLES; i++) {
    fit(line[i * 3], line[i * 3 + 1]);
  }
  for (let i = 0; i < data.moteCount; i++) {
    fit(data.motes[i * 3], data.motes[i * 3 + 1]);
  }
  return { minX, maxX, minY, maxY };
}

export function StaticButterfly({ accent, data }: StaticButterflyProps) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!(el && ctx)) {
      return;
    }

    const draw = () => {
      const rect = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      el.width = Math.max(1, Math.round(rect.width * dpr));
      el.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const { minX, maxX, minY, maxY } = boundsOf(data);
      const pad = 36;
      const scale = Math.min(
        (rect.width - pad * 2) / (maxX - minX || 1),
        (rect.height - pad * 2) / (maxY - minY || 1)
      );
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      // Scene Y is up; canvas Y is down -> negate. Project (x, y) face-on.
      const px = (x: number) => rect.width / 2 + (x - cx) * scale;
      const py = (y: number) => rect.height / 2 - (y - cy) * scale;

      // Faint cool-white motes.
      ctx.fillStyle = "rgba(199, 210, 232, 0.32)";
      for (let i = 0; i < data.moteCount; i++) {
        ctx.beginPath();
        ctx.arc(
          px(data.motes[i * 3]),
          py(data.motes[i * 3 + 1]),
          1.1,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // The converged butterfly, with a soft accent glow.
      const line = data.centerlines[data.snapshotCount - 1];
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = accent;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px(line[0]), py(line[1]));
      for (let i = 1; i < TUBE_SAMPLES; i++) {
        ctx.lineTo(px(line[i * 3]), py(line[i * 3 + 1]));
      }
      ctx.stroke();
      ctx.restore();
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(el);
    return () => observer.disconnect();
  }, [accent, data]);

  return (
    <canvas
      aria-label="The recovered Lorenz attractor, converged into its butterfly."
      className={styles.staticCanvas}
      ref={canvas}
      role="img"
    />
  );
}
