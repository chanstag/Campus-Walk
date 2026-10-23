/** "" → null, otherwise a non-negative number with at most `places` decimals; NaN marks invalid input. */
export function decimalOrNull(v: string, places = 2) {
  const s = v.trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return Number.NaN;
  const decimals = s.split(".")[1]?.length ?? 0;
  return decimals <= places ? n : Number.NaN;
}
