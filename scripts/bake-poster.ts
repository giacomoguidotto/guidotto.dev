/**
 * bake-poster — the committed still floor of the finale's degradation ladder.
 *
 * Renders the CONVERGED Lorenz butterfly (final snapshot's centerline, projected
 * face-on, plus the observation motes) from the committed `public/showpiece/lorenz`
 * asset into a small static SVG at `public/showpiece/lorenz/poster.svg`.
 *
 * That SVG is the true floor of the instrument's ladder: the reduced-motion tier
 * and the asset-load-failed tier render it as a plain <img>, so neither has to
 * fetch the 6.8 MB weights, spin up three.js, or run the precompute — and the
 * finale never shows a hole under copy that says it is "running live".
 *
 * The projection mirrors `finale-data` / `static-butterfly` exactly (physical
 * x -> horizontal, physical z -> vertical, recentred on the final trajectory's
 * bounding-box midpoint), and the accent is read from the canonical content
 * surface, so a re-bake tracks any accent change.
 *
 * Usage: bun run scripts/bake-poster.ts [--out <dir>]
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { content } from "../src/content";
import { type FetchLike, loadShowpieceAsset } from "../src/showpiece/asset";
import type { Showpiece } from "../src/showpiece/lorenz-forward";

const DEFAULT_OUT_DIR = "public/showpiece/lorenz";

// Poster geometry. The viewBox matches the instrument's 16:11 field; SAMPLES is
// generous (a still pays the smoothness once) and PAD keeps the motes off the edge.
const VIEW_W = 1600;
const VIEW_H = 1100;
const PAD = 130;
const SAMPLES = 420;
const MOTE_COLOR = "#c7d2e8"; // == AttractorScene MOTE_COLOR
const ACCENT = content.showpiece.accent;

/** A fetch that serves the committed asset straight off disk (script-time only). */
const diskFetch: FetchLike = async (input) => {
  if (!existsSync(input)) {
    return new Response(null, { status: 404 });
  }
  const buffer = await readFile(input);
  const body = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
  return new Response(body, { status: 200 });
};

interface Point {
  x: number;
  y: number;
}

/** Midpoint of the final trajectory's bounding box on the projected axes. */
function centerOf(showpiece: Showpiece): { cx: number; cz: number } {
  const final = showpiece.trajectory(showpiece.snapshotCount - 1, SAMPLES);
  const mid = (values: Float64Array): number => {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const v of values) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    return (lo + hi) / 2;
  };
  return { cx: mid(final.x), cz: mid(final.z) };
}

/** Fit projected points into the padded viewBox, flipping z (scene up) to SVG y. */
function fitter(points: Point[]): (p: Point) => Point {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const scale = Math.min(
    (VIEW_W - PAD * 2) / (maxX - minX || 1),
    (VIEW_H - PAD * 2) / (maxY - minY || 1)
  );
  const ox = (minX + maxX) / 2;
  const oy = (minY + maxY) / 2;
  return (p: Point) => ({
    x: VIEW_W / 2 + (p.x - ox) * scale,
    y: VIEW_H / 2 - (p.y - oy) * scale,
  });
}

function buildSvg(showpiece: Showpiece): string {
  const { cx, cz } = centerOf(showpiece);
  const final = showpiece.trajectory(showpiece.snapshotCount - 1, SAMPLES);
  const curve: Point[] = Array.from({ length: SAMPLES }, (_, i) => ({
    x: final.x[i] - cx,
    y: final.z[i] - cz,
  }));
  const obs = showpiece.observations;
  const motes: Point[] = Array.from({ length: obs.count }, (_, i) => ({
    x: obs.x[i] - cx,
    y: obs.z[i] - cz,
  }));

  const fit = fitter([...curve, ...motes]);
  const n = (v: number): string => v.toFixed(1);

  const path = curve
    .map((p, i) => {
      const f = fit(p);
      return `${i === 0 ? "M" : "L"}${n(f.x)} ${n(f.y)}`;
    })
    .join(" ");
  const dots = motes
    .map((p) => {
      const f = fit(p);
      return `<circle cx="${n(f.x)}" cy="${n(f.y)}" r="3.4"/>`;
    })
    .join("");

  // Two strokes: a blurred under-layer (the bloom) and a crisp top (the strand).
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" fill="none" role="img" aria-label="The recovered Lorenz attractor, converged into its butterfly.">
  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="9"/>
    </filter>
  </defs>
  <g fill="${MOTE_COLOR}" fill-opacity="0.34">${dots}</g>
  <path d="${path}" stroke="${ACCENT}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" stroke-opacity="0.55" filter="url(#glow)"/>
  <path d="${path}" stroke="${ACCENT}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>
</svg>
`;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { out: { type: "string", default: DEFAULT_OUT_DIR } },
  });
  const outDir = values.out ?? DEFAULT_OUT_DIR;

  const { showpiece } = await loadShowpieceAsset({
    baseUrl: outDir,
    fetch: diskFetch,
  });
  const svg = buildSvg(showpiece);

  const outPath = `${outDir}/poster.svg`;
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, svg);

  process.stdout.write(
    `baked ${outPath} (${(svg.length / 1024).toFixed(1)} KB, accent ${ACCENT})\n`
  );
}

await main();
