import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/app/PageShell";
import { Icons } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/trpc";
import { AssetGrid, Empty } from "./AssetGrid";
import { CampusTree } from "./CampusTree";
import { findFloor, findRoom } from "./types";
import { useSelection } from "./useSelection";

/** Field screen: campus → building → floor → room tree in the sidebar, the selected room's assets in the main area. */
export function WalkPage() {
  const trpc = useTRPC();
  const { campusId, floorId, roomId } = useSelection();

  // Same query key as the sidebar branch for this campus, so this is a cache read once expanded.
  const tree = useQuery({ ...trpc.campus.tree.queryOptions({ campusId: campusId ?? "" }), enabled: !!campusId });
  const floorHit = findFloor(tree.data, floorId);
  const roomHit = findRoom(tree.data, roomId);
  const crumbs = [
    tree.data?.name,
    floorHit?.building.name,
    floorHit?.floor.name,
    roomHit && `${roomHit.room.number} · ${roomHit.room.name}`,
  ].filter(Boolean) as string[];

  let main: React.ReactNode;
  if (!campusId) main = <Empty icon={Icons.campus}>Select a campus in the tree.</Empty>;
  else if (tree.isPending) main = <Skeleton className="h-40" />;
  else if (tree.error) main = <p className="text-sm text-destructive">{tree.error.message}</p>;
  else if (roomId && !roomHit) main = <Empty icon={Icons.condition.unknown}>Room not found in this campus.</Empty>;
  else if (roomHit) main = <AssetGrid campusId={campusId} room={roomHit.room} />;
  else if (floorId && !floorHit) main = <Empty icon={Icons.condition.unknown}>Floor not found in this campus.</Empty>;
  else main = <Empty icon={Icons.room}>Pick a room to see its assets.</Empty>;

  return (
    <PageShell sidebar={<CampusTree />} crumbs={crumbs} placeholder="Select a campus">
      {main}
    </PageShell>
  );
}
