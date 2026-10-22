import type { ConditionRating } from "api/src/db/schema";
import { Icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
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
