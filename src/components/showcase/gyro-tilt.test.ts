import { describe, expect, test } from "bun:test";
import { TiltMapper } from "./gyro-tilt";

// The pure tilt → field-parallax maths: calibrate to the first reading (relative
// deltas), low-pass smooth, and clamp to the subtle range. The DOM controller
// (`startGyroTilt`) is the thin wiring on top and is exercised in the browser; the
// feel lives here.

const REST = { gamma: 0, beta: 0 };

describe("TiltMapper calibration", () => {
  test("the first reading is the rest pose (maps to zero offset)", () => {
    const mapper = new TiltMapper();
    // A phone held at an arbitrary angle: the first sample becomes the baseline,
    // so it parks the field at centre rather than jumping.
    expect(mapper.push({ gamma: 42, beta: -17 })).toEqual({ mx: 0, my: 0 });
  });

  test("offsets are relative to the calibrated baseline, not absolute angle", () => {
    const fromZero = new TiltMapper();
    fromZero.push(REST);
    const fromTilted = new TiltMapper();
    fromTilted.push({ gamma: 40, beta: 40 });
    // The same +5° delta from each baseline yields the same offset.
    const a = fromZero.push({ gamma: 5, beta: 5 });
    const b = fromTilted.push({ gamma: 45, beta: 45 });
    expect(a.mx).toBeCloseTo(b.mx, 10);
    expect(a.my).toBeCloseTo(b.my, 10);
  });
});

describe("TiltMapper smoothing", () => {
  test("a step input eases toward its target instead of snapping", () => {
    const mapper = new TiltMapper();
    mapper.push(REST);
    const first = mapper.push({ gamma: 20, beta: 0 });
    // Low-pass: the first step lands a fraction of the way, not the whole jump.
    expect(first.mx).toBeGreaterThan(0);
    expect(first.mx).toBeLessThan(0.1);
    // Holding the tilt, the value keeps climbing toward the steady target.
    const second = mapper.push({ gamma: 20, beta: 0 });
    expect(second.mx).toBeGreaterThan(first.mx);
  });

  test("a held tilt converges toward a stable offset", () => {
    const mapper = new TiltMapper();
    mapper.push(REST);
    let last = { mx: 0, my: 0 };
    for (let i = 0; i < 200; i++) {
      last = mapper.push({ gamma: 14, beta: 0 });
    }
    // 14° of the 28° full-tilt span → half of the 0.3 clamp.
    expect(last.mx).toBeCloseTo(0.15, 4);
  });
});

describe("TiltMapper clamping", () => {
  test("a hard tilt is held to the subtle range (a sway, not a ride)", () => {
    const mapper = new TiltMapper();
    mapper.push(REST);
    let last = { mx: 0, my: 0 };
    for (let i = 0; i < 500; i++) {
      // Way past the full-tilt span, both axes, both directions.
      last = mapper.push({ gamma: 90, beta: -90 });
    }
    expect(last.mx).toBeCloseTo(0.3, 4);
    expect(last.my).toBeCloseTo(-0.3, 4);
  });
});

describe("TiltMapper recalibration", () => {
  test("recalibrate re-bases the rest pose to the next reading", () => {
    const mapper = new TiltMapper();
    mapper.push(REST);
    for (let i = 0; i < 200; i++) {
      mapper.push({ gamma: 20, beta: 0 });
    }
    // An orientationchange re-bases: the next reading (wherever the phone now
    // rests) becomes the new zero, so the field eases back toward centre.
    mapper.recalibrate();
    const afterRebase = mapper.push({ gamma: 20, beta: 0 });
    const next = mapper.push({ gamma: 20, beta: 0 });
    expect(next.mx).toBeLessThan(afterRebase.mx);
  });
});
