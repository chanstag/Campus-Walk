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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { decimalOrNull } from "@/lib/number";
import { Field, wholeOrNull } from "@/walk/form";
import { useCreateCampus, useUpdateCampus } from "./mutations";
import type { Campus, District } from "./types";

type Form = {
  districtId: string;
  name: string;
  campusType: string;
  address: string;
  yearOpened: string;
  siteAcres: string;
};

function fromCampus(districtId: string, c?: Campus): Form {
  return {
    districtId: c?.districtId ?? districtId,
    name: c?.name ?? "",
    campusType: c?.campusType ?? "",
    address: c?.address ?? "",
    yearOpened: c?.yearOpened == null ? "" : String(c.yearOpened),
    // numeric(8, 2) arrives as "14.50"; drop trailing zeros for editing.
    siteAcres: c?.siteAcres == null ? "" : String(Number(c.siteAcres)),
  };
}

/** Create a campus in `districtId`, or edit one (including moving it to another district). */
export function CampusDialog({
  open,
  onOpenChange,
  districts,
  districtId,
  campus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  districts: District[];
  districtId: string;
  campus?: Campus;
}) {
  const create = useCreateCampus();
  const update = useUpdateCampus();
  const [form, setForm] = useState<Form>(() => fromCampus(districtId, campus));
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const editing = !!campus;
  const yearOpened = wholeOrNull(form.yearOpened);
  const siteAcres = decimalOrNull(form.siteAcres);
  const yearValid = yearOpened === null || (yearOpened >= 1800 && yearOpened <= 2100);
  const acresValid = siteAcres === null || (!Number.isNaN(siteAcres) && siteAcres <= 999999.99);
  const valid = form.name.trim() !== "" && yearValid && acresValid;
  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;
  const districtName = districts.find((d) => d.id === form.districtId)?.name;

  async function submit() {
    const fields = { name: form.name, campusType: form.campusType, address: form.address, yearOpened, siteAcres };
    try {
      if (campus) await update.mutateAsync({ campusId: campus.id, districtId: form.districtId, ...fields });
      else await create.mutateAsync({ districtId: form.districtId, ...fields });
    } catch {
      return; // shown inline from the mutation's error; the dialog stays open
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit campus" : "Add campus"}</DialogTitle>
          <DialogDescription>
            {editing ? "Change what this campus is, or move it to another district." : `New campus in ${districtName}. Add its buildings from the walk screen.`}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !pending) void submit();
          }}
        >
          {editing && (
            <Field label="District" htmlFor="c-district">
              <Select
                value={form.districtId}
                onValueChange={(v) => typeof v === "string" && set("districtId")(v)}
                items={Object.fromEntries(districts.map((d) => [d.id, d.name]))}
              >
                <SelectTrigger id="c-district" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {districts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Name" htmlFor="c-name">
            <Input id="c-name" required autoFocus value={form.name} onChange={(e) => set("name")(e.target.value)} />
          </Field>
          <Field label="Type" htmlFor="c-type">
            <Input id="c-type" placeholder="Elementary, Middle, High…" value={form.campusType} onChange={(e) => set("campusType")(e.target.value)} />
          </Field>
          <Field label="Address" htmlFor="c-address">
            <Input id="c-address" value={form.address} onChange={(e) => set("address")(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Year opened" htmlFor="c-year">
              <Input id="c-year" type="number" min={1800} max={2100} inputMode="numeric" value={form.yearOpened} onChange={(e) => set("yearOpened")(e.target.value)} />
            </Field>
            <Field label="Site area (acres)" htmlFor="c-acres">
              <Input id="c-acres" type="number" min={0} step={0.01} inputMode="decimal" value={form.siteAcres} onChange={(e) => set("siteAcres")(e.target.value)} />
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
