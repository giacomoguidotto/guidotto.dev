import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { PackedManifest } from "./asset";
import { decodeWeights } from "./codec";
import { loadShowpiece, type ShowpieceManifest } from "./lorenz-forward";
import { hasBothLobes, isBounded, maxTrajectoryDeviation } from "./verify";

// Seam #1: the framework-free compute core + asset decode. No React, no WebGL.
// These tests run under `bun test` and make the "genuinely live" claim provable
// by pinning the forward pass against an independent Python oracle.

const PACKED_DIR = `${import.meta.dir}/../../public/showpiece/lorenz`;
const RAW_DIR = `${import.meta.dir}/../../.showpiece/lorenz`;
const FIXTURE = `${import.meta.dir}/__fixtures__/lorenz-final-trajectory.json`;

const EXPECTED_SNAPSHOTS = 37;
const OBSERVATION_POINTS = 300;
const COORD_BOUND = 200;
// The committed asset is float16-quantised, so it tracks the oracle within the
// "both-lobes / no-divergence" budget, not float precision.
const QUANTISED_TOLERANCE = 0.2;
// The raw float32 weights must reproduce the oracle to float precision.
const FLOAT_TOLERANCE = 1e-3;

interface OracleFixture {
  sampleCount: number;
  snapshotIndex: number;
  tau: number[];
  x: number[];
  y: number[];
  z: number[];
}

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

const fixture = await readJson<OracleFixture>(FIXTURE);

async function loadFromPackedAsset() {
  const manifest = await readJson<PackedManifest>(
    `${PACKED_DIR}/manifest.json`
  );
  const packed = await readFile(`${PACKED_DIR}/${manifest.weightsFile}`);
  const weights = await decodeWeights(packed, manifest.weightsEncoding);
  return loadShowpiece(manifest, weights);
}

async function loadFromRawExport() {
  const rawManifest = await readJson<Record<string, unknown>>(
    `${RAW_DIR}/manifest.json`
  );
  const observations = await readJson(`${RAW_DIR}/observations.json`);
  const weights = await readArrayBuffer(`${RAW_DIR}/weights.bin`);
  const manifest = { ...rawManifest, observations } as ShowpieceManifest;
  return loadShowpiece(manifest, weights);
}

function deviationFromFixture(
  trajectory: { x: Float64Array; y: Float64Array; z: Float64Array },
  oracle: OracleFixture
): number {
  let max = 0;
  for (let k = 0; k < oracle.sampleCount; k++) {
    max = Math.max(
      max,
      Math.abs(trajectory.x[k] - oracle.x[k]),
      Math.abs(trajectory.y[k] - oracle.y[k]),
      Math.abs(trajectory.z[k] - oracle.z[k])
    );
  }
  return max;
}

describe("loadShowpiece (committed packed asset)", () => {
  test("decodes the shipped manifest + weights and reports the snapshot count", async () => {
    const showpiece = await loadFromPackedAsset();
    expect(showpiece.snapshotCount).toBe(EXPECTED_SNAPSHOTS);
  });

  test("observations parse to 300 points", async () => {
    const showpiece = await loadFromPackedAsset();
    const { observations } = showpiece;
    expect(observations.count).toBe(OBSERVATION_POINTS);
    expect(observations.tau).toHaveLength(OBSERVATION_POINTS);
    expect(observations.x).toHaveLength(OBSERVATION_POINTS);
    expect(observations.y).toHaveLength(OBSERVATION_POINTS);
    expect(observations.z).toHaveLength(OBSERVATION_POINTS);
  });

  test("the converged trajectory has both lobes and never diverges", async () => {
    const showpiece = await loadFromPackedAsset();
    const converged = showpiece.trajectory(showpiece.snapshotCount - 1, 300);
    expect(hasBothLobes(converged)).toBe(true);
    expect(isBounded(converged, COORD_BOUND)).toBe(true);
  });

  test("decode(pack(raw)) reproduces the oracle within the quantised tolerance", async () => {
    const showpiece = await loadFromPackedAsset();
    const converged = showpiece.trajectory(
      fixture.snapshotIndex,
      fixture.sampleCount
    );
    expect(deviationFromFixture(converged, fixture)).toBeLessThan(
      QUANTISED_TOLERANCE
    );
  });

  test("params and loss read the converged snapshot's recovered constants", async () => {
    const showpiece = await loadFromPackedAsset();
    const params = showpiece.params(showpiece.snapshotCount - 1);
    // CONTEXT.md: sigma/beta recover almost exactly; rho under-recovers (~31% low).
    expect(params.sigma).toBeCloseTo(10.13, 1);
    expect(params.beta).toBeCloseTo(2.659, 2);
    expect(params.rho).toBeCloseTo(19.28, 1);
    expect(showpiece.loss(showpiece.snapshotCount - 1)).toBeGreaterThan(0);
    expect(showpiece.loss(0)).toBeNull();
  });

  test("trajectories are memoised (same reference for same query)", async () => {
    const showpiece = await loadFromPackedAsset();
    const first = showpiece.trajectory(36, 256);
    const second = showpiece.trajectory(36, 256);
    expect(second).toBe(first);
    expect(showpiece.trajectory(36, 128)).not.toBe(first);
  });

  test("out-of-range queries throw", async () => {
    const showpiece = await loadFromPackedAsset();
    expect(() => showpiece.trajectory(EXPECTED_SNAPSHOTS, 300)).toThrow();
    expect(() => showpiece.trajectory(-1, 300)).toThrow();
    expect(() => showpiece.trajectory(0, 0)).toThrow();
    expect(() => showpiece.params(99)).toThrow();
  });

  test("monotonic convergence: loss generally falls and the butterfly forms", async () => {
    const showpiece = await loadFromPackedAsset();
    const earlyBounded = isBounded(showpiece.trajectory(0, 300), COORD_BOUND);
    const lateBounded = isBounded(
      showpiece.trajectory(showpiece.snapshotCount - 1, 300),
      COORD_BOUND
    );
    expect(earlyBounded && lateBounded).toBe(true);
    const firstLoss = showpiece.loss(1) ?? Number.POSITIVE_INFINITY;
    const lastLoss =
      showpiece.loss(showpiece.snapshotCount - 1) ?? Number.POSITIVE_INFINITY;
    expect(lastLoss).toBeLessThan(firstLoss);
  });
});

// The float-precision claim needs the raw float32 export, which is gitignored
// and absent in CI. It runs locally as the verification gate for the shipped
// asset; CI proves correctness through the committed asset + oracle above. The
// suite is declared only when the export is present (no disabled tests).
const rawExportPresent = existsSync(`${RAW_DIR}/weights.bin`);

if (rawExportPresent) {
  describe("loadShowpiece (raw export, float precision)", () => {
    test("forward pass of the final snapshot reproduces the oracle to float tolerance", async () => {
      const showpiece = await loadFromRawExport();
      const converged = showpiece.trajectory(
        fixture.snapshotIndex,
        fixture.sampleCount
      );
      expect(deviationFromFixture(converged, fixture)).toBeLessThan(
        FLOAT_TOLERANCE
      );
    });

    test("decode(pack(raw)) tracks the raw trajectory within the quantised tolerance", async () => {
      const raw = await loadFromRawExport();
      const packed = await loadFromPackedAsset();
      for (const i of [0, 18, 36]) {
        const deviation = maxTrajectoryDeviation(
          raw.trajectory(i, 300),
          packed.trajectory(i, 300)
        );
        expect(deviation).toBeLessThan(QUANTISED_TOLERANCE);
      }
    });
  });
}
