import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTRPC } from "@/trpc";
import type { AssetWithType, CampusTree } from "@/walk/types";
import { isOutboxMutation } from "./outbox";

/**
 * Keeps every room of the open campus readable offline: fetches all its assets in one request
 * (`asset.byCampus`) and writes each room's `asset.byRoom` and each building's `asset.byBuilding`
 * cache from it. Those caches are persisted, so rooms never opened online still load in the field.
 * Skipped while writes are queued, so it never overwrites their optimistic state. Also loads the
 * asset type list, which "Add asset" needs and would otherwise only fetch when the dialog opens.
 */
export function useCampusOffline(campusId: string | null, tree: CampusTree | undefined) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const all = useQuery({
    ...trpc.asset.byCampus.queryOptions({ campusId: campusId ?? "" }),
    enabled: !!campusId,
    staleTime: 5 * 60_000,
  });
  useQuery({ ...trpc.assetType.list.queryOptions(), staleTime: 5 * 60_000 });

  useEffect(() => {
    if (!all.data || !tree || tree.id !== campusId) return;
    if (qc.getMutationCache().findAll({ status: "pending", predicate: isOutboxMutation }).length > 0) return;

    const byRoom = new Map<string, AssetWithType[]>();
    const byBuilding = new Map<string, AssetWithType[]>();
    for (const a of all.data) {
      const [map, key] = a.roomId ? [byRoom, a.roomId] : [byBuilding, a.buildingId];
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    // Rows arrive sorted like byRoom/byBuilding, and grouping keeps that order.
    for (const b of tree.buildings) {
      qc.setQueryData(trpc.asset.byBuilding.queryKey({ buildingId: b.id }), byBuilding.get(b.id) ?? []);
      for (const f of b.floors)
        for (const r of f.rooms) qc.setQueryData(trpc.asset.byRoom.queryKey({ roomId: r.id }), byRoom.get(r.id) ?? []);
    }
  }, [all.data, tree, campusId, qc, trpc]);
}
