import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Icons } from "@/components/icons";
import { CONDITION_OPTIONS } from "@/lib/condition";
import { useTRPC } from "@/trpc";
import { useCreateAsset, useUpdateAsset } from "./mutations";
import type { AssetWithType } from "./types";

type Form = {
  assetTypeId: string;
  quantity: string;
  condition: string; // "" = not rated
  notes: string;
  assetTag: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  installYear: string;
};

function fromAsset(a?: AssetWithType): Form {
  return {
    assetTypeId: a?.assetTypeId ?? "",
    quantity: String(a?.quantity ?? 1),
    condition: a?.condition == null ? "" : String(a.condition),
    notes: a?.notes ?? "",
    assetTag: a?.assetTag ?? "",
    manufacturer: a?.manufacturer ?? "",
    model: a?.model ?? "",
    serialNumber: a?.serialNumber ?? "",
    installYear: a?.installYear == null ? "" : String(a.installYear),
  };
}

const NONE = "__none__";

/** Create (no `asset`) or edit an asset in a room. Condition is only set here on create; edits use the card picker. */
export function AssetDialog({
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
  asset?: AssetWithType;
}) {
  const trpc = useTRPC();
  const types = useQuery(trpc.assetType.list.queryOptions());
  const create = useCreateAsset(campusId, roomId);
  const update = useUpdateAsset(campusId, roomId);
  const [form, setForm] = useState<Form>(() => fromAsset(asset));
  const [detailsOpen, setDetailsOpen] = useState(() => !!(asset?.assetTag || asset?.manufacturer || asset?.serialNumber));
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const editing = !!asset;
  const quantity = Number.parseInt(form.quantity, 10);
  const valid = form.assetTypeId !== "" && Number.isInteger(quantity) && quantity >= 1;
  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  const typeLabels = Object.fromEntries((types.data ?? []).map((t) => [t.id, `${t.name} · ${t.category}`]));
  const conditionLabels = { [NONE]: "Not rated", ...Object.fromEntries(CONDITION_OPTIONS.map((o) => [String(o.value), o.label])) };

  async function submit() {
    const fields = {
      assetTypeId: form.assetTypeId,
      quantity,
      assetTag: form.assetTag,
      manufacturer: form.manufacturer,
      model: form.model,
      serialNumber: form.serialNumber,
      installYear: form.installYear === "" ? null : Number.parseInt(form.installYear, 10),
      notes: form.notes,
    };
    if (editing) await update.mutateAsync({ assetId: asset.id, ...fields });
    else await create.mutateAsync({ roomId, condition: form.condition === "" ? null : Number(form.condition), ...fields });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit asset" : "Add asset"}</DialogTitle>
          <DialogDescription>
            {editing ? "Change what this record describes. Use the card to change its rating." : "Record something in this room."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !pending) void submit();
          }}
        >
          <Field label="Type" htmlFor="a-type">
            <Select value={form.assetTypeId || null} onValueChange={(v) => set("assetTypeId")(v ?? "")} items={typeLabels}>
              <SelectTrigger id="a-type" className="w-full">
                <SelectValue placeholder={types.isPending ? "Loading…" : "Choose a type"} />
              </SelectTrigger>
              <SelectContent>
                {(types.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} <span className="text-muted-foreground">· {t.category}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantity" htmlFor="a-qty">
              <Input id="a-qty" type="number" min={1} inputMode="numeric" value={form.quantity} onChange={(e) => set("quantity")(e.target.value)} />
            </Field>
            {!editing && (
              <Field label="Condition" htmlFor="a-cond">
                <Select value={form.condition || NONE} onValueChange={(v) => set("condition")(v === NONE || v == null ? "" : v)} items={conditionLabels}>
                  <SelectTrigger id="a-cond" className="w-full">
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
              </Field>
            )}
          </div>

          <Field label="Notes" htmlFor="a-notes">
            <Textarea id="a-notes" rows={2} placeholder="Observations…" value={form.notes} onChange={(e) => set("notes")(e.target.value)} />
          </Field>

          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger render={<Button type="button" variant="ghost" size="sm" className="-ml-2" />}>
              <Icons.ui.chevronRight className="transition-transform data-[panel-open]:rotate-90" />
              Details (tag, make, model, serial, year)
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <Field label="Asset tag" htmlFor="a-tag">
                  <Input id="a-tag" value={form.assetTag} onChange={(e) => set("assetTag")(e.target.value)} />
                </Field>
                <Field label="Install year" htmlFor="a-year">
                  <Input id="a-year" type="number" min={1800} max={2100} inputMode="numeric" value={form.installYear} onChange={(e) => set("installYear")(e.target.value)} />
                </Field>
                <Field label="Manufacturer" htmlFor="a-mfr">
                  <Input id="a-mfr" value={form.manufacturer} onChange={(e) => set("manufacturer")(e.target.value)} />
                </Field>
                <Field label="Model" htmlFor="a-model">
                  <Input id="a-model" value={form.model} onChange={(e) => set("model")(e.target.value)} />
                </Field>
                <Field label="Serial number" htmlFor="a-serial" className="col-span-2">
                  <Input id="a-serial" value={form.serialNumber} onChange={(e) => set("serialNumber")(e.target.value)} />
                </Field>
              </div>
            </CollapsibleContent>
          </Collapsible>

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

function Field({ label, htmlFor, className, children }: { label: string; htmlFor: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className ? `grid gap-2 ${className}` : "grid gap-2"}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
