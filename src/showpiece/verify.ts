/**
 * Trajectory-quality predicates shared by the pack-time verification gate and
 * the seam-#1 tests. Pure functions over a {@link Trajectory}; they encode the
 * showpiece's actual claim — the butterfly forms (both lobes) and never
 * diverges (bounded, finite coordinates).
 */

import type { Trajectory } from "./lorenz-forward";

/** The double-lobed butterfly requires the x field to cross zero in both signs. */
export function hasBothLobes(trajectory: Trajectory): boolean {
  let sawNegative = false;
  let sawPositive = false;
  for (const value of trajectory.x) {
    if (value < 0) {
      sawNegative = true;
    } else if (value > 0) {
      sawPositive = true;
    }
    if (sawNegative && sawPositive) {
      return true;
    }
  }
  return false;
}

/** Largest absolute coordinate across all three fields (Infinity if any NaN). */
export function maxAbsCoord(trajectory: Trajectory): number {
  let max = 0;
  for (const field of [trajectory.x, trajectory.y, trajectory.z]) {
    for (const value of field) {
      if (!Number.isFinite(value)) {
        return Number.POSITIVE_INFINITY;
      }
      const abs = Math.abs(value);
      if (abs > max) {
        max = abs;
      }
    }
  }
  return max;
}

/** No NaN/Infinity and every coordinate within `bound` of the origin. */
export function isBounded(trajectory: Trajectory, bound: number): boolean {
  return maxAbsCoord(trajectory) <= bound;
}

/** Max absolute per-sample deviation between two same-length trajectories. */
export function maxTrajectoryDeviation(a: Trajectory, b: Trajectory): number {
  if (a.x.length !== b.x.length) {
    throw new Error(
      `trajectory length mismatch: ${a.x.length} vs ${b.x.length}`
    );
  }
  let max = 0;
  for (let k = 0; k < a.x.length; k++) {
    max = Math.max(
      max,
      Math.abs(a.x[k] - b.x[k]),
      Math.abs(a.y[k] - b.y[k]),
      Math.abs(a.z[k] - b.z[k])
    );
  }
  return max;
}
