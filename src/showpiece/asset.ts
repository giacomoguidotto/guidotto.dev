/**
 * showpiece-asset runtime — lazily fetch the committed packed asset and reverse
 * the packing into the float buffers `lorenz-forward` consumes.
 *
 * This is the runtime half of the `showpiece-asset` seam (the pack script
 * `scripts/pack-showpiece.ts` is the build half). It fetches the small JSON
 * manifest and the gzipped float16 weights, decodes them via the shared codec,
 * and hands the result to {@link loadShowpiece}. It does no rendering and holds
 * no React/WebGL — the WebGL finale calls this once when it scrolls into view.
 */

import { decodeWeights, type WeightsEncoding } from "./codec";
import {
  loadShowpiece,
  type Showpiece,
  type ShowpieceManifest,
} from "./lorenz-forward";

/** The committed manifest: the forward-core manifest plus transport metadata. */
export type PackedManifest = ShowpieceManifest & {
  /** Filename of the gzipped float16 weights, relative to the manifest. */
  readonly weightsFile: string;
  readonly weightsEncoding: WeightsEncoding;
};

export interface LoadShowpieceAssetOptions {
  /** Base path the asset is served from. Default: `/showpiece/lorenz`. */
  readonly baseUrl?: string;
  /** Injectable fetch (tests serve the committed files from disk). */
  readonly fetch?: FetchLike;
}

/** The narrow slice of `fetch` this loader needs (just URL string -> Response). */
export type FetchLike = (url: string) => Promise<Response>;

const DEFAULT_BASE_URL = "/showpiece/lorenz";
const TRAILING_SLASHES = /\/+$/;

export interface LoadedShowpiece {
  readonly manifest: PackedManifest;
  readonly showpiece: Showpiece;
}

/**
 * Fail loudly and legibly if the fetched JSON is not a packed manifest, before
 * the codec dereferences `weightsEncoding.dtype` into an opaque `TypeError`.
 */
function assertPackedManifest(value: unknown): asserts value is PackedManifest {
  const manifest = value as Partial<PackedManifest> | null;
  const encoding = manifest?.weightsEncoding;
  if (
    typeof manifest?.weightsFile !== "string" ||
    typeof encoding !== "object" ||
    encoding === null ||
    typeof encoding.dtype !== "string" ||
    typeof encoding.compression !== "string"
  ) {
    throw new Error(
      "malformed showpiece manifest: missing weightsFile or weightsEncoding"
    );
  }
}

/**
 * Fetch + decode the packed asset and return a ready {@link Showpiece}.
 *
 * Two requests: the JSON manifest, then the gzipped float16 weights. The codec
 * reverses `gzip` + `float16` into the float32 buffer the forward core expects.
 */
export async function loadShowpieceAsset(
  options: LoadShowpieceAssetOptions = {}
): Promise<LoadedShowpiece> {
  const base = (options.baseUrl ?? DEFAULT_BASE_URL).replace(
    TRAILING_SLASHES,
    ""
  );
  const fetchImpl = options.fetch ?? globalThis.fetch;

  const manifestResponse = await fetchImpl(`${base}/manifest.json`);
  if (!manifestResponse.ok) {
    throw new Error(
      `failed to fetch showpiece manifest: ${manifestResponse.status}`
    );
  }
  const manifest = (await manifestResponse.json()) as PackedManifest;
  assertPackedManifest(manifest);

  const weightsResponse = await fetchImpl(`${base}/${manifest.weightsFile}`);
  if (!weightsResponse.ok) {
    throw new Error(
      `failed to fetch showpiece weights: ${weightsResponse.status}`
    );
  }
  const packed = await weightsResponse.arrayBuffer();
  const weightsBuffer = await decodeWeights(packed, manifest.weightsEncoding);

  return { showpiece: loadShowpiece(manifest, weightsBuffer), manifest };
}
