import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { PageShell } from "@/app/PageShell";
import { useCan } from "@/auth/permissions";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTRPC } from "@/trpc";
import { CampusDialog } from "./CampusDialog";
import { DistrictDialog } from "./DistrictDialog";
import type { Campus, District } from "./types";

type Editing =
  | { kind: "add-district" }
  | { kind: "edit-district"; district: District }
  | { kind: "add-campus"; districtId: string }
  | { kind: "edit-campus"; campus: Campus };

/** Office page: districts and their campuses, with create/edit. Buildings and below are managed on /walk. */
export function CampusesPage() {
  const trpc = useTRPC();
  const districts = useQuery(trpc.district.list.queryOptions());
  const campuses = useQuery(trpc.campus.list.queryOptions());
  const { can: canAddDistrict } = useCan("district", "create");
  const { can: canEditDistrict } = useCan("district", "update");
  const { can: canAddCampus } = useCan("campus", "create");
  const { can: canEditCampus } = useCan("campus", "update");
  const [editing, setEditing] = useState<Editing | null>(null);
  const close = (open: boolean) => !open && setEditing(null);

  const error = districts.error ?? campuses.error;

  return (
    <PageShell crumbs={["Campuses"]} placeholder="Campuses">
      <div className="flex max-w-5xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Districts and their campuses. Add buildings, floors and rooms from the walk screen.</p>
          {canAddDistrict && (
            <Button onClick={() => setEditing({ kind: "add-district" })}>
              <Icons.ui.add />
              Add district
            </Button>
          )}
        </div>

        {(districts.isPending || campuses.isPending) && <Skeleton className="h-48" />}
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        {districts.data && campuses.data && districts.data.length === 0 && (
          <p className="text-sm text-muted-foreground">No districts yet.</p>
        )}

        {districts.data &&
          campuses.data &&
          districts.data.map((d) => {
            const rows = campuses.data.filter((c) => c.districtId === d.id);
            return (
              <section key={d.id} aria-label={d.name} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">{d.name}</h2>
                  {canEditDistrict && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Rename ${d.name}`}
                      onClick={() => setEditing({ kind: "edit-district", district: d })}
                    >
                      <Icons.ui.edit />
                    </Button>
                  )}
                  {canAddCampus && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      onClick={() => setEditing({ kind: "add-campus", districtId: d.id })}
                    >
                      <Icons.ui.add />
                      Add campus
                    </Button>
                  )}
                </div>
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No campuses in {d.name} yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Type</TableHead>
                        <TableHead className="hidden md:table-cell">Address</TableHead>
                        <TableHead className="text-right">Opened</TableHead>
                        <TableHead className="text-right">Acres</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">
                            <Link to={`/walk?campus=${c.id}`} className="hover:underline">
                              {c.name}
                            </Link>
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground sm:table-cell">{c.campusType ?? "—"}</TableCell>
                          <TableCell className="hidden text-muted-foreground md:table-cell">{c.address ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.yearOpened ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.siteAcres == null ? "—" : Number(c.siteAcres)}</TableCell>
                          <TableCell>
                            {canEditCampus && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Edit ${c.name}`}
                                onClick={() => setEditing({ kind: "edit-campus", campus: c })}
                              >
                                <Icons.ui.edit />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </section>
            );
          })}
      </div>

      {editing?.kind === "add-district" && <DistrictDialog open onOpenChange={close} />}
      {editing?.kind === "edit-district" && <DistrictDialog open onOpenChange={close} district={editing.district} />}
      {districts.data && editing?.kind === "add-campus" && (
        <CampusDialog open onOpenChange={close} districts={districts.data} districtId={editing.districtId} />
      )}
      {districts.data && editing?.kind === "edit-campus" && (
        <CampusDialog
          open
          onOpenChange={close}
          districts={districts.data}
          districtId={editing.campus.districtId}
          campus={editing.campus}
        />
      )}
    </PageShell>
  );
}
