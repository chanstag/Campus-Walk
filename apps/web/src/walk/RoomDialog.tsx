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
import { Input } from "@/components/ui/input";
import { Field, wholeOrNull } from "./form";
import { useCreateRoom, useUpdateRoom } from "./mutations";
import type { Floor, Room } from "./types";

type Form = {
  number: string;
  name: string;
  roomType: string;
  areaSf: string;
  capacity: string;
};

function fromRoom(r?: Room): Form {
  return {
    number: r?.number ?? "",
    // A name that only repeats the number is left blank, so renumbering keeps them in step.
    name: r && r.name !== r.number ? r.name : "",
    roomType: r?.roomType ?? "",
    areaSf: r?.areaSf == null ? "" : String(r.areaSf),
    capacity: r?.capacity == null ? "" : String(r.capacity),
  };
}

/** Create (no `room`, needs `floor`) or edit a room's descriptive fields. Walk status is set by "Finish room". */
export function RoomDialog({
  open,
  onOpenChange,
  campusId,
  ...target
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campusId: string;
} & (
  | { floor: Pick<Floor, "id" | "name">; onCreated?: (room: { id: string; floorId: string }) => void; room?: never }
  | { room: Room; floor?: never; onCreated?: never }
)) {
  const { floor, room, onCreated } = target;
  const create = useCreateRoom(campusId);
  const update = useUpdateRoom(campusId);
  const [form, setForm] = useState<Form>(() => fromRoom(room));
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const editing = !!room;
  const areaSf = wholeOrNull(form.areaSf);
  const capacity = wholeOrNull(form.capacity);
  const valid = form.number.trim() !== "" && !Number.isNaN(areaSf) && !Number.isNaN(capacity);
  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  async function submit() {
    const fields = { number: form.number, name: form.name, roomType: form.roomType, areaSf, capacity };
    try {
      if (room) await update.mutateAsync({ roomId: room.id, ...fields });
      else if (floor) onCreated?.(await create.mutateAsync({ floorId: floor.id, ...fields }));
    } catch {
      return; // shown inline from the mutation's error; the dialog stays open
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit room" : "Add room"}</DialogTitle>
          <DialogDescription>
            {editing ? "Change what this room is. Its rating and notes are set when you finish the room." : `New room on ${floor?.name}.`}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !pending) void submit();
          }}
        >
          <div className="grid grid-cols-[8rem_1fr] gap-4">
            <Field label="Number" htmlFor="r-number">
              <Input id="r-number" required autoFocus value={form.number} onChange={(e) => set("number")(e.target.value)} />
            </Field>
            <Field label="Name" htmlFor="r-name">
              <Input id="r-name" placeholder="Same as number" value={form.name} onChange={(e) => set("name")(e.target.value)} />
            </Field>
          </div>
          <Field label="Type" htmlFor="r-type">
            <Input id="r-type" placeholder="Classroom, Office, Restroom…" value={form.roomType} onChange={(e) => set("roomType")(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Area (sf)" htmlFor="r-area">
              <Input id="r-area" type="number" min={0} inputMode="numeric" value={form.areaSf} onChange={(e) => set("areaSf")(e.target.value)} />
            </Field>
            <Field label="Capacity" htmlFor="r-cap">
              <Input id="r-cap" type="number" min={0} inputMode="numeric" value={form.capacity} onChange={(e) => set("capacity")(e.target.value)} />
            </Field>
          </div>

          {error && <p className="text-sm text-destructive">{error.message}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || pending}>
              {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
