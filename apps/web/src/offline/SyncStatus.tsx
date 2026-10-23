import { onlineManager, useMutationState, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { Link } from "react-router";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isUnauthorized } from "./errors";
import { isOutboxMutation } from "./outbox";

const LABELS: Record<string, string> = {
  "asset.assess": "Rating",
  "asset.update": "Asset edit",
  "asset.create": "New asset",
  "asset.move": "Move",
  "asset.remove": "Delete",
  "room.finish": "Room finish",
};

function label(mutationKey: readonly unknown[] | undefined) {
  const path = mutationKey?.[0];
  return (Array.isArray(path) && LABELS[path.join(".")]) || "Change";
}

export function useOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );
}

/**
 * Header indicator for the outbox: offline, how many writes are waiting, whether the session needs
 * signing in again, and writes the server refused (each can be discarded). Hidden when all is synced.
 */
export function SyncStatus() {
  const online = useOnline();
  const qc = useQueryClient();
  const waiting = useMutationState({
    filters: { status: "pending", predicate: isOutboxMutation },
    select: (m) => m.state.failureReason,
  });
  const failed = useMutationState({
    filters: { status: "error", predicate: isOutboxMutation },
    select: (m) => ({ id: m.mutationId, what: label(m.options.mutationKey), message: m.state.error?.message ?? "Failed" }),
  });

  if (online && waiting.length === 0 && failed.length === 0) return null;

  const needsSignIn = waiting.some(isUnauthorized);
  const count = `${waiting.length} ${waiting.length === 1 ? "change" : "changes"} waiting`;
  let Icon = Icons.sync.syncing;
  let text = `Syncing: ${count}`;
  if (!online) {
    Icon = Icons.sync.offline;
    text = waiting.length ? `Offline: ${count}` : "Offline";
  } else if (needsSignIn) {
    Icon = Icons.sync.pending;
    text = `Sign in to sync: ${count}`;
  }

  function discard(id: number) {
    const cache = qc.getMutationCache();
    const m = cache.getAll().find((x) => x.mutationId === id);
    if (m) cache.remove(m);
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {(waiting.length > 0 || !online) && (
        <span role="status" aria-label="Sync status" className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className={online && !needsSignIn ? "size-4 animate-spin" : "size-4"} />
          {needsSignIn ? (
            <Link to="/login" className="underline underline-offset-2">
              {text}
            </Link>
          ) : (
            text
          )}
        </span>
      )}
      {failed.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="xs" className="text-destructive" />}>
            <Icons.sync.error />
            {failed.length} not saved
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel>The server refused these changes</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {failed.map((f) => (
              <DropdownMenuItem key={f.id} onClick={() => discard(f.id)} className="flex-col items-start gap-0">
                <span className="font-medium">{f.what}</span>
                <span className="text-xs text-muted-foreground">{f.message}</span>
                <span className="text-xs underline">Dismiss</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
