#!/usr/bin/env python3
"""Reference oracle for the Lorenz showpiece forward pass.

Independent re-implementation (pure stdlib, no numpy) of the AnyPINN forward
recipe described by `.showpiece/lorenz/manifest.json`. It exists to verify the
TypeScript `lorenz-forward` core: both read the same little-endian float32
weight snapshots and must agree to float tolerance.

It reads the gitignored raw export and writes a small, committed fixture of the
final snapshot's trajectory, sampled uniformly over the input domain. The
fixture (not this script) is what `bun test` consumes, so CI needs neither
Python nor the raw export.

Usage:
    python3 scripts/oracle/forward_oracle.py \
        --raw .showpiece/lorenz \
        --out src/showpiece/__fixtures__/lorenz-final-trajectory.json \
        --samples 300
"""

from __future__ import annotations

import argparse
import json
import math
import struct
from pathlib import Path


def read_float32(buf: bytes, offset_floats: int, count: int) -> list[float]:
    """Read `count` little-endian float32 values starting at a float index."""
    start = offset_floats * 4
    return list(struct.unpack_from(f"<{count}f", buf, start))


def decode_snapshot(buf: bytes, snapshot: dict, layers: list[dict], fields: list[str]) -> dict:
    """Decode one snapshot into per-field lists of (weight, bias) per layer.

    Layout (per manifest `weightLayout`): per snapshot, for each field in
    `fieldOrder`, for each linear layer in order, weight[out*in] row-major
    (out-major) immediately followed by bias[out]; fields concatenated.
    """
    cursor = snapshot["byteOffset"] // 4
    net = {}
    for field in fields:
        field_layers = []
        for layer in layers:
            n_in, n_out = layer["in"], layer["out"]
            weight = read_float32(buf, cursor, n_out * n_in)
            cursor += n_out * n_in
            bias = read_float32(buf, cursor, n_out)
            cursor += n_out
            field_layers.append((n_in, n_out, weight, bias))
        net[field] = field_layers
    return net


def forward_field(field_layers: list, tau: float) -> float:
    """Forward a single scalar input through one field MLP.

    tanh between layers, none after the last. Summation order is fixed
    (input index inner loop) so the TypeScript core can reproduce it exactly.
    """
    activations = [tau]
    last = len(field_layers) - 1
    for li, (n_in, n_out, weight, bias) in enumerate(field_layers):
        out = [0.0] * n_out
        for o in range(n_out):
            acc = bias[o]
            base = o * n_in
            for i in range(n_in):
                acc += weight[base + i] * activations[i]
            out[o] = acc
        if li != last:
            out = [math.tanh(v) for v in out]
        activations = out
    return activations[0]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", default=".showpiece/lorenz")
    parser.add_argument("--out", default="src/showpiece/__fixtures__/lorenz-final-trajectory.json")
    parser.add_argument("--samples", type=int, default=300)
    args = parser.parse_args()

    if args.samples < 2:
        parser.error("--samples must be >= 2 (uniform sampling needs both endpoints)")

    raw = Path(args.raw)
    manifest = json.loads((raw / "manifest.json").read_text())
    weights = (raw / manifest["weightsFile"]).read_bytes()

    layers = manifest["layers"]
    fields = manifest["fieldOrder"]
    scale = manifest["scale"]
    domain_lo, domain_hi = manifest["inputDomain"]

    snapshot_index = manifest["snapshotCount"] - 1
    snapshot = manifest["snapshots"][snapshot_index]
    net = decode_snapshot(weights, snapshot, layers, fields)

    n = args.samples
    taus = [domain_lo + (domain_hi - domain_lo) * (k / (n - 1)) for k in range(n)]
    series = {field: [forward_field(net[field], tau) * scale for tau in taus] for field in fields}

    fixture = {
        "system": manifest["system"],
        "note": "Final-snapshot trajectory from the pure-Python forward oracle; ground truth for lorenz-forward. Regenerate with scripts/oracle/forward_oracle.py.",
        "snapshotIndex": snapshot_index,
        "epoch": snapshot["epoch"],
        "scale": scale,
        "sampleCount": n,
        "tau": taus,
        "x": series["x"],
        "y": series["y"],
        "z": series["z"],
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(fixture, indent=2) + "\n")

    xs = series["x"]
    print(f"wrote {out} ({n} samples)")
    print(f"x range: [{min(xs):.3f}, {max(xs):.3f}]  sign-crossing lobes: {any(a < 0 for a in xs) and any(a > 0 for a in xs)}")


if __name__ == "__main__":
    main()
