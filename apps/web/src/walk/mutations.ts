import { onlineManager, useMutation, useQueryClient } from "@tanstack/react-query";
import { removeAsset } from "@/offline/outbox";
import { useTRPC, useTRPCClient } from "@/trpc";
import { type AssetLocation, isRoomLocation } from "./types";

/**
 * Mutation hooks for the walk screen.
 *
 * Asset writes and room.finish go through the offline outbox (`offline/outbox.ts`): their
 * optimistic updates, ordering, retries and cache refreshes are registered there by mutation key,
 * so these hooks only bind the key. They work the same online and offline.
 */

type TRPC = ReturnType<typeof useTRPC>;

/** Query options for the asset list at a location. byRoom and byBuilding return the same shape. */
export function assetListOptions(trpc: TRPC, loc: AssetLocation) {
  return isRoomLocation(loc)
    ? trpc.asset.byRoom.queryOptions({ roomId: loc.roomId })
    : trpc.asset.byBuilding.queryOptions({ buildingId: loc.buildingId });
}

/** The move/create input fields that name a location. */
export function locationInput(loc: AssetLocation) {
  return isRoomLocation(loc) ? { roomId: loc.roomId } : { buildingId: loc.buildingId };
}

export function useAssessAsset() {
  const trpc = useTRPC();
  return useMutation(trpc.asset.assess.mutationOptions());
}

/** Callers pick the id (`crypto.randomUUID()`) so a create made offline can be edited and rated before it syncs. */
export function useCreateAsset() {
  const trpc = useTRPC();
  return useMutation(trpc.asset.create.mutationOptions());
}

export function useUpdateAsset() {
  const trpc = useTRPC();
  return useMutation(trpc.asset.update.mutationOptions());
}

export function useRemoveAsset() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  return useMutation({ ...trpc.asset.remove.mutationOptions(), mutationFn: removeAsset(client) });
}

/** Into a room or a building's building level; any campus. */
export function useMoveAsset() {
  const trpc = useTRPC();
  return useMutation(trpc.asset.move.mutationOptions());
}

export function useFinishRoom() {
  const trpc = useTRPC();
  return useMutation(trpc.room.finish.mutationOptions());
}

/**
 * Dialog submit for an outbox write. Online, wait for the server so the dialog can show its error.
 * Offline, queue it and return at once; it syncs later and shows in the header's sync status.
 */
export async function submitWrite<V>(mutation: { mutate: (v: V) => void; mutateAsync: (v: V) => Promise<unknown> }, vars: V) {
  if (onlineManager.isOnline()) await mutation.mutateAsync(vars);
  else mutation.mutate(vars);
}

/** Structure writes (room, floor, building) change the tree and the office lists of unwalked rooms. */
function useTreeInvalidation(campusId: string) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries(trpc.campus.tree.queryFilter({ campusId })),
      qc.invalidateQueries(trpc.office.pathFilter()),
    ]);
}

export function useCreateRoom(campusId: string) {
  const trpc = useTRPC();
  const invalidate = useTreeInvalidation(campusId);
  return useMutation(trpc.room.create.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useUpdateRoom(campusId: string) {
  const trpc = useTRPC();
  const invalidate = useTreeInvalidation(campusId);
  return useMutation(trpc.room.update.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useCreateFloor(campusId: string) {
  const trpc = useTRPC();
  const invalidate = useTreeInvalidation(campusId);
  return useMutation(trpc.floor.create.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useUpdateFloor(campusId: string) {
  const trpc = useTRPC();
  const invalidate = useTreeInvalidation(campusId);
  return useMutation(trpc.floor.update.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useCreateBuilding(campusId: string) {
  const trpc = useTRPC();
  const invalidate = useTreeInvalidation(campusId);
  return useMutation(trpc.building.create.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useUpdateBuilding(campusId: string) {
  const trpc = useTRPC();
  const invalidate = useTreeInvalidation(campusId);
  return useMutation(trpc.building.update.mutationOptions({ onSuccess: () => invalidate() }));
}
