import type { Mutation, QueryClient, QueryKey } from "@tanstack/react-query";
import type { TRPCClient } from "@trpc/client";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { AppRouter, RouterOutputs } from "api/src/router";
import { errorCode, isServerRejection } from "./errors";

/**
 * The walk screen's writes, queued offline and replayed in order.
 *
 * Each write is registered once with `setMutationDefaults`, keyed by its tRPC mutation key. That is
 * what lets a write persisted to IndexedDB find its function and callbacks again after a reload
 * (only the key and input are stored). Hooks in `walk/mutations.ts` use the same keys, so the
 * defaults below merge into them.
 *
 * - `onMutate` applies the change to every cached list or tree that shows it, so the UI reflects
 *   it at once, online or not.
 * - `scope` runs all of them one at a time in the order they were made (create, then rate).
 * - Network failures retry with backoff and pause while the browser is offline; an expired session
 *   retries too, until the user signs in again. A server rejection rolls the change back.
 * - The walk caches are refetched once the last queued write settles, not after each one, so a
 *   refetch never overwrites writes still waiting.
 */

type Trpc = TRPCOptionsProxy<AppRouter>;
type Asset = RouterOutputs["asset"]["byRoom"][number];
type Tree = RouterOutputs["campus"]["tree"];
type AssetType = RouterOutputs["assetType"]["list"][number];
type Snapshot = Array<[QueryKey, unknown]>;

export const OUTBOX_SCOPE = "outbox";

export function isOutboxMutation(mutation: Pick<Mutation, "options">) {
  return mutation.options.scope?.id === OUTBOX_SCOPE;
}

/** Same order as the API's `byTypeThenYear`, so an optimistic insert lands where the refetch will put it. */
export function byTypeThenYear(a: Asset, b: Asset) {
  return (
    a.assetType.category.localeCompare(b.assetType.category) ||
    a.assetType.name.localeCompare(b.assetType.name) ||
    (a.installYear ?? 0) - (b.installYear ?? 0)
  );
}

/** Mirrors the API's text inputs: trimmed, and empty means null. Undefined stays "untouched". */
function clean(v: string | null | undefined) {
  return v === undefined ? undefined : v?.trim() || null;
}

/** Applies `fn` to a room in a campus tree, returning a new tree. */
export function patchRoom(tree: Tree, roomId: string, fn: (room: Tree["buildings"][number]["floors"][number]["rooms"][number]) => typeof room) {
  return {
    ...tree,
    buildings: tree.buildings.map((b) => ({
      ...b,
      floors: b.floors.map((f) => ({ ...f, rooms: f.rooms.map((r) => (r.id === roomId ? fn(r) : r)) })),
    })),
  };
}

export function registerOutbox(qc: QueryClient, trpc: Trpc, client: TRPCClient<AppRouter>) {
  const assetLists = () => [trpc.asset.byRoom.pathFilter(), trpc.asset.byBuilding.pathFilter()];

  /** Stops refetches that would overwrite the optimistic change, and snapshots what it touches. */
  async function prepare(): Promise<{ snapshot: Snapshot }> {
    await Promise.all([qc.cancelQueries(trpc.asset.pathFilter()), qc.cancelQueries(trpc.campus.tree.pathFilter())]);
    const snapshot: Snapshot = [...assetLists(), trpc.campus.tree.pathFilter()].flatMap((f) => qc.getQueriesData(f));
    return { snapshot };
  }

  function rollback(err: unknown, context: { snapshot: Snapshot } | undefined) {
    if (!isServerRejection(err) || !context) return;
    for (const [key, data] of context.snapshot) qc.setQueryData(key, data);
  }

  function settle() {
    const waiting = qc.getMutationCache().findAll({ status: "pending", predicate: isOutboxMutation }).length;
    // Still counted here: this mutation is pending until its onSettled returns.
    if (waiting > 1) return;
    return Promise.all([
      qc.invalidateQueries(trpc.asset.pathFilter()),
      qc.invalidateQueries(trpc.campus.tree.pathFilter()),
      qc.invalidateQueries(trpc.office.pathFilter()),
    ]);
  }

  function mapAssets(fn: (list: Asset[]) => Asset[]) {
    for (const filter of assetLists()) qc.setQueriesData<Asset[]>(filter, (old) => old && fn(old));
  }

  function patchAsset(assetId: string, fn: (asset: Asset) => Asset) {
    mapAssets((list) => (list.some((a) => a.id === assetId) ? list.map((a) => (a.id === assetId ? fn(a) : a)) : list));
  }

  /** Adds to the list the asset now belongs to: its room's, or its building's building level. */
  function addToList(asset: Asset) {
    const key = asset.roomId
      ? trpc.asset.byRoom.queryKey({ roomId: asset.roomId })
      : trpc.asset.byBuilding.queryKey({ buildingId: asset.buildingId });
    // Only into a list that is already cached; a partial list would hide the location's other assets.
    qc.setQueryData<Asset[]>(key, (old) => old && [...old.filter((a) => a.id !== asset.id), asset].sort(byTypeThenYear));
  }

  /** The asset's { roomId, buildingId } columns for a create/move input; undefined if the room isn't cached. */
  function placement(v: { roomId?: string; buildingId?: string }) {
    if (v.buildingId) return { roomId: null, buildingId: v.buildingId };
    const buildingId = v.roomId ? buildingOf(v.roomId) : undefined;
    return buildingId ? { roomId: v.roomId!, buildingId } : undefined;
  }

  function buildingOf(roomId: string) {
    for (const [, tree] of qc.getQueriesData<Tree>(trpc.campus.tree.pathFilter()))
      for (const b of tree?.buildings ?? []) if (b.floors.some((f) => f.rooms.some((r) => r.id === roomId))) return b.id;
    return undefined;
  }

  function assetType(id: string): AssetType | undefined {
    return qc.getQueryData(trpc.assetType.list.queryKey())?.find((t) => t.id === id);
  }

  const common = {
    scope: { id: OUTBOX_SCOPE },
    retry: (_count: number, err: unknown) => !isServerRejection(err),
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 5000),
    onSettled: settle,
  };

  qc.setMutationDefaults(
    trpc.asset.assess.mutationKey(),
    trpc.asset.assess.mutationOptions({
      ...common,
      onMutate: async (v) => {
        const context = await prepare();
        patchAsset(v.assetId, (a) => ({
          ...a,
          condition: v.condition,
          assessedAt: v.condition == null ? null : (v.assessedAt ?? new Date()),
          notes: v.notes === undefined ? a.notes : (clean(v.notes) ?? null),
        }));
        return context;
      },
      onError: (err, _v, context) => rollback(err, context),
    }),
  );

  qc.setMutationDefaults(
    trpc.asset.update.mutationKey(),
    trpc.asset.update.mutationOptions({
      ...common,
      onMutate: async ({ assetId, assetTypeId, ...fields }) => {
        const context = await prepare();
        const type = assetTypeId ? assetType(assetTypeId) : undefined;
        const changes = Object.fromEntries(
          Object.entries(fields)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, typeof v === "string" ? clean(v) : v]),
        ) as Partial<Asset>;
        patchAsset(assetId, (a) => ({ ...a, ...changes, ...(type ? { assetTypeId: type.id, assetType: type } : {}) }));
        if (type) mapAssets((list) => [...list].sort(byTypeThenYear));
        return context;
      },
      onError: (err, _v, context) => rollback(err, context),
    }),
  );

  qc.setMutationDefaults(
    trpc.asset.create.mutationKey(),
    trpc.asset.create.mutationOptions({
      ...common,
      onMutate: async (v) => {
        const context = await prepare();
        const type = assetType(v.assetTypeId);
        const placed = placement(v);
        // Without a client id, a cached type or a known location there is nothing sensible to draw;
        // the refetch will show it.
        if (!v.id || !type || !placed) return context;
        const now = new Date();
        addToList({
          id: v.id,
          assetTypeId: type.id,
          assetType: type,
          ...placed,
          quantity: v.quantity ?? 1,
          assetTag: clean(v.assetTag) ?? null,
          manufacturer: clean(v.manufacturer) ?? null,
          model: clean(v.model) ?? null,
          serialNumber: clean(v.serialNumber) ?? null,
          installYear: v.installYear ?? null,
          notes: clean(v.notes) ?? null,
          condition: v.condition ?? null,
          assessedAt: v.condition == null ? null : (v.assessedAt ?? now),
          assessedBy: null,
          createdAt: now,
          updatedAt: now,
        });
        return context;
      },
      onError: (err, _v, context) => rollback(err, context),
    }),
  );

  qc.setMutationDefaults(
    trpc.asset.move.mutationKey(),
    trpc.asset.move.mutationOptions({
      ...common,
      onMutate: async (v) => {
        const context = await prepare();
        let moved: Asset | undefined;
        mapAssets((list) =>
          list.filter((a) => {
            if (a.id !== v.assetId) return true;
            moved = a;
            return false;
          }),
        );
        const placed = placement(v);
        if (moved && placed) addToList({ ...moved, ...placed });
        return context;
      },
      onError: (err, _v, context) => rollback(err, context),
    }),
  );

  qc.setMutationDefaults(trpc.asset.remove.mutationKey(), {
    ...trpc.asset.remove.mutationOptions({
      ...common,
      onMutate: async (v) => {
        const context = await prepare();
        mapAssets((list) => list.filter((a) => a.id !== v.assetId));
        return context;
      },
      onError: (err, _v, context) => rollback(err, context),
    }),
    mutationFn: removeAsset(client),
  });

  qc.setMutationDefaults(
    trpc.room.finish.mutationKey(),
    trpc.room.finish.mutationOptions({
      ...common,
      onMutate: async (v) => {
        const context = await prepare();
        qc.setQueriesData<Tree>(trpc.campus.tree.pathFilter(), (tree) =>
          tree && patchRoom(tree, v.roomId, (r) => ({
            ...r,
            assessedAt: v.assessedAt ?? new Date(),
            condition: v.condition === undefined ? r.condition : v.condition,
            notes: v.notes === undefined ? r.notes : (clean(v.notes) ?? null),
          })),
        );
        return context;
      },
      onError: (err, _v, context) => rollback(err, context),
    }),
  );
}

/**
 * Deleting is idempotent from the user's point of view: a replayed delete of an asset that is
 * already gone succeeded.
 */
export function removeAsset(client: TRPCClient<AppRouter>) {
  return async (input: { assetId: string }) => {
    try {
      return await client.asset.remove.mutate(input);
    } catch (err) {
      if (errorCode(err) === "NOT_FOUND") return { id: input.assetId };
      throw err;
    }
  };
}
