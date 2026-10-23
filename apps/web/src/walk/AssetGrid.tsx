import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useCan } from "@/auth/permissions";
import { Icons, type LucideIcon } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ConditionBadge, ConditionPicker } from "@/lib/condition";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc";
import { AssetDialog } from "./AssetDialog";
import { FinishRoomDialog } from "./FinishRoomDialog";
import { RoomDialog } from "./RoomDialog";
import { useAssessAsset, useRemoveAsset } from "./mutations";
import type { AssetWithType, Room } from "./types";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  Furniture: Icons.assetCategory.furniture,
  Technology: Icons.assetCategory.technology,
  Equipment: Icons.assetCategory.other,
  "Building System": Icons.assetCategory.hvac,
};

/** Main area: the selected room's header, actions, and its assets as cards grouped by category. */
export function AssetGrid({ campusId, room }: { campusId: string; room: Room }) {
  const trpc = useTRPC();
  const assets = useQuery(trpc.asset.byRoom.queryOptions({ roomId: room.id }));
  const [adding, setAdding] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [editingRoom, setEditingRoom] = useState(false);
  const unrated = assets.data?.filter((a) => a.condition == null).length ?? 0;
  const { can: canCreate } = useCan("asset", "create");
  const { can: canAssessRoom } = useCan("room", "assess");
  const { can: canUpdateRoom } = useCan("room", "update");

  return (
    <div className="flex flex-col gap-6">
      <RoomHeader
        room={room}
        onAdd={() => setAdding(true)}
        onFinish={() => setFinishing(true)}
        onEdit={() => setEditingRoom(true)}
        canFinish={!!assets.data}
        showAdd={canCreate}
        showFinish={canAssessRoom}
        showEdit={canUpdateRoom}
      />
      {assets.isPending && (
        <Grid>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </Grid>
      )}
      {assets.error && <p className="text-sm text-destructive">Could not load assets: {assets.error.message}</p>}
      {assets.data && assets.data.length === 0 && (
        <Empty icon={Icons.asset}>
          No assets recorded in this room yet.
          {canCreate && (
            <Button size="sm" className="mt-3" onClick={() => setAdding(true)}>
              <Icons.ui.add />
              Add the first asset
            </Button>
          )}
        </Empty>
      )}
      {assets.data && assets.data.length > 0 && (
        <AssetSections campusId={campusId} roomId={room.id} assets={assets.data} unrated={unrated} />
      )}

      {adding && <AssetDialog open onOpenChange={setAdding} campusId={campusId} roomId={room.id} />}
      {finishing && (
        <FinishRoomDialog open onOpenChange={setFinishing} campusId={campusId} room={room} unratedCount={unrated} />
      )}
      {editingRoom && <RoomDialog open onOpenChange={setEditingRoom} campusId={campusId} room={room} />}
    </div>
  );
}

function RoomHeader({
  room,
  onAdd,
  onFinish,
  onEdit,
  canFinish,
  showAdd,
  showFinish,
  showEdit,
}: {
  room: Room;
  onAdd: () => void;
  onFinish: () => void;
  onEdit: () => void;
  canFinish: boolean;
  showAdd: boolean;
  showFinish: boolean;
  showEdit: boolean;
}) {
  const finished = room.assessedAt != null;
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{room.roomType ?? "Room"}</p>
          <h2 className="text-xl font-semibold">
            <span className="tabular-nums">{room.number}</span>
            {room.name !== room.number && <span className="text-muted-foreground"> · {room.name}</span>}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ConditionBadge rating={room.condition} />
          {showEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Icons.ui.settings />
              Edit details
            </Button>
          )}
          {showAdd && (
            <Button variant="outline" size="sm" onClick={onAdd}>
              <Icons.ui.add />
              Add asset
            </Button>
          )}
          {showFinish && (
            <Button size="sm" variant={finished ? "secondary" : "default"} onClick={onFinish} disabled={!canFinish}>
              {finished ? <Icons.ui.edit /> : <Icons.ui.confirm />}
              {finished ? "Update room" : "Finish room"}
            </Button>
          )}
        </div>
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
        {room.areaSf != null && <Fact label="Area" value={`${room.areaSf.toLocaleString()} sf`} />}
        {room.capacity != null && <Fact label="Capacity" value={String(room.capacity)} />}
        <Fact label="Walked" value={room.assessedAt ? room.assessedAt.toLocaleDateString() : "Not yet"} />
        {room.assessedBy && <Fact label="By" value={room.assessedBy} />}
      </dl>
      {room.notes && <p className="text-sm text-muted-foreground">{room.notes}</p>}
    </header>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/** The API already sorts by category, type, install year, so grouping preserves order. */
function AssetSections({
  campusId,
  roomId,
  assets,
  unrated,
}: {
  campusId: string;
  roomId: string;
  assets: AssetWithType[];
  unrated: number;
}) {
  const groups = new Map<string, AssetWithType[]>();
  for (const a of assets) {
    const list = groups.get(a.assetType.category) ?? [];
    list.push(a);
    groups.set(a.assetType.category, list);
  }
  const total = assets.reduce((n, a) => n + a.quantity, 0);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-muted-foreground">
        {assets.length} {assets.length === 1 ? "record" : "records"}, {total} {total === 1 ? "item" : "items"}
        {unrated > 0 && (
          <span className="text-condition-fair">
            {" "}
            · {unrated} not rated
          </span>
        )}
      </p>
      {[...groups].map(([category, items]) => {
        const Icon = CATEGORY_ICON[category] ?? Icons.asset;
        return (
          <section key={category} className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Icon className="size-4" />
              {category}
            </h3>
            <Grid>
              {items.map((a) => (
                <AssetCard key={a.id} campusId={campusId} roomId={roomId} asset={a} />
              ))}
            </Grid>
          </section>
        );
      })}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3">{children}</div>;
}

function AssetCard({ campusId, roomId, asset }: { campusId: string; roomId: string; asset: AssetWithType }) {
  const assess = useAssessAsset(campusId, roomId);
  const remove = useRemoveAsset(campusId, roomId);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const detail = [asset.manufacturer, asset.model].filter(Boolean).join(" ");
  const rated = asset.condition != null;
  const { can: canUpdate } = useCan("asset", "update");
  const { can: canDelete } = useCan("asset", "delete");
  const { can: canAssess } = useCan("asset", "assess");

  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground shadow-xs",
        !rated && "border-dashed",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">
          {asset.assetType.name}
          {asset.quantity > 1 && <span className="text-muted-foreground"> ×{asset.quantity}</span>}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {rated ? (
            <ConditionBadge rating={asset.condition} />
          ) : (
            <Badge variant="secondary">Not rated</Badge>
          )}
          {(canUpdate || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-xs" aria-label="Asset actions" className="-mr-1" />}
              >
                <Icons.ui.more />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canUpdate && (
                  <DropdownMenuItem onClick={() => setEditing(true)}>
                    <Icons.ui.edit />
                    Edit
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                    <Icons.ui.delete />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        {asset.assetTag && <span className="font-mono">{asset.assetTag}</span>}
        {detail && <span>{detail}</span>}
        {asset.installYear != null && <span>Installed {asset.installYear}</span>}
      </p>
      {asset.notes && <p className="text-sm">{asset.notes}</p>}

      <ConditionPicker
        className="mt-auto self-start"
        value={asset.condition}
        disabled={assess.isPending || !canAssess}
        onChange={(condition) => assess.mutate({ assetId: asset.id, condition })}
      />
      {assess.error && <p className="text-xs text-destructive">{assess.error.message}</p>}

      {editing && <AssetDialog open onOpenChange={setEditing} campusId={campusId} roomId={roomId} asset={asset} />}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this asset?</AlertDialogTitle>
            <AlertDialogDescription>
              {asset.assetType.name}
              {asset.quantity > 1 ? ` ×${asset.quantity}` : ""} will be removed from this room. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate({ assetId: asset.id })}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

export function Empty({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <Icon className="size-8" />
      <div className="flex flex-col items-center text-sm">{children}</div>
    </div>
  );
}
