import { cn } from "@/lib/utils";
import logoUrl from "@/assets/campus-walk-logo.svg";

/** The three fixed colors in the mark. Shown on /design; not theme tokens. */
export const LOGO_COLORS = [
  { name: "pin", hex: "#FE6C02", note: "≈ raw-umber-500" },
  { name: "page, dark", hex: "#596D3B", note: "not in palette.css" },
  { name: "page, light", hex: "#718757", note: "not in palette.css" },
] as const;

export { logoUrl };

/**
 * Campus Walk mark: an orange "C" map pin over an open book forming a "W".
 * Multi-color and fixed, so it is an <img>, not a Lucide-style currentColor icon.
 * Decorative by default (alt=""); pass `alt` when it stands alone.
 */
export function Logo({ className, alt = "", ...props }: React.ComponentProps<"img">) {
  return (
    <img
      src={logoUrl}
      alt={alt}
      draggable={false}
      className={cn("size-6 shrink-0 select-none", className)}
      {...props}
    />
  );
}
