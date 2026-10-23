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
import { useMoveAsset } from "./mutations";
import type { AssetWithType } from "./types";

/**
 * Picks another room in the same campus for an asset. The keyboard / touch counterpart of dragging
 * a card onto the tree, which also reaches other campuses.
 */
export function MoveAssetDialog({
  open,
  onOpenChange,
  campusId,
  roomId,
  asset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campusId: string;
  roomId: string;
  asset: AssetWithType;
}) {
  const trpc = useTRPC();
  const tree = useQuery(trpc.campus.tree.queryOptions({ campusId }));
  const move = useMoveAsset(campusId, roomId);
  const [target, setTarget] = useState<string | null>(null);

  const groups = (tree.data?.buildings ?? []).flatMap((b) =>
    b.floors.map((f) => ({
      key: f.id,
      label: `${b.name} · ${f.name}`,
      rooms: f.rooms.filter((r) => r.id !== roomId),
    })),
  );
  const roomLabels = Object.fromEntries(groups.flatMap((g) => g.rooms.map((r) => [r.id, `${r.number} · ${r.name}`])));

  async function submit() {
    if (!target) return;
    await move.mutateAsync({ assetId: asset.id, roomId: target });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move asset</DialogTitle>
          <DialogDescription>
            {asset.assetType.name}
            {asset.quantity > 1 ? ` ×${asset.quantity}` : ""} keeps its rating and notes. You can also drag a card onto a room
            in the tree.
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
            <Label htmlFor="m-room">Room</Label>
            <Select value={target} onValueChange={setTarget} items={roomLabels}>
              <SelectTrigger id="m-room" className="w-full">
                <SelectValue placeholder={tree.isPending ? "Loading…" : "Choose a room"} />
              </SelectTrigger>
              <SelectContent>
                {groups
                  .filter((g) => g.rooms.length > 0)
                  .map((g) => (
                    <SelectGroup key={g.key}>
                      <SelectLabel>{g.label}</SelectLabel>
                      {g.rooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          <span className="tabular-nums">{r.number}</span>
                          <span className="text-muted-foreground">{r.name}</span>
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
