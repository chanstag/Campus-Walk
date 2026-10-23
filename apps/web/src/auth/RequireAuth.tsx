import type { PermissionKey } from "api/src/auth/permission-catalog";
import { Navigate, Outlet, useLocation } from "react-router";
import { PageShell } from "@/app/PageShell";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppSession } from "@/offline/session";
import { hasPermission, usePermissions } from "./permissions";

function Pending() {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Skeleton className="h-8 w-40" />
    </div>
  );
}

/**
 * Layout route: renders the child route only with a session and, when `permission` is given,
 * only if the user's role holds it. Signed-out visitors go to /login and come back to where
 * they were. Offline, the last session seen on this device counts (see `useAppSession`).
 */
export function RequireAuth({ permission }: { permission?: PermissionKey }) {
  const { data: session, isPending } = useAppSession();
  const location = useLocation();
  const permissions = usePermissions(!!session && !!permission);

  if (isPending) return <Pending />;
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (permission) {
    if (permissions.isPending) return <Pending />;
    if (!hasPermission(permissions.data, permission)) {
      return (
        <PageShell placeholder="Not allowed">
          <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
        </PageShell>
      );
    }
  }
  return <Outlet />;
}
