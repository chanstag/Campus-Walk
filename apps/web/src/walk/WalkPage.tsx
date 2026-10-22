import { useQuery } from "@tanstack/react-query";
import { Icons } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTRPC } from "@/trpc";
import { AssetGrid, Empty } from "./AssetGrid";
import { CampusTree } from "./CampusTree";
import { findFloor, findRoom } from "./types";
import { useSelection } from "./useSelection";

/** Field screen: campus → building → floor → room tree on the left, the selected room's assets on the right. */
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
  else if (roomHit) main = <AssetGrid room={roomHit.room} />;
  else if (floorId && !floorHit) main = <Empty icon={Icons.condition.unknown}>Floor not found in this campus.</Empty>;
  else main = <Empty icon={Icons.room}>Pick a room to see its assets.</Empty>;

  return (
    <TooltipProvider>
      {/* Four tree levels need more than the 16rem default. */}
      <SidebarProvider style={{ "--sidebar-width": "19rem" } as React.CSSProperties}>
        <Sidebar>
          <SidebarHeader className="flex-row items-center gap-2 px-4 py-3">
            <Icons.walk className="size-5" />
            <span className="font-semibold">Campus Walk</span>
          </SidebarHeader>
          <SidebarContent>
            <CampusTree />
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="min-h-svh">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
            <nav aria-label="Location" className="flex min-w-0 items-center gap-1 text-sm">
              {crumbs.length === 0 && <span className="text-muted-foreground">Select a campus</span>}
              {crumbs.map((c, i) => (
                <span key={i} className="flex min-w-0 items-center gap-1">
                  {i > 0 && <Icons.ui.chevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
                  <span className={i === crumbs.length - 1 ? "truncate font-medium" : "truncate text-muted-foreground"}>
                    {c}
                  </span>
                </span>
              ))}
            </nav>
            <ThemeToggle className="ml-auto" />
          </header>

          <div className="min-h-0 flex-1 overflow-auto p-4">{main}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
