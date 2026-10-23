import { describe, expect, it } from "vitest";
import { CONDITION_OPTIONS, conditionLabel, conditionTone } from "./condition";

describe("conditionLabel", () => {
  it("names each rating on the 1–5 scale", () => {
    expect([1, 2, 3, 4, 5].map(conditionLabel)).toEqual(["Critical", "Poor", "Fair", "Good", "Excellent"]);
  });

  it("treats null and undefined as not assessed", () => {
    expect(conditionLabel(null)).toBe("Not assessed");
    expect(conditionLabel(undefined)).toBe("Not assessed");
  });

  it("does not crash on a value outside the scale", () => {
    expect(conditionLabel(7)).toBe("Rating 7");
  });
});

describe("conditionTone", () => {
  it("collapses 1–2 to poor, 3 to fair, 4–5 to good", () => {
    expect(conditionTone(1)).toBe("poor");
    expect(conditionTone(2)).toBe("poor");
    expect(conditionTone(3)).toBe("fair");
    expect(conditionTone(4)).toBe("good");
    expect(conditionTone(5)).toBe("good");
  });

  it("is none when unrated", () => {
    expect(conditionTone(null)).toBe("none");
    expect(conditionTone(undefined)).toBe("none");
  });
});

describe("CONDITION_OPTIONS", () => {
  it("lists best first with matching labels", () => {
    expect(CONDITION_OPTIONS.map((o) => o.value)).toEqual([5, 4, 3, 2, 1]);
    expect(CONDITION_OPTIONS[0]).toEqual({ value: 5, label: "Excellent" });
  });
});
