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
import { nextFloorLevel, suggestedFloorName } from "@/lib/floor";
import { Field } from "./form";
import { useCreateFloor, useUpdateFloor } from "./mutations";
import type { Building, Floor } from "./types";

/**
 * Create (needs `building`) or edit a floor's level and name. On create the next level and its
 * name are suggested; the name follows the level until the user types their own.
 */
export function FloorDialog({
  open,
  onOpenChange,
  campusId,
  ...target
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campusId: string;
} & (
  | { building: Pick<Building, "id" | "name" | "floors">; onCreated?: (floor: { id: string }) => void; floor?: never }
  | { floor: Floor; building?: never; onCreated?: never }
)) {
  const { building, floor, onCreated } = target;
  const create = useCreateFloor(campusId);
  const update = useUpdateFloor(campusId);
  const [level, setLevel] = useState(() => String(floor?.level ?? nextFloorLevel(building!.floors.map((f) => f.level))));
  const [name, setName] = useState(() => floor?.name ?? suggestedFloorName(Number(level)));
  const [nameEdited, setNameEdited] = useState(!!floor);

  const editing = !!floor;
  const levelNumber = Number(level);
  const valid = level.trim() !== "" && Number.isInteger(levelNumber) && name.trim() !== "";
  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  function changeLevel(v: string) {
    setLevel(v);
    const n = Number(v);
    if (!nameEdited && v.trim() !== "" && Number.isInteger(n)) setName(suggestedFloorName(n));
  }

  async function submit() {
    try {
      if (floor) await update.mutateAsync({ floorId: floor.id, level: levelNumber, name });
      else if (building) onCreated?.(await create.mutateAsync({ buildingId: building.id, level: levelNumber, name }));
    } catch {
      return; // shown inline from the mutation's error; the dialog stays open
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit floor" : "Add floor"}</DialogTitle>
          <DialogDescription>
            {editing ? "Level sets the order in the tree: 0 is ground, negatives are basements." : `New floor in ${building?.name}.`}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !pending) void submit();
          }}
        >
          <div className="grid grid-cols-[6rem_1fr] gap-4">
            <Field label="Level" htmlFor="f-level">
              <Input id="f-level" type="number" inputMode="numeric" min={-10} max={200} required value={level} onChange={(e) => changeLevel(e.target.value)} />
            </Field>
            <Field label="Name" htmlFor="f-name">
              <Input
                id="f-name"
                required
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameEdited(true);
                }}
              />
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
