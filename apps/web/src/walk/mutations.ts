import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RouterOutputs } from "api/src/router";
import { useTRPC } from "@/trpc";
import { type AssetLocation, isRoomLocation } from "./types";

/**
 * Mutation hooks for the walk screen. Every asset write invalidates the asset list it
 * came from (a room's, or a building's own), the campus tree (room header, tree check
 * marks) and the office aggregates, so each screen catches up on its next render.
 */

type TRPC = ReturnType<typeof useTRPC>;

/** Query options for the asset list at a location. byRoom and byBuilding return the same shape. */
export function assetListOptions(trpc: TRPC, loc: AssetLocation) {
  return isRoomLocation(loc)
    ? trpc.asset.byRoom.queryOptions({ roomId: loc.roomId })
    : trpc.asset.byBuilding.queryOptions({ buildingId: loc.buildingId });
}

function assetListKey(trpc: TRPC, loc: AssetLocation) {
  return assetListOptions(trpc, loc).queryKey;
}

/** The move/create input fields that name a location. */
export function locationInput(loc: AssetLocation) {
  return isRoomLocation(loc) ? { roomId: loc.roomId } : { buildingId: loc.buildingId };
}

function useLocationInvalidation(campusId: string, loc: AssetLocation) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: assetListKey(trpc, loc) }),
      qc.invalidateQueries(trpc.campus.tree.queryFilter({ campusId })),
      qc.invalidateQueries(trpc.office.pathFilter()),
    ]);
}

type AssetList = RouterOutputs["asset"]["byRoom"];

export function useAssessAsset(campusId: string, loc: AssetLocation) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const invalidate = useLocationInvalidation(campusId, loc);
  const key = assetListKey(trpc, loc);
  return useMutation(
    trpc.asset.assess.mutationOptions({
      // Optimistic: the picker reflects the tap immediately.
      onMutate: async (vars) => {
        await qc.cancelQueries({ queryKey: key });
        const previous = qc.getQueryData<AssetList>(key);
        qc.setQueryData<AssetList>(key, (old) =>
          old?.map((a) =>
            a.id === vars.assetId
              ? {
                  ...a,
                  condition: vars.condition,
                  assessedAt: vars.condition == null ? null : new Date(),
                  notes: vars.notes === undefined ? a.notes : vars.notes,
                }
              : a,
          ),
        );
        return { previous };
      },
      onError: (_err, _vars, context) => {
        if (context?.previous) qc.setQueryData(key, context.previous);
      },
      onSettled: () => invalidate(),
    }),
  );
}

export function useCreateAsset(campusId: string, loc: AssetLocation) {
  const trpc = useTRPC();
  const invalidate = useLocationInvalidation(campusId, loc);
  return useMutation(trpc.asset.create.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useUpdateAsset(campusId: string, loc: AssetLocation) {
  const trpc = useTRPC();
  const invalidate = useLocationInvalidation(campusId, loc);
  return useMutation(trpc.asset.update.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useRemoveAsset(campusId: string, loc: AssetLocation) {
  const trpc = useTRPC();
  const invalidate = useLocationInvalidation(campusId, loc);
  return useMutation(trpc.asset.remove.mutationOptions({ onSuccess: () => invalidate() }));
}

/**
 * Moves an asset out of `from` into a room or a building's building level. Optimistic on the
 * source list so a dropped card leaves the grid immediately; the destination list (any room or
 * building, any campus) is simply invalidated.
 */
export function useMoveAsset(campusId: string, from: AssetLocation) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const invalidate = useLocationInvalidation(campusId, from);
  const key = assetListKey(trpc, from);
  return useMutation(
    trpc.asset.move.mutationOptions({
      onMutate: async (vars) => {
        await qc.cancelQueries({ queryKey: key });
        const previous = qc.getQueryData<AssetList>(key);
        qc.setQueryData<AssetList>(key, (old) => old?.filter((a) => a.id !== vars.assetId));
        return { previous };
      },
      onError: (_err, _vars, context) => {
        if (context?.previous) qc.setQueryData(key, context.previous);
      },
      onSettled: (_data, _err, vars) => {
        const to: AssetLocation = vars.roomId ? { roomId: vars.roomId } : { buildingId: vars.buildingId! };
        return Promise.all([invalidate(), qc.invalidateQueries({ queryKey: assetListKey(trpc, to) })]);
      },
    }),
  );
}

export function useFinishRoom(campusId: string, roomId: string) {
  const trpc = useTRPC();
  const invalidate = useLocationInvalidation(campusId, { roomId });
  return useMutation(trpc.room.finish.mutationOptions({ onSuccess: () => invalidate() }));
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
