import { describe, expect, it } from "vitest";
import { nextFloorLevel, suggestedFloorName } from "./floor";

describe("suggestedFloorName", () => {
  it("matches the sample data's naming for the first floors", () => {
    expect(suggestedFloorName(1)).toBe("First Floor");
    expect(suggestedFloorName(2)).toBe("Second Floor");
    expect(suggestedFloorName(3)).toBe("Third Floor");
    expect(suggestedFloorName(10)).toBe("Tenth Floor");
  });

  it("uses numeric ordinals above ten, including the teens", () => {
    expect(suggestedFloorName(11)).toBe("11th Floor");
    expect(suggestedFloorName(12)).toBe("12th Floor");
    expect(suggestedFloorName(13)).toBe("13th Floor");
    expect(suggestedFloorName(21)).toBe("21st Floor");
    expect(suggestedFloorName(22)).toBe("22nd Floor");
    expect(suggestedFloorName(23)).toBe("23rd Floor");
    expect(suggestedFloorName(111)).toBe("111th Floor");
  });

  it("names ground and basement levels", () => {
    expect(suggestedFloorName(0)).toBe("Ground Floor");
    expect(suggestedFloorName(-1)).toBe("Basement");
    expect(suggestedFloorName(-2)).toBe("Basement 2");
  });
});

describe("nextFloorLevel", () => {
  it("is one above the highest level, or 1 when there are none", () => {
    expect(nextFloorLevel([])).toBe(1);
    expect(nextFloorLevel([1, 2])).toBe(3);
    expect(nextFloorLevel([-1, 0, 1])).toBe(2);
    expect(nextFloorLevel([3, 1])).toBe(4);
  });
});
