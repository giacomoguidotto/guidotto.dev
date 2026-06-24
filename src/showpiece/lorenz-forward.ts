/**
 * lorenz-forward — the framework-free compute core for The Attractor showpiece.
 *
 * No React, no WebGL, no I/O. Given a decoded manifest and the float32 weights
 * buffer, it answers queries about the AnyPINN Lorenz model: how many training
 * snapshots exist, the noisy observations the network was fitted to, and — for
 * any snapshot — the trajectory the three field MLPs (x, y, z) produce, plus the
 * recovered parameters and loss.
 *
 * Hidden implementation (the depth behind the small interface):
 *   - per-snapshot, per-field, per-linear-layer weight-then-bias walk
 *     (1 -> 64 -> 128 -> 128 -> 64 -> 1), `tanh` between layers and none after
 *     the last;
 *   - input `tau` in [0, 1] sampled uniformly over the manifest input domain;
 *   - network output scaled by `manifest.scale` to physical coordinates;
 *   - trajectories memoised by (snapshotIndex, sampleCount).
 *
 * It accepts decoded buffers as arguments, returns values, and has no side
 * effects. The reference oracle (`scripts/oracle/forward_oracle.py`) pins the
 * arithmetic — both read the same little-endian float32 weights and must agree
 * to float tolerance, so the "genuinely live" forward pass is provable.
 *
 * Consumer note: `trajectory()` is synchronous and a full precompute (37
 * snapshots x 300 samples x 3 MLPs) is ~1B multiply-adds. Run it off the main
 * thread (Web Worker) or yield between snapshots — this module is pure and takes
 * plain buffers precisely so it can be hoisted into a worker wholesale.
 */

export interface LayerSpec {
  readonly in: number;
  readonly out: number;
}

export interface SnapshotMeta {
  readonly beta: number;
  readonly byteLength: number;
  /** Byte offset of this snapshot's weights within the float32 buffer. */
  readonly byteOffset: number;
  readonly epoch: number;
  readonly floatCount: number;
  readonly loss: number | null;
  readonly rho: number;
  readonly sigma: number;
}

/** The noisy scatter the inverse problem was fitted to (300 points). */
export interface Observations {
  readonly count: number;
  readonly t: readonly number[];
  readonly tau: readonly number[];
  readonly x: readonly number[];
  readonly y: readonly number[];
  readonly z: readonly number[];
}

export interface ShowpieceManifest {
  readonly activation: "tanh";
  /** Field MLP order in the weights buffer, e.g. ["x", "y", "z"]. */
  readonly fieldOrder: readonly string[];
  /** Closed input range for `tau`, e.g. [0, 1]. */
  readonly inputDomain: readonly [number, number];
  readonly layers: readonly LayerSpec[];
  readonly observations: Observations;
  readonly paramOrder: readonly string[];
  /** Multiplier from network output to physical coordinates. */
  readonly scale: number;
  readonly snapshotCount: number;
  readonly snapshots: readonly SnapshotMeta[];
  readonly system: string;
  readonly tTotal: number;
}

/** Recovered Lorenz constants at a snapshot (HUD garnish, no truth-claim). */
export interface Params {
  readonly beta: number;
  readonly rho: number;
  readonly sigma: number;
}

/**
 * A sampled trajectory in physical coordinates, one columnar `Float64Array` per
 * axis. float64 (not float32) so the forward pass stays bit-comparable with the
 * Python oracle; a WebGL consumer narrows these to `Float32Array` on upload.
 */
export interface Trajectory {
  readonly tau: Float64Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly z: Float64Array;
}

/** The small query interface over a decoded showpiece. */
export interface Showpiece {
  loss(snapshotIndex: number): number | null;
  readonly observations: Observations;
  params(snapshotIndex: number): Params;
  readonly snapshotCount: number;
  /** Forward the snapshot's field MLPs at `sampleCount` uniform `tau` samples. */
  trajectory(snapshotIndex: number, sampleCount: number): Trajectory;
}

interface Layer {
  readonly bias: Float32Array;
  readonly nIn: number;
  readonly nOut: number;
  readonly weight: Float32Array;
}

type FieldNetwork = readonly Layer[];

function assertIndex(snapshotIndex: number, count: number): void {
  if (
    !Number.isInteger(snapshotIndex) ||
    snapshotIndex < 0 ||
    snapshotIndex >= count
  ) {
    throw new RangeError(
      `snapshotIndex ${snapshotIndex} out of range [0, ${count})`
    );
  }
}

/**
 * Slice one snapshot's float32 weights into per-field, per-layer views.
 *
 * Layout (manifest `weightLayout`): per snapshot, for each field in
 * `fieldOrder`, for each linear layer in order, `weight[out*in]` row-major
 * (out-major) immediately followed by `bias[out]`; fields are concatenated.
 */
function decodeNetworks(
  manifest: ShowpieceManifest,
  weights: Float32Array,
  snapshot: SnapshotMeta
): readonly FieldNetwork[] {
  const buffer = weights.buffer;
  let cursor = snapshot.byteOffset / Float32Array.BYTES_PER_ELEMENT;

  // One MLP per field, consuming the buffer sequentially in `fieldOrder`.
  return manifest.fieldOrder.map(() => {
    const layers: Layer[] = [];
    for (const { in: nIn, out: nOut } of manifest.layers) {
      const weight = new Float32Array(buffer, cursor * 4, nOut * nIn);
      cursor += nOut * nIn;
      const bias = new Float32Array(buffer, cursor * 4, nOut);
      cursor += nOut;
      layers.push({ nIn, nOut, weight, bias });
    }
    return layers;
  });
}

/**
 * Forward a single scalar input through one field MLP.
 *
 * `tanh` between layers, none after the last. Summation order (input index as
 * the inner loop) is fixed so the Python oracle reproduces it bit-comparably.
 */
function evalField(network: FieldNetwork, tau: number): number {
  let activations = new Float64Array(1);
  activations[0] = tau;
  const last = network.length - 1;

  for (let li = 0; li < network.length; li++) {
    const { nIn, nOut, weight, bias } = network[li];
    const out = new Float64Array(nOut);
    for (let o = 0; o < nOut; o++) {
      let acc = bias[o];
      const base = o * nIn;
      for (let i = 0; i < nIn; i++) {
        acc += weight[base + i] * activations[i];
      }
      out[o] = li === last ? acc : Math.tanh(acc);
    }
    activations = out;
  }
  return activations[0];
}

/**
 * Decode a manifest + weights buffer once and return the small query interface.
 *
 * `weightsBuffer` is the raw little-endian float32 buffer the manifest's
 * `byteOffset`s index into (whatever transport produced it). No copies of the
 * weights are made; snapshots are sliced as typed-array views on demand and
 * cached, and trajectories are memoised by (snapshotIndex, sampleCount).
 */
export function loadShowpiece(
  manifest: ShowpieceManifest,
  weightsBuffer: ArrayBuffer
): Showpiece {
  const weights = new Float32Array(weightsBuffer);
  const { snapshotCount, snapshots, scale } = manifest;
  const [domainLo, domainHi] = manifest.inputDomain;

  const networkCache = new Map<number, readonly FieldNetwork[]>();
  // Memo caches assume the showpiece's small fixed set of (snapshot, sampleCount)
  // queries (~37 snapshots at one or two sample counts). They are unbounded by
  // design; a consumer that varies sampleCount freely would need an LRU bound.
  const trajectoryCache = new Map<string, Trajectory>();

  function networksFor(snapshotIndex: number): readonly FieldNetwork[] {
    const cached = networkCache.get(snapshotIndex);
    if (cached) {
      return cached;
    }
    const decoded = decodeNetworks(manifest, weights, snapshots[snapshotIndex]);
    networkCache.set(snapshotIndex, decoded);
    return decoded;
  }

  return {
    snapshotCount,
    observations: manifest.observations,

    trajectory(snapshotIndex: number, sampleCount: number): Trajectory {
      assertIndex(snapshotIndex, snapshotCount);
      if (!Number.isInteger(sampleCount) || sampleCount < 1) {
        throw new RangeError(`sampleCount ${sampleCount} must be >= 1`);
      }

      const key = `${snapshotIndex}:${sampleCount}`;
      const memo = trajectoryCache.get(key);
      if (memo) {
        return memo;
      }

      const [netX, netY, netZ] = networksFor(snapshotIndex);
      const tau = new Float64Array(sampleCount);
      const x = new Float64Array(sampleCount);
      const y = new Float64Array(sampleCount);
      const z = new Float64Array(sampleCount);
      const span = domainHi - domainLo;

      for (let k = 0; k < sampleCount; k++) {
        const u = sampleCount === 1 ? 0 : k / (sampleCount - 1);
        const t = domainLo + span * u;
        tau[k] = t;
        x[k] = evalField(netX, t) * scale;
        y[k] = evalField(netY, t) * scale;
        z[k] = evalField(netZ, t) * scale;
      }

      const trajectory: Trajectory = { tau, x, y, z };
      trajectoryCache.set(key, trajectory);
      return trajectory;
    },

    params(snapshotIndex: number): Params {
      assertIndex(snapshotIndex, snapshotCount);
      const s = snapshots[snapshotIndex];
      return { sigma: s.sigma, rho: s.rho, beta: s.beta };
    },

    loss(snapshotIndex: number): number | null {
      assertIndex(snapshotIndex, snapshotCount);
      return snapshots[snapshotIndex].loss;
    },
  };
}
