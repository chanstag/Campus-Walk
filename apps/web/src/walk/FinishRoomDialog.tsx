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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Icons } from "@/components/icons";
import { CONDITION_OPTIONS } from "@/lib/condition";
import { useFinishRoom } from "./mutations";
import type { Room } from "./types";

const NONE = "__none__";

/** Marks the room walked. Unrated assets produce a warning, not a block. */
export function FinishRoomDialog({
  open,
  onOpenChange,
  campusId,
  room,
  unratedCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campusId: string;
  room: Room;
  unratedCount: number;
}) {
  const finish = useFinishRoom(campusId, room.id);
  const [condition, setCondition] = useState(room.condition == null ? NONE : String(room.condition));
  const [notes, setNotes] = useState(room.notes ?? "");
  const finished = room.assessedAt != null;
  const labels = { [NONE]: "Not rated", ...Object.fromEntries(CONDITION_OPTIONS.map((o) => [String(o.value), o.label])) };

  async function submit() {
    await finish.mutateAsync({ roomId: room.id, condition: condition === NONE ? null : Number(condition), notes });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{finished ? "Update room" : "Finish room"}</DialogTitle>
          <DialogDescription>
            {room.number} · {room.name}. Rate the room itself and leave any notes about the space.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {unratedCount > 0 && (
            <p className="flex items-start gap-2 rounded-md border border-condition-fair/40 bg-condition-fair/10 p-3 text-sm text-condition-fair">
              <Icons.condition.fair className="mt-0.5 size-4 shrink-0" />
              <span>
                {unratedCount} {unratedCount === 1 ? "asset is" : "assets are"} not rated yet. You can finish anyway and come back.
              </span>
            </p>
          )}
          <div className="grid gap-2">
            <Label htmlFor="r-cond">Room condition</Label>
            <Select value={condition} onValueChange={(v) => setCondition(v ?? NONE)} items={labels}>
              <SelectTrigger id="r-cond" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not rated</SelectItem>
                {CONDITION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.value} · {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="r-notes">Notes</Label>
            <Textarea id="r-notes" rows={3} placeholder="Anything about the room as a whole…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {finish.error && <p className="text-sm text-destructive">{finish.error.message}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={finish.isPending}>
            {finished ? "Save" : unratedCount > 0 ? "Finish anyway" : "Finish room"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
