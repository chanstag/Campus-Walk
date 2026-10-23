import { describe, expect, it } from "vitest";
import { decimalOrNull } from "./number";

describe("decimalOrNull", () => {
  it("treats blank as null", () => {
    expect(decimalOrNull("")).toBeNull();
    expect(decimalOrNull("  ")).toBeNull();
  });

  it("parses non-negative numbers up to the allowed decimals", () => {
    expect(decimalOrNull("14")).toBe(14);
    expect(decimalOrNull(" 14.5 ")).toBe(14.5);
    expect(decimalOrNull("0.25")).toBe(0.25);
    expect(decimalOrNull("1.234", 3)).toBe(1.234);
  });

  it("marks negative, non-numeric and over-precise input as NaN", () => {
    expect(decimalOrNull("-1")).toBeNaN();
    expect(decimalOrNull("abc")).toBeNaN();
    expect(decimalOrNull("1.234")).toBeNaN();
    expect(decimalOrNull("Infinity")).toBeNaN();
  });
});
