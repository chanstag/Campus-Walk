import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Mutation, Query } from "@tanstack/react-query";
import type { PersistedClient } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";
import superjson from "superjson";

/** IndexedDB key holding the persisted query + mutation cache. */
export const CACHE_KEY = "campus-walk-cache";

/** How long a persisted cache is trusted. Queries keep the same gcTime so they survive to be saved. */
export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/**
 * Bump when a persisted shape changes incompatibly (a procedure's output, a mutation's input):
 * caches with another buster are thrown away on load.
 */
export const CACHE_BUSTER = "1";

/** Reads the walk screen needs with no network. Office, users and photo URLs stay online-only. */
const PERSISTED_PATHS = new Set([
  "campus.list",
  "campus.tree",
  "asset.byRoom",
  "asset.byBuilding",
  "assetType.list",
  "permissions.mine",
]);

/** tRPC query keys start with the procedure path as an array: `[["asset", "byRoom"], { input, type }]`. */
export function shouldPersistQuery(query: Pick<Query, "queryKey" | "state">) {
  const path = query.queryKey[0];
  return query.state.status === "success" && Array.isArray(path) && PERSISTED_PATHS.has(path.join("."));
}

/** Every write the server has not confirmed yet, whether paused offline or mid-request. */
export function shouldPersistMutation(mutation: Pick<Mutation, "state">) {
  return mutation.state.status === "pending";
}

/**
 * A pending mutation restored from storage has no request in flight, so mark it paused:
 * `resumePausedMutations()` only replays paused ones.
 */
export function pauseRestoredMutations(client: PersistedClient): PersistedClient {
  return {
    ...client,
    clientState: {
      ...client.clientState,
      mutations: client.clientState.mutations.map((m) =>
        m.state.status === "pending" ? { ...m, state: { ...m.state, isPaused: true } } : m,
      ),
    },
  };
}

/** superjson keeps `Date`s (assessedAt in cached rows and queued inputs) as `Date` across reloads. */
export function makePersister() {
  return createAsyncStoragePersister({
    storage: { getItem: get<string>, setItem: set, removeItem: del },
    key: CACHE_KEY,
    // A tap is saved within a quarter second, so closing the tab right after rarely loses it.
    throttleTime: 250,
    serialize: (client) => superjson.stringify(client),
    deserialize: (raw) => pauseRestoredMutations(superjson.parse<PersistedClient>(raw)),
  });
}

/** Sign-out: forget the persisted cache, including any writes still waiting. */
export function clearPersistedCache() {
  return del(CACHE_KEY);
}
