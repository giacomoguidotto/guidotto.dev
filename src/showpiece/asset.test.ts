import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { type FetchLike, loadShowpieceAsset } from "./asset";
import { decodeWeights, encodeWeights } from "./codec";
import { loadShowpiece, type ShowpieceManifest } from "./lorenz-forward";
import { hasBothLobes, isBounded, maxTrajectoryDeviation } from "./verify";

// Seam #1, transport half: the committed asset round-trips through the runtime
// loader, and the codec reverses the pack exactly into the float buffers the
// forward core consumes.

const PACKED_DIR = `${import.meta.dir}/../../public/showpiece/lorenz`;
const RAW_DIR = `${import.meta.dir}/../../.showpiece/lorenz`;
const COORD_BOUND = 200;
const QUANTISED_TOLERANCE = 0.2;
const MANIFEST_ERROR = /manifest/;

async function readArrayBuffer(path: string): Promise<ArrayBuffer> {
  const buffer = await readFile(path);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
}

/** A fetch that serves the committed asset straight off disk. */
const diskFetch: FetchLike = async (input) => {
  if (!existsSync(input)) {
    return new Response(null, { status: 404 });
  }
  return new Response(await readArrayBuffer(input), { status: 200 });
};

describe("loadShowpieceAsset", () => {
  test("fetches + decodes the committed asset into a ready Showpiece", async () => {
    const { showpiece, manifest } = await loadShowpieceAsset({
      baseUrl: PACKED_DIR,
      fetch: diskFetch,
    });

    expect(manifest.weightsEncoding.dtype).toBe("float16");
    expect(manifest.weightsEncoding.compression).toBe("gzip");
    expect(showpiece.snapshotCount).toBe(37);
    expect(showpiece.observations.count).toBe(300);

    const converged = showpiece.trajectory(showpiece.snapshotCount - 1, 300);
    expect(hasBothLobes(converged)).toBe(true);
    expect(isBounded(converged, COORD_BOUND)).toBe(true);
  });

  test("trailing slashes in baseUrl are tolerated", async () => {
    const { showpiece } = await loadShowpieceAsset({
      baseUrl: `${PACKED_DIR}/`,
      fetch: diskFetch,
    });
    expect(showpiece.snapshotCount).toBe(37);
  });

  test("a failed fetch surfaces a clear error", async () => {
    const notFound: FetchLike = () =>
      Promise.resolve(new Response(null, { status: 404 }));
    await expect(
      loadShowpieceAsset({ baseUrl: PACKED_DIR, fetch: notFound })
    ).rejects.toThrow(MANIFEST_ERROR);
  });

  test("a malformed manifest fails with a legible error, not an opaque TypeError", async () => {
    const badManifest: FetchLike = (url) =>
      Promise.resolve(
        url.endsWith("manifest.json")
          ? Response.json({ system: "lorenz" }) // no weightsFile/weightsEncoding
          : new Response(null, { status: 404 })
      );
    await expect(
      loadShowpieceAsset({ baseUrl: PACKED_DIR, fetch: badManifest })
    ).rejects.toThrow(MANIFEST_ERROR);
  });
});

describe("codec", () => {
  test("float16 round-trip preserves values within half-precision error", async () => {
    const source = new Float32Array([
      0, 1, -1, 0.5, -0.25, 3.140_625, -8, 27, 19.28,
    ]);
    const { bytes, encoding } = await encodeWeights(source);
    expect(encoding.floatCount).toBe(source.length);

    const decoded = new Float32Array(await decodeWeights(bytes, encoding));
    expect(decoded).toHaveLength(source.length);
    for (let i = 0; i < source.length; i++) {
      expect(decoded[i]).toBeCloseTo(source[i], 2);
    }
  });

  test("decodeWeights rejects a length mismatch", async () => {
    const { bytes, encoding } = await encodeWeights(
      new Float32Array([1, 2, 3])
    );
    await expect(
      decodeWeights(bytes, { ...encoding, floatCount: 99 })
    ).rejects.toThrow();
  });

  test("decodeWeights rejects an unsupported encoding", async () => {
    const { bytes, encoding } = await encodeWeights(
      new Float32Array([1, 2, 3])
    );
    await expect(
      decodeWeights(bytes, { ...encoding, compression: "brotli" as never })
    ).rejects.toThrow();
  });
});

// decode(pack(raw)) reproduces the trajectory within tolerance — exercised end
// to end against the raw float32 export when it is present (gitignored, local).
// The suite is declared only when the export exists (no disabled tests).
const rawExportPresent = existsSync(`${RAW_DIR}/weights.bin`);

if (rawExportPresent) {
  describe("pack round-trip (raw export)", () => {
    test("encode then decode reproduces the converged butterfly", async () => {
      const rawManifest = JSON.parse(
        await readFile(`${RAW_DIR}/manifest.json`, "utf8")
      ) as Record<string, unknown>;
      const observations = JSON.parse(
        await readFile(`${RAW_DIR}/observations.json`, "utf8")
      );
      const rawBuffer = await readArrayBuffer(`${RAW_DIR}/weights.bin`);
      const manifest = { ...rawManifest, observations } as ShowpieceManifest;

      const { bytes, encoding } = await encodeWeights(
        new Float32Array(rawBuffer)
      );
      const roundTripped = await decodeWeights(bytes, encoding);

      const rawShowpiece = loadShowpiece(manifest, rawBuffer);
      const packedShowpiece = loadShowpiece(manifest, roundTripped);

      const last = manifest.snapshotCount - 1;
      const deviation = maxTrajectoryDeviation(
        rawShowpiece.trajectory(last, 300),
        packedShowpiece.trajectory(last, 300)
      );
      expect(deviation).toBeLessThan(QUANTISED_TOLERANCE);
      expect(hasBothLobes(packedShowpiece.trajectory(last, 300))).toBe(true);
      expect(
        isBounded(packedShowpiece.trajectory(last, 300), COORD_BOUND)
      ).toBe(true);
    });
  });
}
