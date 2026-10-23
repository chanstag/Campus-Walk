import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RESOURCES, RESOURCE_LABELS, type Resource } from "api/src/auth/permission-catalog";
import { type Role, isRole } from "api/src/auth/roles";
import type { RouterOutputs } from "api/src/router";
import { PageShell } from "@/app/PageShell";
import { useCan } from "@/auth/permissions";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTRPC } from "@/trpc";

type Matrix = RouterOutputs["permissions"]["matrix"];

const LOCKED_HINT = "Admins always keep the permission grants, so the matrix can never be locked for everyone.";

/** Admin screen: one row per permission, one column per role, a checkbox per grant. */
export function PermissionsPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const key = trpc.permissions.matrix.queryKey();
  const matrix = useQuery(trpc.permissions.matrix.queryOptions());
  const { can: canEdit } = useCan("permission", "update");

  const set = useMutation(
    trpc.permissions.set.mutationOptions({
      // Optimistic: the box flips immediately and flips back if the server says no.
      onMutate: async (vars) => {
        await qc.cancelQueries({ queryKey: key });
        const previous = qc.getQueryData(key);
        qc.setQueryData(key, (old) => {
          if (!old) return old;
          const without = old.grants.filter(
            (g) => !(g.roleName === vars.roleName && g.permissionId === vars.permissionId),
          );
          return {
            ...old,
            grants: vars.granted ? [...without, { roleName: vars.roleName, permissionId: vars.permissionId }] : without,
          };
        });
        return { previous };
      },
      onError: (_err, _vars, context) => {
        if (context?.previous) qc.setQueryData(key, context.previous);
      },
      onSettled: () => qc.invalidateQueries(trpc.permissions.pathFilter()),
    }),
  );

  return (
    <PageShell crumbs={["Permissions"]} placeholder="Permissions">
      <div className="flex max-w-4xl flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          What each role may do. Changes apply on the next request; the server enforces these on every call, the
          app only hides what a role cannot use.
        </p>
        {set.error && <p className="text-sm text-destructive">{set.error.message}</p>}
        {matrix.isPending && <Skeleton className="h-64" />}
        {matrix.error && <p className="text-sm text-destructive">{matrix.error.message}</p>}
        {matrix.data && (
          <MatrixTable
            data={matrix.data}
            canEdit={canEdit}
            busy={set.isPending}
            onToggle={(roleName, permissionId, granted) => set.mutate({ roleName, permissionId, granted })}
          />
        )}
      </div>
    </PageShell>
  );
}

function MatrixTable({
  data,
  canEdit,
  busy,
  onToggle,
}: {
  data: Matrix;
  canEdit: boolean;
  busy: boolean;
  onToggle: (roleName: Role, permissionId: string, granted: boolean) => void;
}) {
  const granted = new Set(data.grants.map((g) => `${g.roleName}|${g.permissionId}`));
  const byResource = new Map<string, Matrix["permissions"]>();
  for (const p of data.permissions) byResource.set(p.resource, [...(byResource.get(p.resource) ?? []), p]);
  // Catalog order first, then anything the catalog no longer knows about.
  const resources = [...RESOURCES.filter((r) => byResource.has(r)), ...[...byResource.keys()].filter((r) => !RESOURCES.includes(r as Resource))];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Permission</TableHead>
          {data.roles.map((r) => (
            <TableHead key={r.name} className="w-24 text-center">
              {r.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {resources.map((resource) => (
          <Section key={resource} resource={resource} permissions={byResource.get(resource) ?? []} data={data} granted={granted} canEdit={canEdit} busy={busy} onToggle={onToggle} />
        ))}
      </TableBody>
    </Table>
  );
}

function Section({
  resource,
  permissions,
  data,
  granted,
  canEdit,
  busy,
  onToggle,
}: {
  resource: string;
  permissions: Matrix["permissions"];
  data: Matrix;
  granted: Set<string>;
  canEdit: boolean;
  busy: boolean;
  onToggle: (roleName: Role, permissionId: string, granted: boolean) => void;
}) {
  const label = (RESOURCE_LABELS as Record<string, string>)[resource] ?? resource;
  return (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell colSpan={1 + data.roles.length} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </TableCell>
      </TableRow>
      {permissions.map((p) => (
        <TableRow key={p.id}>
          <TableCell>
            <div className="font-medium">
              {p.resource}:{p.action}
            </div>
            {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
          </TableCell>
          {data.roles.map((r) => {
            const locked = r.name === "admin" && p.resource === "permission";
            const checked = granted.has(`${r.name}|${p.id}`);
            const box = (
              <Checkbox
                aria-label={`${r.label}: ${p.resource}:${p.action}`}
                checked={checked}
                disabled={!canEdit || locked || busy}
                onCheckedChange={(next) => isRole(r.name) && onToggle(r.name, p.id, next === true)}
              />
            );
            return (
              <TableCell key={r.name} className="text-center">
                {locked ? (
                  <Tooltip>
                    <TooltipTrigger render={<span className="inline-flex" />}>{box}</TooltipTrigger>
                    <TooltipContent>{LOCKED_HINT}</TooltipContent>
                  </Tooltip>
                ) : (
                  box
                )}
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </>
  );
}
