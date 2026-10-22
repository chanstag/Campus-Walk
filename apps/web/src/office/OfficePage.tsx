import { useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import { Link } from "react-router";
import { PageShell } from "@/app/PageShell";
import { Icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConditionBadge } from "@/lib/condition";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc";
import type { RouterOutputs } from "api/src/router";

type Summary = RouterOutputs["office"]["summary"][number];
type Detail = RouterOutputs["office"]["campusDetail"];

const CATEGORY_ORDER = ["Furniture", "Technology", "Equipment", "Building System"];

/** Office view: one card per campus, then the selected campus's detail. */
export function OfficePage() {
  const trpc = useTRPC();
  const summary = useQuery(trpc.office.summary.queryOptions());
  // Same URL key as the walk page, so a campus stays selected when hopping between them.
  const [campusId, setCampusId] = useQueryState("campus", parseAsString.withOptions({ history: "push" }));
  const selected = summary.data?.find((s) => s.campus.id === campusId);
  const detail = useQuery({
    ...trpc.office.campusDetail.queryOptions({ campusId: campusId ?? "" }),
    enabled: !!campusId,
  });

  return (
    <PageShell crumbs={["Office", ...(selected ? [selected.campus.name] : [])]} placeholder="Office">
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Campuses</h2>
          {summary.isPending && (
            <CardGrid>
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </CardGrid>
          )}
          {summary.error && <p className="text-sm text-destructive">{summary.error.message}</p>}
          {summary.data && summary.data.length === 0 && (
            <p className="text-sm text-muted-foreground">No campuses yet.</p>
          )}
          {summary.data && summary.data.length > 0 && (
            <CardGrid>
              {summary.data.map((s) => (
                <CampusCard
                  key={s.campus.id}
                  summary={s}
                  selected={s.campus.id === campusId}
                  onSelect={() => void setCampusId(s.campus.id === campusId ? null : s.campus.id)}
                />
              ))}
            </CardGrid>
          )}
        </section>

        {campusId && (
          <section className="flex flex-col gap-6">
            {detail.isPending && <Skeleton className="h-64" />}
            {detail.error && <p className="text-sm text-destructive">{detail.error.message}</p>}
            {detail.data && selected && <CampusDetail campusId={campusId} detail={detail.data} />}
            {detail.data && !selected && !summary.isPending && (
              <p className="text-sm text-muted-foreground">Campus not found.</p>
            )}
          </section>
        )}
      </div>
    </PageShell>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">{children}</div>;
}

function CampusCard({ summary: s, selected, onSelect }: { summary: Summary; selected: boolean; onSelect: () => void }) {
  const pct = s.rooms === 0 ? 0 : Math.round((s.roomsWalked / s.rooms) * 100);
  const remaining = s.rooms - s.roomsWalked;
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn("cursor-pointer transition-colors hover:bg-accent/40", selected && "border-ring ring-2 ring-ring")}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icons.campus className="size-4 text-muted-foreground" />
          {s.campus.name}
        </CardTitle>
        <CardDescription>
          {s.campus.campusType ?? "Campus"} · {s.buildings} {s.buildings === 1 ? "building" : "buildings"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Rooms walked</span>
            <span className="font-medium tabular-nums">
              {s.roomsWalked} / {s.rooms}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {remaining === 0 ? "Every room walked" : `${remaining} ${remaining === 1 ? "room" : "rooms"} to go`}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <Stat label="Items" value={s.items} />
          <Stat label="Poor" value={s.poorItems} className={s.poorItems > 0 ? "text-condition-poor" : undefined} />
          <Stat label="Not rated" value={s.unratedItems} className={s.unratedItems > 0 ? "text-condition-fair" : undefined} />
        </dl>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {CATEGORY_ORDER.filter((c) => s.itemsByCategory[c]).map((c) => (
            <span key={c}>
              <span className="font-medium tabular-nums text-foreground">{s.itemsByCategory[c]!.toLocaleString()}</span> {c.toLowerCase()}
            </span>
          ))}
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-lg font-semibold tabular-nums", className)}>{value.toLocaleString()}</dd>
    </div>
  );
}

function walkHref(campusId: string, floorId: string | null, roomId: string | null) {
  const p = new URLSearchParams({ campus: campusId });
  if (floorId) p.set("floor", floorId);
  if (roomId) p.set("room", roomId);
  return `/walk?${p}`;
}

function CampusDetail({ campusId, detail }: { campusId: string; detail: Detail }) {
  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Items by type</h2>
        {detail.itemsByType.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assets recorded.</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Poor</TableHead>
                  <TableHead className="text-right">Not rated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.itemsByType.map((t) => (
                  <TableRow key={`${t.category}/${t.typeName}`}>
                    <TableCell className="text-muted-foreground">{t.category}</TableCell>
                    <TableCell className="font-medium">{t.typeName}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.records}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.items.toLocaleString()}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", t.poorItems > 0 && "text-condition-poor")}>
                      {t.poorItems.toLocaleString()}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", t.unratedItems > 0 && "text-condition-fair")}>
                      {t.unratedItems.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">
          Items in poor condition{" "}
          <span className="font-normal text-muted-foreground">
            ({detail.poorAssets.length} {detail.poorAssets.length === 1 ? "record" : "records"})
          </span>
        </h2>
        {detail.poorAssets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing rated Poor or Critical.</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Where</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.poorAssets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {a.typeName}
                      {a.quantity > 1 && <span className="text-muted-foreground"> ×{a.quantity}</span>}
                      {a.assetTag && <span className="ml-2 font-mono text-xs text-muted-foreground">{a.assetTag}</span>}
                    </TableCell>
                    <TableCell>
                      <ConditionBadge rating={a.condition} />
                    </TableCell>
                    <TableCell>
                      {a.roomId ? (
                        <Link className="underline-offset-4 hover:underline" to={walkHref(campusId, a.floorId, a.roomId)}>
                          {a.building} · {a.roomNumber} {a.roomName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{a.building} · building level</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-muted-foreground">{a.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">
          Rooms yet to be walked{" "}
          <span className="font-normal text-muted-foreground">({detail.roomsRemaining.length})</span>
        </h2>
        {detail.roomsRemaining.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-condition-good">
            <Icons.condition.good className="size-4" />
            Every room on this campus has been walked.
          </p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">
            {detail.roomsRemaining.map((r) => (
              <li key={r.id}>
                <Link
                  to={walkHref(campusId, r.floorId, r.id)}
                  className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm hover:bg-accent/60"
                >
                  <Icons.room className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="tabular-nums">{r.number}</span> {r.name}
                  </span>
                  <Badge variant="outline" className="shrink-0 font-normal">
                    {r.building} · {r.floor}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
