import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
import { useTRPC } from "@/trpc";
import { RoomDialog } from "./RoomDialog";
import type { Building, Floor } from "./types";
import { walkedCount } from "./types";
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
            <Collapsible
              key={c.id}
              open={open[c.id] ?? false}
              onOpenChange={(o) => setOpen((prev) => ({ ...prev, [c.id]: o }))}
            >
              <SidebarMenuItem>
                <CollapsibleTrigger
                  render={<SidebarMenuButton isActive={c.id === campusId} />}
                >
                  <Icons.campus />
                  <span className="truncate">{c.name}</span>
                  <Chevron />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CampusBranch campusId={c.id} />
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
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
    </SidebarMenuSub>
  );
}

function BuildingNode({
  campusId,
  building,
}: {
  campusId: string;
  building: Building;
}) {
  const { floorId } = useSelection();
  const containsSelection = building.floors.some((f) => f.id === floorId);
  const [open, setOpen] = useState(containsSelection);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuSubItem>
        <CollapsibleTrigger
          render={
            <SidebarMenuSubButton
              render={<button type="button" />}
              className="w-full text-left"
              isActive={containsSelection}
            />
          }
        >
          <Icons.building />
          <span className="truncate">{building.name}</span>
          <Chevron />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="mr-0 pr-0">
            {building.floors.map((f) => (
              <FloorNode key={f.id} campusId={campusId} floor={f} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}

function FloorNode({ campusId, floor }: { campusId: string; floor: Floor }) {
  const { floorId, roomId, selectFloor, selectRoom } = useSelection();
  const { isMobile, setOpenMobile } = useSidebar();
  const isCurrent = floor.id === floorId;
  const [open, setOpen] = useState(isCurrent);
  const [adding, setAdding] = useState(false);
  const { can: canCreateRoom } = useCan("room", "create");

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
              <SidebarMenuSubItem key={r.id}>
                <SidebarMenuSubButton
                  render={<button type="button" />}
                  className="w-full text-left"
                  size="sm"
                  isActive={r.id === roomId}
                  onClick={() => {
                    selectRoom(campusId, floor.id, r.id);
                    if (isMobile) setOpenMobile(false);
                  }}
                >
                  <Icons.room />
                  <span className="shrink-0 tabular-nums">{r.number}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {r.name}
                  </span>
                  {r.assessedAt != null && (
                    <Icons.ui.confirm
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-label="Walked"
                    />
                  )}
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
            {canCreateRoom && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  render={<button type="button" />}
                  className="w-full text-left text-muted-foreground"
                  size="sm"
                  onClick={() => setAdding(true)}
                >
                  <Icons.ui.add />
                  <span>Add room</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
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
