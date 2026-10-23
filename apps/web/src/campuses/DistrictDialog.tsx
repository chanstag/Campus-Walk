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
import { Field } from "@/walk/form";
import { useCreateDistrict, useUpdateDistrict } from "./mutations";
import type { District } from "./types";

/** Create a district, or rename one when `district` is given. */
export function DistrictDialog({
  open,
  onOpenChange,
  district,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  district?: District;
}) {
  const create = useCreateDistrict();
  const update = useUpdateDistrict();
  const [name, setName] = useState(district?.name ?? "");

  const editing = !!district;
  const valid = name.trim() !== "";
  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  async function submit() {
    try {
      if (district) await update.mutateAsync({ districtId: district.id, name });
      else await create.mutateAsync({ name });
    } catch {
      return; // shown inline from the mutation's error; the dialog stays open
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Rename district" : "Add district"}</DialogTitle>
          <DialogDescription>
            {editing ? "Change what this district is called." : "Campuses are added to a district once it exists."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !pending) void submit();
          }}
        >
          <Field label="Name" htmlFor="d-name">
            <Input id="d-name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

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
