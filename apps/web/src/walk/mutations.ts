import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc";

/**
 * Mutation hooks for the walk screen. Every write invalidates the room's asset
 * list, the campus tree (room header, tree check marks) and the office
 * aggregates, so each screen catches up on its next render.
 */
function useRoomInvalidation(campusId: string, roomId: string) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries(trpc.asset.byRoom.queryFilter({ roomId })),
      qc.invalidateQueries(trpc.campus.tree.queryFilter({ campusId })),
      qc.invalidateQueries(trpc.office.pathFilter()),
    ]);
}

export function useAssessAsset(campusId: string, roomId: string) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const invalidate = useRoomInvalidation(campusId, roomId);
  const key = trpc.asset.byRoom.queryKey({ roomId });
  return useMutation(
    trpc.asset.assess.mutationOptions({
      // Optimistic: the picker reflects the tap immediately.
      onMutate: async (vars) => {
        await qc.cancelQueries({ queryKey: key });
        const previous = qc.getQueryData(key);
        qc.setQueryData(key, (old) =>
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

export function useCreateAsset(campusId: string, roomId: string) {
  const trpc = useTRPC();
  const invalidate = useRoomInvalidation(campusId, roomId);
  return useMutation(trpc.asset.create.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useUpdateAsset(campusId: string, roomId: string) {
  const trpc = useTRPC();
  const invalidate = useRoomInvalidation(campusId, roomId);
  return useMutation(trpc.asset.update.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useRemoveAsset(campusId: string, roomId: string) {
  const trpc = useTRPC();
  const invalidate = useRoomInvalidation(campusId, roomId);
  return useMutation(trpc.asset.remove.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useFinishRoom(campusId: string, roomId: string) {
  const trpc = useTRPC();
  const invalidate = useRoomInvalidation(campusId, roomId);
  return useMutation(trpc.room.finish.mutationOptions({ onSuccess: () => invalidate() }));
}
