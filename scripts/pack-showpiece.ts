/**
 * pack-showpiece — the committed build half of the `showpiece-asset` seam.
 *
 * Packs the gitignored raw Lorenz export (`.showpiece/lorenz/`, ~14.8 MB
 * float32) into the committed deploy asset under `public/showpiece/lorenz/`:
 * a small JSON manifest (forward-core metadata + folded observations + the
 * transport encoding) and a gzipped float16 weights blob.
 *
 * A verification gate runs entirely in memory before anything is written: it
 * decodes the packed bytes back and checks that every snapshot stays finite and
 * bounded, that the converged snapshot keeps both butterfly lobes, and that the
 * packed trajectory tracks the raw one within tolerance. If the gate fails,
 * nothing is written and the process exits non-zero — the committed asset can
 * never silently regress the spectacle.
 *
 * Usage: bun run scripts/pack-showpiece.ts [--raw <dir>] [--out <dir>]
 *
 * The AnyPINN library is never touched; the raw export stays gitignored; only
 * the packed asset is committed.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import type { PackedManifest } from "../src/showpiece/asset";
import { decodeWeights, encodeWeights } from "../src/showpiece/codec";
import {
  loadShowpiece,
  type Observations,
  type ShowpieceManifest,
} from "../src/showpiece/lorenz-forward";
import {
  hasBothLobes,
  isBounded,
  maxAbsCoord,
  maxTrajectoryDeviation,
} from "../src/showpiece/verify";

const DEFAULT_RAW_DIR = ".showpiece/lorenz";
const DEFAULT_OUT_DIR = "public/showpiece/lorenz";
const WEIGHTS_FILE = "weights.f16.gz";

/** Gate thresholds. Bound distinguishes "bounded" from divergence/NaN; the
 *  deviation tolerance is the "both-lobes / no-divergence" budget, comfortably
 *  above observed float16 error (~0.04) yet tight enough to catch regressions. */
const COORD_BOUND = 200;
const DECODE_TOLERANCE = 0.5;
const GATE_SAMPLE_COUNT = 300;

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function readArrayBuffer(path: string): Promise<ArrayBuffer> {
  const buffer = await readFile(path);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
}

async function writeFileEnsured(
  path: string,
  data: string | Uint8Array
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

function readManifestForwardFields(
  raw: Record<string, unknown>,
  observations: Observations
): ShowpieceManifest {
  return {
    system: raw.system as string,
    fieldOrder: raw.fieldOrder as string[],
    paramOrder: raw.paramOrder as string[],
    activation: "tanh",
    layers: raw.layers as ShowpieceManifest["layers"],
    scale: raw.scale as number,
    tTotal: raw.tTotal as number,
    inputDomain: raw.inputDomain as [number, number],
    snapshotCount: raw.snapshotCount as number,
    snapshots: raw.snapshots as ShowpieceManifest["snapshots"],
    observations,
  };
}

function verify(
  packedManifest: PackedManifest,
  rawBuffer: ArrayBuffer,
  packedBuffer: ArrayBuffer
): {
  maxDeviation: number;
  maxCoord: number;
} {
  const rawShowpiece = loadShowpiece(packedManifest, rawBuffer);
  const packedShowpiece = loadShowpiece(packedManifest, packedBuffer);

  let maxDeviation = 0;
  let maxCoord = 0;
  const lastIndex = packedManifest.snapshotCount - 1;

  for (let i = 0; i < packedManifest.snapshotCount; i++) {
    const rawTrajectory = rawShowpiece.trajectory(i, GATE_SAMPLE_COUNT);
    const packedTrajectory = packedShowpiece.trajectory(i, GATE_SAMPLE_COUNT);

    if (!isBounded(rawTrajectory, COORD_BOUND)) {
      throw new Error(`raw snapshot ${i} is unbounded or non-finite`);
    }
    if (!isBounded(packedTrajectory, COORD_BOUND)) {
      throw new Error(`packed snapshot ${i} is unbounded or non-finite`);
    }

    const deviation = maxTrajectoryDeviation(rawTrajectory, packedTrajectory);
    if (deviation > DECODE_TOLERANCE) {
      throw new Error(
        `packed snapshot ${i} deviates ${deviation.toFixed(4)} > ${DECODE_TOLERANCE}`
      );
    }
    maxDeviation = Math.max(maxDeviation, deviation);

    // Report the true worst coordinate across all three fields, not just x.
    maxCoord = Math.max(maxCoord, maxAbsCoord(packedTrajectory));
  }

  const convergedRaw = rawShowpiece.trajectory(lastIndex, GATE_SAMPLE_COUNT);
  const convergedPacked = packedShowpiece.trajectory(
    lastIndex,
    GATE_SAMPLE_COUNT
  );
  if (!hasBothLobes(convergedRaw)) {
    throw new Error("raw converged snapshot is missing a butterfly lobe");
  }
  if (!hasBothLobes(convergedPacked)) {
    throw new Error("packed converged snapshot is missing a butterfly lobe");
  }

  return { maxDeviation, maxCoord };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      raw: { type: "string", default: DEFAULT_RAW_DIR },
      out: { type: "string", default: DEFAULT_OUT_DIR },
    },
  });
  const rawDir = values.raw ?? DEFAULT_RAW_DIR;
  const outDir = values.out ?? DEFAULT_OUT_DIR;

  const rawManifestPath = `${rawDir}/manifest.json`;
  if (!existsSync(rawManifestPath)) {
    throw new Error(
      `raw export not found at ${rawDir} (it is gitignored; export it before packing)`
    );
  }

  const rawManifest = await readJson<Record<string, unknown>>(rawManifestPath);
  const observations = await readJson<Observations>(
    `${rawDir}/observations.json`
  );
  const rawBuffer = await readArrayBuffer(
    `${rawDir}/${rawManifest.weightsFile as string}`
  );
  const weights = new Float32Array(rawBuffer);

  const { bytes, encoding } = await encodeWeights(weights);
  const forward = readManifestForwardFields(rawManifest, observations);
  const packedManifest: PackedManifest = {
    ...forward,
    weightsFile: WEIGHTS_FILE,
    weightsEncoding: encoding,
  };

  // Gate: decode and prove the spectacle survives, before writing anything.
  const packedBuffer = await decodeWeights(bytes, encoding);
  const { maxDeviation, maxCoord } = verify(
    packedManifest,
    rawBuffer,
    packedBuffer
  );

  await writeFileEnsured(
    `${outDir}/manifest.json`,
    `${JSON.stringify(packedManifest, null, 2)}\n`
  );
  await writeFileEnsured(`${outDir}/${WEIGHTS_FILE}`, bytes);

  const ratio = bytes.byteLength / rawBuffer.byteLength;
  process.stdout.write(
    [
      `packed ${rawDir} -> ${outDir}`,
      `  snapshots:      ${packedManifest.snapshotCount}`,
      `  raw weights:    ${(rawBuffer.byteLength / 1e6).toFixed(2)} MB`,
      `  packed weights: ${(bytes.byteLength / 1e6).toFixed(2)} MB (gzip float16, ${(ratio * 100).toFixed(1)}% of raw)`,
      `  gate: max deviation ${maxDeviation.toFixed(4)} (<= ${DECODE_TOLERANCE}), max |coord| ${maxCoord.toFixed(2)} (<= ${COORD_BOUND}), both lobes ok`,
      "",
    ].join("\n")
  );
}

await main();
