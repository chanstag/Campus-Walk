import { useQuery } from "@tanstack/react-query";
import { type Action, type PermissionKey, type Resource, permissionKey } from "api/src/auth/permission-catalog";
import { useTRPC } from "@/trpc";

/**
 * The signed-in user's permission keys (`permissions.mine`). Cached for a minute; sign-out
 * clears the whole query cache and matrix edits invalidate `permissions.*`.
 */
export function usePermissions(enabled = true) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.permissions.mine.queryOptions(), staleTime: 60_000, enabled });
}

export function hasPermission(keys: readonly PermissionKey[] | undefined, key: PermissionKey) {
  return keys?.includes(key) ?? false;
}

/** `can` is false while loading, so write controls appear only once permissions are known. */
export function useCan<R extends Resource>(resource: R, action: Action<R>) {
  const { data, isPending } = usePermissions();
  return { can: hasPermission(data, permissionKey(resource, action)), isPending };
}

/** Renders children only when the user holds `resource:action`. The server checks regardless. */
export function Can<R extends Resource>({
  resource,
  action,
  fallback = null,
  children,
}: {
  resource: R;
  action: Action<R>;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { can } = useCan(resource, action);
  return <>{can ? children : fallback}</>;
}
