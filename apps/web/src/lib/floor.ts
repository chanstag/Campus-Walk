/**
 * Suggested names and levels for new floors. Only suggestions: the form prefills them and the
 * user can change either. Names follow the sample data ("First Floor", "Second Floor", …).
 */

const ORDINAL_WORDS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];

function ordinal(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** 1 → "First Floor", 0 → "Ground Floor", -1 → "Basement", -2 → "Basement 2", 12 → "12th Floor". */
export function suggestedFloorName(level: number) {
  if (level === 0) return "Ground Floor";
  if (level === -1) return "Basement";
  if (level < 0) return `Basement ${-level}`;
  return `${ORDINAL_WORDS[level - 1] ?? ordinal(level)} Floor`;
}

/** One above the highest existing level; 1 for a building with no floors. */
export function nextFloorLevel(levels: readonly number[]) {
  return levels.length === 0 ? 1 : Math.max(...levels) + 1;
}
