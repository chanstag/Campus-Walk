import { isAdmin } from "api/src/auth/roles";
import { Navigate, Outlet, useLocation } from "react-router";
import { PageShell } from "@/app/PageShell";
import { useSession } from "@/auth-client";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Layout route: renders the child route only with a session (and, with `adminOnly`, the admin
 * role). Signed-out visitors go to /login and come back to where they were.
 * `adminOnly` is the stopgap until permissions move to the database.
 */
export function RequireAuth({ adminOnly = false }: { adminOnly?: boolean }) {
  const { data: session, isPending } = useSession();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Skeleton className="h-8 w-40" />
      </div>
    );
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (adminOnly && !isAdmin(session.user.role)) {
    return (
      <PageShell placeholder="Not allowed">
        <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
      </PageShell>
    );
  }
  return <Outlet />;
}
