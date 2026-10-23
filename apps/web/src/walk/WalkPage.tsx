import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageShell } from "@/app/PageShell";
import { useCan } from "@/auth/permissions";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/trpc";
import { AssetGrid, Empty } from "./AssetGrid";
import { CampusTree } from "./CampusTree";
import { BuildingDialog } from "./BuildingDialog";
import { FloorDialog } from "./FloorDialog";
import { RoomDialog } from "./RoomDialog";
import { type Building, type Floor, findFloor, findRoom } from "./types";
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
  else if (floorHit) main = <FloorView campusId={campusId} building={floorHit.building} floor={floorHit.floor} />;
  else main = <Empty icon={Icons.room}>Pick a room to see its assets.</Empty>;

  return (
    <PageShell sidebar={<CampusTree />} crumbs={crumbs} placeholder="Select a campus">
      {main}
    </PageShell>
  );
}

/** A floor is selected but no room: its building and floor, then a prompt to pick a room or add the first. */
function FloorView({ campusId, building, floor }: { campusId: string; building: Building; floor: Floor }) {
  const { selectRoom } = useSelection();
  const { can: canCreateRoom } = useCan("room", "create");
  const { can: canUpdateBuilding } = useCan("building", "update");
  const { can: canUpdateFloor } = useCan("floor", "update");
  const [adding, setAdding] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState(false);
  const [editingFloor, setEditingFloor] = useState(false);
  const facts = [
    building.buildingType,
    building.yearBuilt != null && `Built ${building.yearBuilt}`,
    building.grossSf != null && `${building.grossSf.toLocaleString()} sf`,
    `${building.floors.length} ${building.floors.length === 1 ? "floor" : "floors"}`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{facts.join(" · ")}</p>
          <h2 className="text-xl font-semibold">
            {building.name}
            <span className="text-muted-foreground"> · {floor.name}</span>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canUpdateBuilding && (
            <Button variant="ghost" size="sm" onClick={() => setEditingBuilding(true)}>
              <Icons.building />
              Edit building
            </Button>
          )}
          {canUpdateFloor && (
            <Button variant="ghost" size="sm" onClick={() => setEditingFloor(true)}>
              <Icons.floor />
              Edit floor
            </Button>
          )}
        </div>
      </header>
      <Empty icon={Icons.room}>
        {floor.rooms.length === 0 ? `No rooms on ${floor.name} yet.` : "Pick a room to see its assets."}
        {canCreateRoom && (
          <Button size="sm" variant={floor.rooms.length === 0 ? "default" : "outline"} className="mt-3" onClick={() => setAdding(true)}>
            <Icons.ui.add />
            Add room
          </Button>
        )}
      </Empty>
      {adding && (
        <RoomDialog
          open
          onOpenChange={setAdding}
          campusId={campusId}
          floor={floor}
          onCreated={(r) => selectRoom(campusId, r.floorId, r.id)}
        />
      )}
      {editingBuilding && <BuildingDialog open onOpenChange={setEditingBuilding} campusId={campusId} building={building} />}
      {editingFloor && <FloorDialog open onOpenChange={setEditingFloor} campusId={campusId} floor={floor} />}
    </div>
  );
}
