import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useCan } from "@/auth/permissions";
import { Icons } from "@/components/icons";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc";
import { BuildingDialog } from "./BuildingDialog";
import { FloorDialog } from "./FloorDialog";
import { RoomDialog } from "./RoomDialog";
import { droppedAssetId, isAssetDrag } from "./drag";
import { locationInput, useMoveAsset } from "./mutations";
import type { AssetLocation, Building, Floor, Room } from "./types";
import { sameLocation, walkedCount } from "./types";
import { useSelection } from "./useSelection";

/** Campus → building → floor → room. Expansion is local; selection is in the URL. */
export function CampusTree() {
  const trpc = useTRPC();
  const campuses = useQuery(trpc.campus.list.queryOptions());
  const { campusId } = useSelection();
  // Seed from the URL so a shared link opens on the right branch.
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    campusId ? { [campusId]: true } : {},
  );

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {campuses.isPending &&
            [0, 1].map((i) => <SidebarMenuSkeleton key={i} showIcon />)}
          {campuses.error && (
            <p className="px-2 text-sm text-destructive">
              Could not load campuses: {campuses.error.message}
            </p>
          )}
          {campuses.data?.map((c) => (
            <CampusNode
              key={c.id}
              campus={c}
              isActive={c.id === campusId}
              open={open[c.id] ?? false}
              setOpen={(o) => setOpen((prev) => ({ ...prev, [c.id]: o }))}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function CampusNode({
  campus,
  isActive,
  open,
  setOpen,
}: {
  campus: { id: string; name: string };
  isActive: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const springOpen = useSpringOpen(open, setOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <CollapsibleTrigger render={<SidebarMenuButton isActive={isActive} {...springOpen} />}>
          <Icons.campus />
          <span className="truncate">{campus.name}</span>
          <Chevron />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CampusBranch campusId={campus.id} />
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

/** True when a drag event moved to a child of the element, which still counts as "over" it. */
function staysInside(e: React.DragEvent) {
  return e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget);
}

/**
 * Drag handlers for a collapsed tree node: holding a dragged asset over it for a moment expands
 * it, so a card can be carried to any room without opening the branch first.
 */
function useSpringOpen(open: boolean, setOpen: (open: boolean) => void) {
  const timer = useRef<number | undefined>(undefined);
  const cancel = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
  };
  useEffect(() => cancel, []);
  return {
    onDragEnter: (e: React.DragEvent) => {
      if (open || timer.current !== undefined || !isAssetDrag(e)) return;
      timer.current = window.setTimeout(() => {
        timer.current = undefined;
        setOpen(true);
      }, 500);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!staysInside(e)) cancel();
    },
    onDrop: cancel,
  };
}

function Chevron() {
  return (
    <Icons.ui.chevronRight className="ml-auto transition-transform data-[panel-open]:rotate-90" />
  );
}

/** Mounted only while its campus is expanded, so the tree query runs on demand. */
function CampusBranch({ campusId }: { campusId: string }) {
  const trpc = useTRPC();
  const tree = useQuery(trpc.campus.tree.queryOptions({ campusId }));
  const { selectFloor } = useSelection();
  const { can: canCreateBuilding } = useCan("building", "create");
  const [adding, setAdding] = useState(false);

  if (tree.isPending) {
    return (
      <SidebarMenuSub className="mr-0 pr-0">
        {[0, 1, 2].map((i) => (
          <SidebarMenuSkeleton key={i} />
        ))}
      </SidebarMenuSub>
    );
  }
  if (tree.error) {
    return (
      <p className="px-4 py-1 text-xs text-destructive">{tree.error.message}</p>
    );
  }
  return (
    <SidebarMenuSub className="mr-0 pr-0">
      {tree.data.buildings.map((b) => (
        <BuildingNode key={b.id} campusId={campusId} building={b} />
      ))}
      {canCreateBuilding && <AddRow onClick={() => setAdding(true)}>Add building</AddRow>}
      {adding && (
        <BuildingDialog
          open
          onOpenChange={setAdding}
          campusId={campusId}
          campusName={tree.data.name}
          onCreated={(created) => selectFloor(campusId, created.floor.id)}
        />
      )}
    </SidebarMenuSub>
  );
}

/**
 * Opens a node when the selection moves inside it after mount, e.g. a just-created building or
 * floor (the tree refetches before the new node is selected). Never collapses.
 */
function useExpandOnSelect(selected: boolean, setOpen: (open: boolean) => void) {
  useEffect(() => {
    if (selected) setOpen(true);
  }, [selected, setOpen]);
}

/** Muted "+ Add …" row at the end of a tree level. */
function AddRow({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        render={<button type="button" />}
        className="w-full text-left text-muted-foreground"
        size="sm"
        onClick={onClick}
      >
        <Icons.ui.add />
        <span>{children}</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

/**
 * A building row. Clicking it selects the building (its own assets: building systems and
 * unplaced equipment) and toggles its floors. Also a drop target that moves an asset card to
 * the building level.
 */
function BuildingNode({
  campusId,
  building,
}: {
  campusId: string;
  building: Building;
}) {
  const { buildingId, floorId, selectBuilding, selectFloor } = useSelection();
  const { isMobile, setOpenMobile } = useSidebar();
  const isCurrent = building.id === buildingId;
  const containsSelection = building.floors.some((f) => f.id === floorId);
  const [open, setOpen] = useState(isCurrent || containsSelection);
  const springOpen = useSpringOpen(open, setOpen);
  useExpandOnSelect(isCurrent || containsSelection, setOpen);
  const drop = useAssetDrop({ buildingId: building.id });
  const [adding, setAdding] = useState(false);
  const { can: canCreateFloor } = useCan("floor", "create");

  return (
    // The first click selects the building and keeps its floors showing; clicking it again toggles.
    <Collapsible open={open} onOpenChange={(o) => setOpen(o || !isCurrent)}>
      <SidebarMenuSubItem>
        <CollapsibleTrigger
          render={
            <SidebarMenuSubButton
              render={<button type="button" />}
              className={cn("w-full text-left", drop.over && dropRing)}
              isActive={isCurrent || containsSelection}
              onClick={() => {
                selectBuilding(campusId, building.id);
                if (isMobile) setOpenMobile(false);
              }}
              onDragEnter={springOpen.onDragEnter}
              onDragOver={drop.onDragOver}
              onDragLeave={(e) => {
                springOpen.onDragLeave(e);
                drop.onDragLeave(e);
              }}
              onDrop={(e) => {
                springOpen.onDrop();
                drop.onDrop(e);
              }}
            />
          }
        >
          <Icons.building />
          <span className="min-w-0 flex-1 truncate">{building.name}</span>
          {drop.move.isPending && <Icons.move className="size-3.5 shrink-0 animate-pulse text-muted-foreground" aria-label="Moving" />}
          <Icons.ui.chevronRight className="transition-transform data-[panel-open]:rotate-90" />
        </CollapsibleTrigger>
        <DropError move={drop.move} />
        <CollapsibleContent>
          <SidebarMenuSub className="mr-0 pr-0">
            {building.floors.map((f) => (
              <FloorNode key={f.id} campusId={campusId} floor={f} />
            ))}
            {canCreateFloor && <AddRow onClick={() => setAdding(true)}>Add floor</AddRow>}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
      {adding && (
        <FloorDialog
          open
          onOpenChange={setAdding}
          campusId={campusId}
          building={building}
          onCreated={(f) => selectFloor(campusId, f.id)}
        />
      )}
    </Collapsible>
  );
}

function FloorNode({ campusId, floor }: { campusId: string; floor: Floor }) {
  const { floorId, roomId, selectFloor, selectRoom } = useSelection();
  const { isMobile, setOpenMobile } = useSidebar();
  const isCurrent = floor.id === floorId;
  const [open, setOpen] = useState(isCurrent);
  useExpandOnSelect(isCurrent, setOpen);
  const [adding, setAdding] = useState(false);
  const { can: canCreateRoom } = useCan("room", "create");
  const springOpen = useSpringOpen(open, setOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuSubItem>
        <CollapsibleTrigger
          render={
            <SidebarMenuSubButton
              render={<button type="button" />}
              className="w-full text-left"
              size="sm"
              isActive={isCurrent && !roomId}
              onClick={() => selectFloor(campusId, floor.id)}
              {...springOpen}
            />
          }
        >
          <Icons.floor />
          <span className="min-w-0 flex-1 truncate">{floor.name}</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {walkedCount(floor.rooms)}/{floor.rooms.length}
          </span>
          <Icons.ui.chevronRight className="transition-transform data-[panel-open]:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="ml-2 mr-0 pl-1.5 pr-0">
            {floor.rooms.map((r) => (
              <RoomNode key={r.id} campusId={campusId} floorId={floor.id} room={r} />
            ))}
            {canCreateRoom && <AddRow onClick={() => setAdding(true)}>Add room</AddRow>}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
      {adding && (
        <RoomDialog
          open
          onOpenChange={setAdding}
          campusId={campusId}
          floor={floor}
          onCreated={(r) => {
            selectRoom(campusId, r.floorId, r.id);
            if (isMobile) setOpenMobile(false);
          }}
        />
      )}
    </Collapsible>
  );
}

const dropRing = "bg-sidebar-accent ring-2 ring-sidebar-ring";

/**
 * Makes a tree row a drop target for asset cards. Drags only start in the asset list on screen,
 * so the current selection is the source; dropping onto that same location does nothing.
 */
function useAssetDrop(target: AssetLocation) {
  const selection = useSelection();
  const from = selection.assetLocation;
  const { can: canMove } = useCan("asset", "update");
  const move = useMoveAsset();
  const [over, setOver] = useState(false);
  const accepts = (e: React.DragEvent) => canMove && !!from && !sameLocation(from, target) && isAssetDrag(e);

  return {
    over,
    move,
    onDragOver: (e: React.DragEvent) => {
      if (!accepts(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setOver(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!staysInside(e)) setOver(false);
    },
    onDrop: (e: React.DragEvent) => {
      setOver(false);
      const assetId = droppedAssetId(e);
      if (!accepts(e) || !assetId) return;
      e.preventDefault();
      move.mutate({ assetId, ...locationInput(target) });
    },
  };
}

function DropError({ move }: { move: ReturnType<typeof useMoveAsset> }) {
  if (!move.error) return null;
  return (
    <p role="alert" className="px-2 py-1 text-xs text-destructive">
      Could not move asset: {move.error.message}
    </p>
  );
}

/** A room row. Also a drop target for asset cards dragged out of the selected room or building. */
function RoomNode({ campusId, floorId, room }: { campusId: string; floorId: string; room: Room }) {
  const selection = useSelection();
  const { isMobile, setOpenMobile } = useSidebar();
  const drop = useAssetDrop({ roomId: room.id });
  const isCurrent = room.id === selection.roomId;

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        render={<button type="button" />}
        className={cn("w-full text-left", drop.over && dropRing)}
        size="sm"
        isActive={isCurrent}
        onClick={() => {
          selection.selectRoom(campusId, floorId, room.id);
          if (isMobile) setOpenMobile(false);
        }}
        onDragOver={drop.onDragOver}
        onDragLeave={drop.onDragLeave}
        onDrop={drop.onDrop}
      >
        <Icons.room />
        <span className="shrink-0 tabular-nums">{room.number}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{room.name}</span>
        {drop.move.isPending && <Icons.move className="size-3.5 shrink-0 animate-pulse text-muted-foreground" aria-label="Moving" />}
        {room.assessedAt != null && (
          <Icons.ui.confirm className="size-3.5 shrink-0 text-muted-foreground" aria-label="Walked" />
        )}
      </SidebarMenuSubButton>
      <DropError move={drop.move} />
    </SidebarMenuSubItem>
  );
}
