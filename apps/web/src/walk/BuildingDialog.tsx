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
import { useCreateBuilding, useUpdateBuilding } from "./mutations";
import type { Building } from "./types";

type Form = {
  name: string;
  buildingType: string;
  yearBuilt: string;
  grossSf: string;
};

function fromBuilding(b?: Building): Form {
  return {
    name: b?.name ?? "",
    buildingType: b?.buildingType ?? "",
    yearBuilt: b?.yearBuilt == null ? "" : String(b.yearBuilt),
    grossSf: b?.grossSf == null ? "" : String(b.grossSf),
  };
}

/** Create (needs `campus`; the API adds a First Floor) or edit a building's descriptive fields. */
export function BuildingDialog({
  open,
  onOpenChange,
  campusId,
  ...target
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campusId: string;
} & (
  | {
      campusName: string;
      onCreated?: (created: { building: { id: string }; floor: { id: string } }) => void;
      building?: never;
    }
  | { building: Building; campusName?: never; onCreated?: never }
)) {
  const { building, campusName, onCreated } = target;
  const create = useCreateBuilding(campusId);
  const update = useUpdateBuilding(campusId);
  const [form, setForm] = useState<Form>(() => fromBuilding(building));
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const editing = !!building;
  const yearBuilt = wholeOrNull(form.yearBuilt);
  const grossSf = wholeOrNull(form.grossSf);
  const yearValid = yearBuilt === null || (yearBuilt >= 1800 && yearBuilt <= 2100);
  const valid = form.name.trim() !== "" && yearValid && !Number.isNaN(grossSf);
  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  async function submit() {
    const fields = { name: form.name, buildingType: form.buildingType, yearBuilt, grossSf };
    try {
      if (building) await update.mutateAsync({ buildingId: building.id, ...fields });
      else onCreated?.(await create.mutateAsync({ campusId, ...fields }));
    } catch {
      return; // shown inline from the mutation's error; the dialog stays open
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit building" : "Add building"}</DialogTitle>
          <DialogDescription>
            {editing ? "Change what this building is." : `New building on ${campusName}. It starts with a First Floor; add more floors after.`}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !pending) void submit();
          }}
        >
          <Field label="Name" htmlFor="b-name">
            <Input id="b-name" required autoFocus value={form.name} onChange={(e) => set("name")(e.target.value)} />
          </Field>
          <Field label="Type" htmlFor="b-type">
            <Input id="b-type" placeholder="Academic, Athletics, Portable…" value={form.buildingType} onChange={(e) => set("buildingType")(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Year built" htmlFor="b-year">
              <Input id="b-year" type="number" min={1800} max={2100} inputMode="numeric" value={form.yearBuilt} onChange={(e) => set("yearBuilt")(e.target.value)} />
            </Field>
            <Field label="Gross area (sf)" htmlFor="b-sf">
              <Input id="b-sf" type="number" min={0} inputMode="numeric" value={form.grossSf} onChange={(e) => set("grossSf")(e.target.value)} />
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
