/**
 * showpiece-asset codec — the ingest/transport packing for the Lorenz weights.
 *
 * The raw export is ~14.8 MB of float32. This codec reduces it for the
 * committed deploy asset and reverses the reduction at runtime:
 *
 *   pack:   float32 -> round to float16 (half size) -> gzip
 *   unpack: gunzip -> widen float16 -> float32 ArrayBuffer
 *
 * The widened float32 buffer is exactly what `lorenz-forward` consumes, so its
 * manifest `byteOffset`s stay float32 offsets regardless of how the bytes were
 * shipped. float16 (~3 decimal digits) is lossy, but the showpiece's claim is
 * the butterfly forming (both lobes, no divergence), not parameter precision —
 * the pack script's verification gate proves the packed trajectory still holds.
 *
 * Runtime portability: the *decode* path (what ships to browsers) depends only
 * on `DecompressionStream` (Baseline 2023) and a hand-rolled half->float32
 * widen — deliberately NOT on `Float16Array` (Baseline 2025), which is still
 * absent from a meaningful slice of in-the-wild browsers. The *encode* path uses
 * `Float16Array`, but it only runs at build time under Bun (`pack:showpiece`),
 * never in a browser. The widening reads bytes little-endian explicitly, so
 * decode is also host-endianness independent.
 */

/** On-disk description of a packed weights buffer (committed in the manifest). */
export interface WeightsEncoding {
  /** Byte order of the float16 words. All deploy/CI targets are little-endian. */
  readonly byteOrder: "little";
  readonly compression: "gzip";
  /** Quantisation applied to each float32 before compression. */
  readonly dtype: "float16";
  /** Number of float32 elements after dequantisation (whole weights buffer). */
  readonly floatCount: number;
}

export const WEIGHTS_ENCODING = {
  dtype: "float16",
  byteOrder: "little",
  compression: "gzip",
} as const satisfies Omit<WeightsEncoding, "floatCount">;

function assertLittleEndian(): void {
  const probe = new Uint16Array([1]);
  const littleEndian = new Uint8Array(probe.buffer)[0] === 1;
  if (!littleEndian) {
    throw new Error(
      "showpiece codec requires a little-endian host (manifest byteOrder is 'little')"
    );
  }
}

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

// lib.dom types `CompressionStream` with a `BufferSource` writable side, which
// trips `pipeThrough`'s invariant chunk check against a `Uint8Array` source.
// The runtime contract (byte stream in, byte stream out) is sound; narrow it.
type ByteTransform = ReadableWritablePair<Uint8Array, Uint8Array>;

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const transform = new CompressionStream("gzip") as unknown as ByteTransform;
  const compressed = streamOf(bytes).pipeThrough(transform);
  return new Uint8Array(await new Response(compressed).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const transform = new DecompressionStream("gzip") as unknown as ByteTransform;
  const inflated = streamOf(bytes).pipeThrough(transform);
  return new Uint8Array(await new Response(inflated).arrayBuffer());
}

/** Pack a float32 weights buffer into the committed `dtype=float16 + gzip` form. */
export async function encodeWeights(weights: Float32Array): Promise<{
  readonly bytes: Uint8Array;
  readonly encoding: WeightsEncoding;
}> {
  assertLittleEndian();
  const half = new Float16Array(weights);
  const halfBytes = new Uint8Array(
    half.buffer,
    half.byteOffset,
    half.byteLength
  );
  const bytes = await gzip(halfBytes);
  return {
    bytes,
    encoding: { ...WEIGHTS_ENCODING, floatCount: weights.length },
  };
}

/**
 * Widen one IEEE-754 half-precision word (uint16) to a float32-representable
 * number. Pure arithmetic — no `Float16Array` — so the decode path runs on any
 * browser regardless of float16 typed-array support.
 */
function halfToFloat(half: number): number {
  // biome-ignore-start lint/suspicious/noBitwiseOperators: decoding an IEEE-754 half word into sign/exponent/mantissa is exactly what bit masks and shifts are for.
  const sign = (half & 0x80_00) === 0 ? 1 : -1;
  const exponent = (half & 0x7c_00) >> 10;
  const mantissa = half & 0x03_ff;
  // biome-ignore-end lint/suspicious/noBitwiseOperators: end half-word bit field extraction.
  if (exponent === 0) {
    // Subnormal (or signed zero): no implicit leading 1.
    return sign * 2 ** -14 * (mantissa / 1024);
  }
  if (exponent === 0x1f) {
    return mantissa === 0 ? sign * Number.POSITIVE_INFINITY : Number.NaN;
  }
  return sign * 2 ** (exponent - 15) * (1 + mantissa / 1024);
}

/**
 * Reverse {@link encodeWeights}: gunzip and widen back to a float32 ArrayBuffer
 * laid out exactly as `lorenz-forward` expects. Uses no `Float16Array`, so it is
 * safe on browsers without Baseline-2025 float16 typed arrays.
 */
export async function decodeWeights(
  packed: Uint8Array | ArrayBuffer,
  encoding: WeightsEncoding
): Promise<ArrayBuffer> {
  if (encoding.dtype !== "float16" || encoding.compression !== "gzip") {
    throw new Error(
      `unsupported weights encoding: ${encoding.dtype}/${encoding.compression}`
    );
  }
  if (!Number.isInteger(encoding.floatCount) || encoding.floatCount <= 0) {
    throw new Error(
      `invalid weights encoding floatCount: ${encoding.floatCount}`
    );
  }

  const gzBytes =
    packed instanceof ArrayBuffer ? new Uint8Array(packed) : packed;
  const halfBytes = await gunzip(gzBytes);
  // Two bytes per float16 word (literal, not `Float16Array.BYTES_PER_ELEMENT`,
  // so the decode path never touches the float16 global).
  if (halfBytes.byteLength !== encoding.floatCount * 2) {
    throw new Error(
      `decoded ${halfBytes.byteLength} bytes, expected ${encoding.floatCount * 2} for ${encoding.floatCount} float16 words`
    );
  }

  // Read each half word little-endian (manifest byteOrder is 'little') and widen
  // by hand, so neither host endianness nor `Float16Array` support matters.
  const view = new DataView(
    halfBytes.buffer,
    halfBytes.byteOffset,
    halfBytes.byteLength
  );
  const out = new Float32Array(encoding.floatCount);
  for (let i = 0; i < encoding.floatCount; i++) {
    out[i] = halfToFloat(view.getUint16(i * 2, true));
  }
  return out.buffer;
}
