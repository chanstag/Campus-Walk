import type { ConditionRating } from "api/src/db/schema";
import { Icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Web-side view of the 1-5 condition scale. The API's CONDITION_SCALE sits in
 * schema.ts next to the Drizzle tables, so importing it at runtime would drag
 * drizzle into the bundle; keep labels here and share only the key type.
 */
const LABELS: Record<ConditionRating, string> = {
  1: "Critical",
  2: "Poor",
  3: "Fair",
  4: "Good",
  5: "Excellent",
};

export type ConditionTone = "poor" | "fair" | "good" | "none";

export function conditionLabel(rating: number | null | undefined) {
  return rating == null ? "Not assessed" : (LABELS[rating as ConditionRating] ?? `Rating ${rating}`);
}

/** Collapses 1-5 onto the three glyphs in Icons.condition. */
export function conditionTone(rating: number | null | undefined): ConditionTone {
  if (rating == null) return "none";
  if (rating <= 2) return "poor";
  if (rating === 3) return "fair";
  return "good";
}

const TONE_CLASS: Record<ConditionTone, string> = {
  good: "border-condition-good/40 text-condition-good",
  fair: "border-condition-fair/40 text-condition-fair",
  poor: "border-condition-poor/40 text-condition-poor",
  none: "text-muted-foreground",
};

const TONE_ICON = {
  good: Icons.condition.good,
  fair: Icons.condition.fair,
  poor: Icons.condition.poor,
  none: Icons.condition.unknown,
} as const;

export function ConditionBadge({
  rating,
  className,
}: {
  rating: number | null | undefined;
  className?: string;
}) {
  const tone = conditionTone(rating);
  const Icon = TONE_ICON[tone];
  return (
    <Badge variant="outline" className={cn("gap-1", TONE_CLASS[tone], className)}>
      <Icon aria-hidden />
      {conditionLabel(rating)}
    </Badge>
  );
}

/** For selects: best first, as the field user thinks of it. */
export const CONDITION_OPTIONS = ([5, 4, 3, 2, 1] as const).map((value) => ({ value, label: LABELS[value] }));

const PICK_SELECTED: Record<ConditionTone, string> = {
  good: "bg-condition-good/15 text-condition-good ring-1 ring-inset ring-condition-good",
  fair: "bg-condition-fair/15 text-condition-fair ring-1 ring-inset ring-condition-fair",
  poor: "bg-condition-poor/15 text-condition-poor ring-1 ring-inset ring-condition-poor",
  none: "",
};

/** Five tap targets, 1 (Critical) to 5 (Excellent). Tapping the selected one clears it. */
export function ConditionPicker({
  value,
  onChange,
  disabled,
  className,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div role="group" aria-label="Condition" className={cn("inline-flex rounded-md border bg-background", className)}>
      {([1, 2, 3, 4, 5] as const).map((r) => {
        const selected = value === r;
        return (
          <Tooltip key={r}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={LABELS[r]}
                  disabled={disabled}
                  onClick={() => onChange(selected ? null : r)}
                  className={cn(
                    "size-8 border-r text-sm font-medium tabular-nums transition-colors first:rounded-l-md last:rounded-r-md last:border-r-0",
                    "hover:bg-accent disabled:pointer-events-none disabled:opacity-50",
                    selected && PICK_SELECTED[conditionTone(r)],
                  )}
                />
              }
            >
              {r}
            </TooltipTrigger>
            <TooltipContent>{LABELS[r]}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
