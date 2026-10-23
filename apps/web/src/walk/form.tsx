import { Label } from "@/components/ui/label";

/** Shared bits of the structure dialogs (room, floor, building). */

/** "" → null, otherwise a non-negative whole number; NaN marks invalid input. */
export function wholeOrNull(v: string) {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : Number.NaN;
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
