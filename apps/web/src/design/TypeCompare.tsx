import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Side-by-side typeface comparison for the design page.
 * Fonts are Fontsource variable packages loaded on demand, so nothing here
 * affects the app bundle. Geist is already loaded globally by index.css.
 * To add a candidate: `pnpm add -D @fontsource-variable/<name>` and one entry below.
 */

type Font = {
  id: string;
  label: string;
  family: string;
  load?: () => Promise<unknown>;
};

const FONTS: Font[] = [
  { id: "geist", label: "Geist (current)", family: "'Geist Variable', sans-serif" },
  { id: "system", label: "System UI", family: "system-ui, sans-serif" },
  { id: "inter", label: "Inter", family: "'Inter Variable', sans-serif", load: () => import("@fontsource-variable/inter") },
  { id: "manrope", label: "Manrope", family: "'Manrope Variable', sans-serif", load: () => import("@fontsource-variable/manrope") },
  { id: "dm-sans", label: "DM Sans", family: "'DM Sans Variable', sans-serif", load: () => import("@fontsource-variable/dm-sans") },
  { id: "figtree", label: "Figtree", family: "'Figtree Variable', sans-serif", load: () => import("@fontsource-variable/figtree") },
  { id: "ibm-plex-sans", label: "IBM Plex Sans", family: "'IBM Plex Sans Variable', sans-serif", load: () => import("@fontsource-variable/ibm-plex-sans") },
  { id: "source-sans-3", label: "Source Sans 3", family: "'Source Sans 3 Variable', sans-serif", load: () => import("@fontsource-variable/source-sans-3") },
  { id: "public-sans", label: "Public Sans", family: "'Public Sans Variable', sans-serif", load: () => import("@fontsource-variable/public-sans") },
  { id: "plus-jakarta-sans", label: "Plus Jakarta Sans", family: "'Plus Jakarta Sans Variable', sans-serif", load: () => import("@fontsource-variable/plus-jakarta-sans") },
  { id: "source-serif-4", label: "Source Serif 4", family: "'Source Serif 4 Variable', serif", load: () => import("@fontsource-variable/source-serif-4") },
  { id: "fraunces", label: "Fraunces", family: "'Fraunces Variable', serif", load: () => import("@fontsource-variable/fraunces") },
  { id: "newsreader", label: "Newsreader", family: "'Newsreader Variable', serif", load: () => import("@fontsource-variable/newsreader") },
];

const FONT_ITEMS = Object.fromEntries(FONTS.map((f) => [f.id, f.label]));
const loaded = new Set<string>(["geist", "system"]);

function fontById(id: string): Font {
  return FONTS.find((f) => f.id === id) ?? FONTS[0]!;
}

function useFontChoice(key: string, fallback: string) {
  const [id, setId] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v && FONTS.some((f) => f.id === v) ? v : fallback;
    } catch {
      return fallback;
    }
  });
  const [ready, setReady] = useState(loaded.has(id));
  useEffect(() => {
    try {
      localStorage.setItem(key, id);
    } catch {
      /* storage unavailable */
    }
    const font = fontById(id);
    if (loaded.has(id) || !font.load) {
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    font.load().then(() => {
      loaded.add(id);
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, key]);
  return { id, setId, ready, font: fontById(id) };
}

const SCALE = ["text-xs", "text-sm", "text-base", "text-lg", "text-xl", "text-2xl", "text-3xl", "text-4xl"];
const WEIGHTS = [400, 500, 600, 700];

export default function TypeCompare() {
  const a = useFontChoice("campus-walk:type-a", "geist");
  const b = useFontChoice("campus-walk:type-b", "inter");
  const [pageFont, setPageFont] = useState<string | null>(null);

  // Preview a candidate across the whole design page by overriding the html font.
  useEffect(() => {
    document.documentElement.style.fontFamily = pageFont ? fontById(pageFont).family : "";
    return () => {
      document.documentElement.style.fontFamily = "";
    };
  }, [pageFont]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <TypeColumn choice={a} pageFont={pageFont} setPageFont={setPageFont} />
      <TypeColumn choice={b} pageFont={pageFont} setPageFont={setPageFont} />
    </div>
  );
}

function TypeColumn({
  choice,
  pageFont,
  setPageFont,
}: {
  choice: ReturnType<typeof useFontChoice>;
  pageFont: string | null;
  setPageFont: (id: string | null) => void;
}) {
  const { id, setId, ready, font } = choice;
  const onPage = pageFont === id;
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <Select value={id} onValueChange={(v) => v && setId(v)} items={FONT_ITEMS}>
          <SelectTrigger size="sm" className="w-48" aria-label="Typeface">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONTS.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant={onPage ? "default" : "outline"} size="sm" onClick={() => setPageFont(onPage ? null : id)}>
          {onPage ? "Previewing on page" : "Preview on page"}
        </Button>
      </div>

      <div className={ready ? "flex flex-col gap-4" : "flex flex-col gap-4 opacity-40"} style={{ fontFamily: font.family }}>
        <div className="flex flex-col gap-1.5">
          {SCALE.map((cls) => (
            <div key={cls} className="flex items-baseline gap-3">
              <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">{cls}</span>
              <span className={`${cls} truncate`}>Science Hall, Room 204</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {WEIGHTS.map((w) => (
            <span key={w} style={{ fontWeight: w }}>
              {w} Assessment
            </span>
          ))}
        </div>

        <p className="text-sm leading-relaxed">
          Ceiling tile water-stained near the east window; HVAC diffuser rattles at low speed. Projector mount is
          secure. Two chairs moved from Room 206 on 14 Oct. Recommend follow-up before winter break.
        </p>

        <div className="flex items-baseline gap-4 text-sm">
          <span className="tabular-nums">0123456789</span>
          <span className="tabular-nums">87 / 100</span>
          <span>Il1 O0 rn m</span>
        </div>
      </div>

      <span className="font-mono text-[10px] text-muted-foreground">{font.family}</span>
    </div>
  );
}
