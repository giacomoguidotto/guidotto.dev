import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { FetchLike } from "~/showpiece/asset";
import { type FinaleData, loadFinaleData, TUBE_SAMPLES } from "./finale-data";

// finale-data's pure transform: it loads the committed asset and precomputes the
// scene-space centerlines + motes the renderer consumes. The invariants worth
// pinning are framework-free — shape (one centerline per snapshot, the right
// lengths), finiteness, and the recentring (the converged butterfly sits on the
// origin so it orbits cleanly).

const PACKED_DIR = `${import.meta.dir}/../../../public/showpiece/lorenz`;
// toBeCloseTo digits: a midpoint within 5e-4 of the origin (the recentring is
// exact bar float32 error).
const RECENTER_DIGITS = 3;

/** A fetch that serves the committed asset straight off disk. */
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

/** Midpoint of one component (0=x, 1=z-up, 2=y-depth) across a centerline. */
function axisMidpoint(line: Float32Array, component: 0 | 1 | 2): number {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < TUBE_SAMPLES; i++) {
    const v = line[i * 3 + component];
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return (lo + hi) / 2;
}

const load = (): Promise<FinaleData> =>
  loadFinaleData({ baseUrl: PACKED_DIR, fetch: diskFetch });

describe("loadFinaleData", () => {
  test("yields one scene-space centerline per snapshot, correctly sized", async () => {
    const data = await load();
    expect(data.snapshotCount).toBe(37);
    expect(data.centerlines).toHaveLength(37);
    for (const line of data.centerlines) {
      expect(line).toHaveLength(TUBE_SAMPLES * 3);
      expect(line.every(Number.isFinite)).toBe(true);
    }
  });

  test("maps every observation into a scene-space mote", async () => {
    const data = await load();
    expect(data.moteCount).toBe(300);
    expect(data.motes).toHaveLength(data.moteCount * 3);
    expect(data.motes.every(Number.isFinite)).toBe(true);
  });

  test("recentres the converged butterfly on the origin", async () => {
    const data = await load();
    const final = data.centerlines[data.snapshotCount - 1];
    expect(axisMidpoint(final, 0)).toBeCloseTo(0, RECENTER_DIGITS);
    expect(axisMidpoint(final, 1)).toBeCloseTo(0, RECENTER_DIGITS);
    expect(axisMidpoint(final, 2)).toBeCloseTo(0, RECENTER_DIGITS);
  });

  test("rests on a settled snapshot near — but not at — the frozen tail", async () => {
    const data = await load();
    // The last training snapshots are visually identical (the net converged), so
    // the settle point should land in that frozen tail but never be snapshot 0
    // (which would mean the curve never converges).
    expect(data.settleIndex).toBeGreaterThan(0);
    expect(data.settleIndex).toBeLessThanOrEqual(data.snapshotCount - 1);

    const final = data.centerlines[data.snapshotCount - 1];
    const maxDist = (line: Float32Array): number => {
      let m = 0;
      for (let i = 0; i < line.length; i += 3) {
        const dx = line[i] - final[i];
        const dy = line[i + 1] - final[i + 1];
        const dz = line[i + 2] - final[i + 2];
        m = Math.max(m, Math.hypot(dx, dy, dz));
      }
      return m;
    };
    // The settle snapshot matches the converged shape; the one before it does not
    // (so it is the FIRST settled snapshot, not an over-eager early rest).
    const settled = maxDist(data.centerlines[data.settleIndex]);
    if (data.settleIndex > 0) {
      const before = maxDist(data.centerlines[data.settleIndex - 1]);
      expect(settled).toBeLessThan(before);
    }
  });

  test("surfaces a load failure rather than resolving empty", async () => {
    const notFound: FetchLike = () =>
      Promise.resolve(new Response(null, { status: 404 }));
    await expect(
      loadFinaleData({ baseUrl: PACKED_DIR, fetch: notFound })
    ).rejects.toThrow();
  });
});
