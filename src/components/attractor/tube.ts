// tube — a rotation-minimizing tube swept around a polyline centerline, written
// in place into a fixed-size position buffer every frame.
//
// Why not THREE.TubeGeometry: that rebuilds (and must dispose) a geometry per
// frame as the centerline morphs. Instead we own one BufferGeometry of a fixed
// vertex count and overwrite its positions each frame — zero per-frame
// allocation, zero disposal, and (unlike fat lines) it is a real triangle mesh,
// so three's depth fog dims the far lobe for free and bloom thickens it into a
// glowing strand. The material is unlit/additive, so we never need normals.
//
// The cross-section frame is PARALLEL-TRANSPORTED along the curve (the double
// reflection method, Wang et al. 2008): seed one frame at sample 0, then carry
// it forward sample to sample. A per-sample fixed-up frame would flip whenever
// the tangent crossed near-parallel to up — that discontinuity pinches the ring
// strip into a self-crossing bowtie that additive bloom flares into a bright
// star. The Lorenz lobes are near-vertical spirals, so a fixed-up frame flips
// constantly; transport removes the flip outright, for the morph and the
// converged final state alike. The seed (sample 0, with no prior frame to flip
// against) still uses the fixed-up trick.

const UP_X = 0;
const UP_Y = 1;
const UP_Z = 0;
const FALLBACK_X = 1;
const FALLBACK_Y = 0;
const FALLBACK_Z = 0;
const PARALLEL_EPS = 0.92;
// Below this squared length a reflection step is a no-op (coincident samples or
// an unchanged tangent), so we skip it and carry the frame through unchanged.
const DEGENERATE_EPS = 1e-12;

/** Triangle index for a `samples` x `radial` tube. Built once, reused forever. */
export function buildTubeIndex(samples: number, radial: number): Uint16Array {
  const index = new Uint16Array((samples - 1) * radial * 6);
  let o = 0;
  for (let i = 0; i < samples - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const jn = (j + 1) % radial;
      const a = i * radial + j;
      const b = i * radial + jn;
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + jn;
      index[o++] = a;
      index[o++] = c;
      index[o++] = b;
      index[o++] = b;
      index[o++] = c;
      index[o++] = d;
    }
  }
  return index;
}

/** Linear blend of two same-length centerlines into `out` (the morph step). */
export function lerpCenterline(
  out: Float32Array,
  a: Float32Array,
  b: Float32Array,
  t: number
): void {
  for (let i = 0; i < out.length; i++) {
    out[i] = a[i] + (b[i] - a[i]) * t;
  }
}

/** Tangent at sample `i` (central difference, clamped at the ends), normalised. */
function tangentAt(
  line: Float32Array,
  i: number,
  samples: number,
  out: Float32Array
): void {
  const prev = Math.max(0, i - 1);
  const next = Math.min(samples - 1, i + 1);
  let tx = line[next * 3] - line[prev * 3];
  let ty = line[next * 3 + 1] - line[prev * 3 + 1];
  let tz = line[next * 3 + 2] - line[prev * 3 + 2];
  const len = Math.hypot(tx, ty, tz) || 1;
  tx /= len;
  ty /= len;
  tz /= len;
  out[0] = tx;
  out[1] = ty;
  out[2] = tz;
}

/** Seed a cross-section normal at sample 0 from the fixed up vector (swapped to
 *  the fallback when the tangent runs near-parallel to it), written into `out`.
 *  Only sample 0 needs this — every later frame is transported, never seeded. */
function seedNormal(
  tx: number,
  ty: number,
  tz: number,
  out: Float32Array
): void {
  const parallel = Math.abs(tx * UP_X + ty * UP_Y + tz * UP_Z) > PARALLEL_EPS;
  const ux = parallel ? FALLBACK_X : UP_X;
  const uy = parallel ? FALLBACK_Y : UP_Y;
  const uz = parallel ? FALLBACK_Z : UP_Z;
  const nx = uy * tz - uz * ty;
  const ny = uz * tx - ux * tz;
  const nz = ux * ty - uy * tx;
  const nl = Math.hypot(nx, ny, nz) || 1;
  out[0] = nx / nl;
  out[1] = ny / nl;
  out[2] = nz / nl;
}

/** Sweep a `radius` tube of `radial` sides around `line` into `positions`. */
export function writeTube(
  positions: Float32Array,
  line: Float32Array,
  samples: number,
  radial: number,
  radius: number
): void {
  const tan = new Float32Array(3);
  // The transported frame: previous point, previous tangent, current normal.
  let px = line[0];
  let py = line[1];
  let pz = line[2];
  tangentAt(line, 0, samples, tan);
  let tx = tan[0];
  let ty = tan[1];
  let tz = tan[2];
  const seed = new Float32Array(3);
  seedNormal(tx, ty, tz, seed);
  let nx = seed[0];
  let ny = seed[1];
  let nz = seed[2];

  for (let i = 0; i < samples; i++) {
    if (i > 0) {
      const cx0 = line[i * 3];
      const cy0 = line[i * 3 + 1];
      const cz0 = line[i * 3 + 2];
      tangentAt(line, i, samples, tan);
      const t1x = tan[0];
      const t1y = tan[1];
      const t1z = tan[2];

      // Double reflection: reflect the frame across the plane bisecting the
      // segment, then onto the new tangent — a rotation-minimizing transport.
      const v1x = cx0 - px;
      const v1y = cy0 - py;
      const v1z = cz0 - pz;
      const c1 = v1x * v1x + v1y * v1y + v1z * v1z;
      let rLx = nx;
      let rLy = ny;
      let rLz = nz;
      let tLx = tx;
      let tLy = ty;
      let tLz = tz;
      if (c1 > DEGENERATE_EPS) {
        const kr = (2 / c1) * (v1x * nx + v1y * ny + v1z * nz);
        rLx = nx - kr * v1x;
        rLy = ny - kr * v1y;
        rLz = nz - kr * v1z;
        const kt = (2 / c1) * (v1x * tx + v1y * ty + v1z * tz);
        tLx = tx - kt * v1x;
        tLy = ty - kt * v1y;
        tLz = tz - kt * v1z;
      }
      const v2x = t1x - tLx;
      const v2y = t1y - tLy;
      const v2z = t1z - tLz;
      const c2 = v2x * v2x + v2y * v2y + v2z * v2z;
      let r1x = rLx;
      let r1y = rLy;
      let r1z = rLz;
      if (c2 > DEGENERATE_EPS) {
        const k = (2 / c2) * (v2x * rLx + v2y * rLy + v2z * rLz);
        r1x = rLx - k * v2x;
        r1y = rLy - k * v2y;
        r1z = rLz - k * v2z;
      }
      // Re-orthonormalise against the new tangent and adopt as the frame, so the
      // ring stays exactly perpendicular (and exactly `radius` off the line).
      const dot = r1x * t1x + r1y * t1y + r1z * t1z;
      r1x -= dot * t1x;
      r1y -= dot * t1y;
      r1z -= dot * t1z;
      const rl = Math.hypot(r1x, r1y, r1z) || 1;
      nx = r1x / rl;
      ny = r1y / rl;
      nz = r1z / rl;
      tx = t1x;
      ty = t1y;
      tz = t1z;
      px = cx0;
      py = cy0;
      pz = cz0;
    }

    // binormal = tangent x normal (both unit and orthogonal).
    const bx = ty * nz - tz * ny;
    const by = tz * nx - tx * nz;
    const bz = tx * ny - ty * nx;

    const cx = line[i * 3];
    const cy = line[i * 3 + 1];
    const cz = line[i * 3 + 2];
    for (let j = 0; j < radial; j++) {
      const theta = (j / radial) * Math.PI * 2;
      const co = Math.cos(theta) * radius;
      const si = Math.sin(theta) * radius;
      const v = (i * radial + j) * 3;
      positions[v] = cx + co * nx + si * bx;
      positions[v + 1] = cy + co * ny + si * by;
      positions[v + 2] = cz + co * nz + si * bz;
    }
  }
}
