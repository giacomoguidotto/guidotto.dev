import { describe, expect, test } from "bun:test";
import { type DataSaverSignals, isDataConstrained } from "./data-saver";

// data-saver's pure predicate decides the attractor's top ladder rung: any one of
// data-saver, a reduced-data preference, or a browser-classified slow connection
// forces the poster floor (no 6.8 MB fetch). The invariants worth pinning are the
// OR across the three signals and that an unconstrained, fast client is left alone.

describe("isDataConstrained", () => {
  test("an unconstrained, fast client is not constrained", () => {
    const fast: DataSaverSignals = {
      saveData: false,
      effectiveType: "4g",
      reducedData: false,
    };
    expect(isDataConstrained(fast)).toBe(false);
  });

  test("an absent NetworkInformation (all undefined) is not constrained", () => {
    expect(isDataConstrained({})).toBe(false);
  });

  test("explicit Save-Data constrains", () => {
    expect(isDataConstrained({ saveData: true, effectiveType: "4g" })).toBe(
      true
    );
  });

  test("prefers-reduced-data constrains", () => {
    expect(isDataConstrained({ reducedData: true, effectiveType: "4g" })).toBe(
      true
    );
  });

  test.each([
    "2g",
    "slow-2g",
  ])("a slow effectiveType (%s) constrains", (effectiveType) => {
    expect(isDataConstrained({ effectiveType })).toBe(true);
  });

  test.each([
    "3g",
    "4g",
  ])("a fast effectiveType (%s) alone does not constrain", (effectiveType) => {
    expect(isDataConstrained({ effectiveType })).toBe(false);
  });
});
