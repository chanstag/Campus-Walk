import { useEffect, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Icons, type LucideIcon } from "@/components/icons";
import { Logo, LOGO_COLORS } from "@/components/logo";
import { ACCENTS, useAccent, type AccentId } from "@/hooks/use-accent";
import { useTheme as useAppTheme } from "@/hooks/use-theme";
import TypeCompare from "./TypeCompare";

/**
 * Living style guide. Renders every token and component so edits to
 * src/index.css can be reviewed in one place, in both color modes.
 * Served at /design (see main.tsx). Not part of the product UI.
 */

// ---------- theme ----------

/** Adapter over the app-wide theme so the rest of this page keeps its boolean. */
function useTheme() {
  const { theme, setTheme } = useAppTheme();
  const dark = theme === "dark";
  const setDark = (d: boolean) => setTheme(d ? "dark" : "light");
  return [dark, setDark] as const;
}


/** Reads the resolved value of a CSS custom property, re-reading when `dep` changes. */
function useCssVar(name: string, dep: unknown) {
  const [value, setValue] = useState("");
  useEffect(() => {
    setValue(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
  }, [name, dep]);
  return value;
}

// ---------- tokens ----------

/** [background var, foreground var | null]. Pairs render text on the bg to check contrast. */
const COLOR_PAIRS: Array<[string, string | null]> = [
  ["background", "foreground"],
  ["card", "card-foreground"],
  ["popover", "popover-foreground"],
  ["primary", "primary-foreground"],
  ["secondary", "secondary-foreground"],
  ["muted", "muted-foreground"],
  ["accent", "accent-foreground"],
  ["destructive", null],
  ["border", null],
  ["input", null],
  ["ring", null],
  ["condition-good", null],
  ["condition-fair", null],
  ["condition-poor", null],
];

const CHART_VARS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

const SIDEBAR_PAIRS: Array<[string, string | null]> = [
  ["sidebar", "sidebar-foreground"],
  ["sidebar-primary", "sidebar-primary-foreground"],
  ["sidebar-accent", "sidebar-accent-foreground"],
  ["sidebar-border", null],
  ["sidebar-ring", null],
];

const RADII = ["xs", "sm", "md", "lg", "xl"];

/** Raw brand ramps from palette.css. Semantic tokens above are built from these. */
const PALETTES = [
  "desert-sand",
  "rosy-granite",
  "faded-copper",
  "dark-coffee",
  "alabaster-grey",
  "charcoal",
  "raw-umber",
  "cool-steel",
  "dark-walnut",
  "dim-grey",
  "sage",
];
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];


// ---------- page ----------

export default function DesignPage() {
  const [dark, setDark] = useTheme();
  const [accent, setAccent] = useAccent();
  const dep = `${dark}:${accent}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo className="size-9" />
            <div>
              <h1 className="text-lg font-semibold">Campus Walk design system</h1>
            <p className="text-sm text-muted-foreground">
              Tokens and components. Edit <code className="font-mono">src/index.css</code> and watch this
              page.
            </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={accent}
              onValueChange={(v) => setAccent(v as AccentId)}
              items={Object.fromEntries(ACCENTS.map((a) => [a.id, a.label]))}
            >
              <SelectTrigger size="sm" className="w-36" aria-label="Accent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCENTS.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setDark(!dark)}>
              {dark ? <Icons.theme.light /> : <Icons.theme.dark />}
              {dark ? "Light" : "Dark"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-8">
        <Section
          title="Logo"
          hint="src/assets/campus-walk-logo.svg, rendered through components/logo.tsx. Fixed colors; it does not follow mode or accent, so check it on every surface."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <LogoSurface label="background" className="bg-background text-foreground" />
            <LogoSurface label="sidebar" className="bg-sidebar text-sidebar-foreground" />
            <LogoSurface label="card" className="bg-card text-card-foreground" />
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs text-muted-foreground">lockup, as it ships in the sidebar and on sign-in</span>
            <div className="flex flex-wrap items-center gap-6">
              <span className="flex items-center gap-2">
                <Logo className="size-7" />
                <span className="font-semibold">Campus Walk</span>
              </span>
              <span className="flex items-center gap-2 text-sm">
                <Logo className="size-5" />
                <span className="font-semibold">Campus Walk</span>
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {LOGO_COLORS.map((c) => (
              <div key={c.hex} className="overflow-hidden rounded-lg border">
                <div className="h-12" style={{ background: c.hex }} />
                <div className="flex flex-col gap-0.5 p-2 font-mono text-[11px] leading-tight">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">{c.hex}</span>
                  <span className="text-muted-foreground">{c.note}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Palette" hint="Brand ramps from palette.css. Hover a step for its hex. These do not change with mode.">
          <div className="flex flex-col gap-3">
            {PALETTES.map((name) => (
              <Ramp key={name} name={name} />
            ))}
          </div>
        </Section>

        <Section title="Colors" hint="Semantic tokens. Each tile paints the token as background with its paired foreground on top.">
          <SwatchGrid pairs={COLOR_PAIRS} dep={dep} />
        </Section>

        <Section title="Charts">
          <div className="grid grid-cols-5 gap-3">
            {CHART_VARS.map((v) => (
              <Swatch key={v} bg={v} fg={null} dep={dep} />
            ))}
          </div>
        </Section>

        <Section title="Sidebar">
          <SwatchGrid pairs={SIDEBAR_PAIRS} dep={dep} />
        </Section>

        <Section title="Radius" hint="All sizes derive from --radius.">
          <RadiusRow dep={dep} />
        </Section>

        <Section title="Typography" hint="Pick a typeface per column. Preview on page swaps the whole page's font.">
          <TypeCompare />
        </Section>

        <Section
          title="Icons"
          hint="Semantic vocabulary from components/icons.ts. App code imports Icons.room, never a Lucide name."
        >
          <div className="flex flex-col gap-5">
            {iconGroups().map(([group, entries]) => (
              <div key={group} className="flex flex-col gap-2">
                <span className="font-mono text-xs text-muted-foreground">{group}</span>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {entries.map(([name, Icon]) => (
                    <div
                      key={name}
                      className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-xs"
                    >
                      <Icon className="size-4 shrink-0 text-foreground" />
                      <span className="truncate font-mono">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs text-muted-foreground">condition, as it should ship: icon + color + label</span>
            <div className="flex flex-wrap gap-2">
              <ConditionChip icon={Icons.condition.good} label="Good" className="text-green-700 dark:text-green-400" />
              <ConditionChip icon={Icons.condition.fair} label="Fair" className="text-amber-700 dark:text-amber-400" />
              <ConditionChip icon={Icons.condition.poor} label="Poor" className="text-destructive" />
              <ConditionChip icon={Icons.condition.notApplicable} label="N/A" className="text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Colors above are Tailwind defaults as placeholders. Replace with status tokens once defined.
            </p>
          </div>
        </Section>

        <Separator />

        <Section title="Button">
          <Row label="variant">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </Row>
          <Row label="size">
            <Button size="xs">Extra small</Button>
            <Button size="sm">Small</Button>
            <Button>Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Icon">
              <Icons.theme.light />
            </Button>
          </Row>
          <Row label="state">
            <Button disabled>Disabled</Button>
            <Button variant="outline" disabled>
              Disabled
            </Button>
          </Row>
        </Section>

        <Section title="Badge">
          <Row label="variant">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="ghost">Ghost</Badge>
            <Badge variant="link">Link</Badge>
          </Row>
        </Section>

        <Section title="Form controls">
          <div className="grid max-w-xl gap-5">
            <div className="grid gap-2">
              <Label htmlFor="d-name">Building name</Label>
              <Input id="d-name" placeholder="e.g. Science Hall" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="d-invalid">Invalid field</Label>
              <Input id="d-invalid" aria-invalid defaultValue="bad value" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="d-notes">Notes</Label>
              <Textarea id="d-notes" placeholder="Observations…" />
            </div>
            <div className="grid gap-2">
              <Label>Condition</Label>
              <Select defaultValue="Pass">
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pass">Pass</SelectItem>
                  <SelectItem value="Fail">Fail</SelectItem>
                  <SelectItem value="Not applicable">Not applicable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="d-check" defaultChecked />
              <Label htmlFor="d-check">Photo attached</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="d-switch" />
              <Label htmlFor="d-switch">Flag for follow-up</Label>
            </div>
          </div>
        </Section>

        <Section title="Card">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Science Hall</CardTitle>
                <CardDescription>Last walked 3 days ago</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                <p>14 items assessed, 2 flagged for follow-up.</p>
              </CardContent>
              <CardFooter className="gap-2">
                <Badge variant="secondary">In progress</Badge>
                <Button size="sm" className="ml-auto">
                  Open
                </Button>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Empty state</CardTitle>
                <CardDescription>No assessments yet for this building.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button variant="outline" size="sm">
                  Start a walk
                </Button>
              </CardFooter>
            </Card>
          </div>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="exterior">
            <TabsList>
              <TabsTrigger value="exterior">Exterior</TabsTrigger>
              <TabsTrigger value="interior">Interior</TabsTrigger>
              <TabsTrigger value="grounds">Grounds</TabsTrigger>
            </TabsList>
            <TabsContent value="exterior" className="text-sm text-muted-foreground">
              Exterior checklist items appear here.
            </TabsContent>
            <TabsContent value="interior" className="text-sm text-muted-foreground">
              Interior checklist items appear here.
            </TabsContent>
            <TabsContent value="grounds" className="text-sm text-muted-foreground">
              Grounds checklist items appear here.
            </TabsContent>
          </Tabs>
        </Section>

        <Section title="Overlays" hint="Dialog for tasks, AlertDialog for destructive confirmation.">
          <Row label="">
            <Dialog>
              <DialogTrigger render={<Button variant="outline" />}>Open dialog</DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add a note</DialogTitle>
                  <DialogDescription>Notes are attached to the current checklist item.</DialogDescription>
                </DialogHeader>
                <Textarea placeholder="Type here…" />
                <DialogFooter>
                  <Button>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="destructive" />}>Delete walk</AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this walk?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes all 14 assessed items and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Row>
        </Section>
      </main>
    </div>
  );
}

// ---------- building blocks ----------

type IconEntry = [string, LucideIcon];

/** Flattens the Icons object into [group, [name, Icon][]] for display. */
function iconGroups(): Array<[string, IconEntry[]]> {
  const top: IconEntry[] = [];
  const nested: Array<[string, IconEntry[]]> = [];
  for (const [key, value] of Object.entries(Icons)) {
    if (typeof value === "function" || "$$typeof" in (value as object)) {
      top.push([key, value as LucideIcon]);
    } else {
      nested.push([key, Object.entries(value as Record<string, LucideIcon>)]);
    }
  }
  return [["core", top], ...nested];
}

/** The mark at the sizes the app uses, on one themed surface. */
function LogoSurface({ label, className }: { label: string; className: string }) {
  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-3 ${className}`}>
      <div className="flex items-end gap-4">
        <Logo className="size-5" />
        <Logo className="size-7" />
        <Logo className="size-10" />
        <Logo className="size-16" />
      </div>
      <span className="font-mono text-[11px] text-muted-foreground">{label} · 20 / 28 / 40 / 64 px</span>
    </div>
  );
}

function ConditionChip({ icon: Icon, label, className }: { icon: LucideIcon; label: string; className: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs font-medium ${className}`}>
      <Icon className="size-4" />
      {label}
    </span>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      {label && <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{label}</span>}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function SwatchGrid({ pairs, dep }: { pairs: Array<[string, string | null]>; dep: unknown }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {pairs.map(([bg, fg]) => (
        <Swatch key={bg} bg={bg} fg={fg} dep={dep} />
      ))}
    </div>
  );
}

function Swatch({ bg, fg, dep }: { bg: string; fg: string | null; dep: unknown }) {
  const bgValue = useCssVar(`--${bg}`, dep);
  const fgValue = useCssVar(fg ? `--${fg}` : "--foreground", dep);
  return (
    <div className="overflow-hidden rounded-lg border">
      <div
        className="flex h-20 flex-col justify-end p-2 text-xs"
        style={{ background: `var(--${bg})`, color: fg ? `var(--${fg})` : undefined }}
      >
        {fg ? <span className="font-medium">Aa</span> : null}
      </div>
      <div className="flex flex-col gap-0.5 p-2 font-mono text-[11px] leading-tight">
        <span>--{bg}</span>
        <span className="text-muted-foreground">{bgValue}</span>
        {fg && (
          <>
            <span className="mt-1">--{fg}</span>
            <span className="text-muted-foreground">{fgValue}</span>
          </>
        )}
      </div>
    </div>
  );
}

function Ramp({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">{name}</span>
      <div className="flex flex-1 overflow-hidden rounded-md border">
        {STEPS.map((step) => (
          <div
            key={step}
            title={`--color-${name}-${step}`}
            className="flex h-10 flex-1 items-end justify-center pb-1 font-mono text-[10px]"
            style={{
              background: `var(--color-${name}-${step})`,
              color: step >= 500 ? `var(--color-${name}-50)` : `var(--color-${name}-900)`,
            }}
          >
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}

function RadiusRow({ dep }: { dep: unknown }) {
  const base = useCssVar("--radius", dep);
  return (
    <div className="flex flex-wrap items-end gap-6">
      <div className="flex flex-col items-center gap-1">
        <div className="size-16 border-2 border-primary" style={{ borderRadius: "var(--radius)" }} />
        <span className="font-mono text-[11px] text-muted-foreground">--radius {base}</span>
      </div>
      {RADII.map((r) => (
        <div key={r} className="flex flex-col items-center gap-1">
          <div className={`size-16 border-2 border-primary rounded-${r}`} />
          <span className="font-mono text-[11px] text-muted-foreground">rounded-{r}</span>
        </div>
      ))}
    </div>
  );
}
