import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTRPC } from "@/trpc";
import { locationInput, useMoveAsset } from "./mutations";
import { type AssetLocation, type AssetWithType, isRoomLocation } from "./types";

/** Select values: a room or a building's building level, kept distinct in one list. */
const encode = (loc: AssetLocation) => (isRoomLocation(loc) ? `room:${loc.roomId}` : `building:${loc.buildingId}`);
function decode(value: string): AssetLocation {
  const [kind, id] = value.split(":") as [string, string];
  return kind === "room" ? { roomId: id } : { buildingId: id };
}

/**
 * Picks another room, or a building's building level, in the same campus for an asset. The
 * keyboard / touch counterpart of dragging a card onto the tree, which also reaches other campuses.
 */
export function MoveAssetDialog({
  open,
  onOpenChange,
  campusId,
  from,
  asset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campusId: string;
  from: AssetLocation;
  asset: AssetWithType;
}) {
  const trpc = useTRPC();
  const tree = useQuery(trpc.campus.tree.queryOptions({ campusId }));
  const move = useMoveAsset(campusId, from);
  const [target, setTarget] = useState<string | null>(null);
  const current = encode(from);

  // One group per building: its building level first, then every room by floor.
  const groups = (tree.data?.buildings ?? []).map((b) => ({
    key: b.id,
    label: b.name,
    options: [
      { value: encode({ buildingId: b.id }), primary: "Building level", secondary: "" },
      ...b.floors.flatMap((f) =>
        f.rooms.map((r) => ({ value: encode({ roomId: r.id }), primary: r.number, secondary: `${r.name} · ${f.name}` })),
      ),
    ].filter((o) => o.value !== current),
  }));
  const labels = Object.fromEntries(
    groups.flatMap((g) =>
      g.options.map((o) => [o.value, o.secondary ? `${g.label} · ${o.primary} · ${o.secondary}` : `${g.label} · ${o.primary}`]),
    ),
  );

  async function submit() {
    if (!target) return;
    await move.mutateAsync({ assetId: asset.id, ...locationInput(decode(target)) });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move asset</DialogTitle>
          <DialogDescription>
            {asset.assetType.name}
            {asset.quantity > 1 ? ` ×${asset.quantity}` : ""} keeps its rating and notes. You can also drag a card onto a room or
            building in the tree.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (target && !move.isPending) void submit();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="m-room">Destination</Label>
            <Select value={target} onValueChange={setTarget} items={labels}>
              <SelectTrigger id="m-room" className="w-full">
                <SelectValue placeholder={tree.isPending ? "Loading…" : "Choose a room or building level"} />
              </SelectTrigger>
              <SelectContent>
                {groups
                  .filter((g) => g.options.length > 0)
                  .map((g) => (
                    <SelectGroup key={g.key}>
                      <SelectLabel>{g.label}</SelectLabel>
                      {g.options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          <span className="tabular-nums">{o.primary}</span>
                          {o.secondary && <span className="text-muted-foreground">{o.secondary}</span>}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {move.error && <p className="text-sm text-destructive">{move.error.message}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!target || move.isPending}>
              Move
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
