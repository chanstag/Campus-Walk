import { useQuery } from "@tanstack/react-query";
import { Icons, type LucideIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { ConditionBadge } from "@/lib/condition";
import { useTRPC } from "@/trpc";
import type { AssetWithType, Room } from "./types";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  Furniture: Icons.assetCategory.furniture,
  Technology: Icons.assetCategory.technology,
  Equipment: Icons.assetCategory.other,
  "Building System": Icons.assetCategory.hvac,
};

/** Main area: the selected room's header and its assets as cards, grouped by category. */
export function AssetGrid({ room }: { room: Room }) {
  const trpc = useTRPC();
  const assets = useQuery(trpc.asset.byRoom.queryOptions({ roomId: room.id }));

  return (
    <div className="flex flex-col gap-6">
      <RoomHeader room={room} />
      {assets.isPending && (
        <Grid>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </Grid>
      )}
      {assets.error && <p className="text-sm text-destructive">Could not load assets: {assets.error.message}</p>}
      {assets.data && assets.data.length === 0 && <Empty icon={Icons.asset}>No assets recorded in this room.</Empty>}
      {assets.data && assets.data.length > 0 && <AssetSections assets={assets.data} />}
    </div>
  );
}

function RoomHeader({ room }: { room: Room }) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{room.roomType ?? "Room"}</p>
          <h2 className="text-xl font-semibold">
            <span className="tabular-nums">{room.number}</span>
            {room.name !== room.number && <span className="text-muted-foreground"> · {room.name}</span>}
          </h2>
        </div>
        <ConditionBadge rating={room.condition} />
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
function AssetSections({ assets }: { assets: AssetWithType[] }) {
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
                <AssetCard key={a.id} asset={a} />
              ))}
            </Grid>
          </section>
        );
      })}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">{children}</div>;
}

function AssetCard({ asset }: { asset: AssetWithType }) {
  const detail = [asset.manufacturer, asset.model].filter(Boolean).join(" ");
  return (
    <article className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">
          {asset.assetType.name}
          {asset.quantity > 1 && <span className="text-muted-foreground"> ×{asset.quantity}</span>}
        </p>
        <ConditionBadge rating={asset.condition} className="shrink-0" />
      </div>
      <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        {asset.assetTag && <span className="font-mono">{asset.assetTag}</span>}
        {detail && <span>{detail}</span>}
        {asset.installYear != null && <span>Installed {asset.installYear}</span>}
      </p>
      {asset.notes && <p className="text-sm">{asset.notes}</p>}
    </article>
  );
}

export function Empty({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
      <Icon className="size-8" />
      <p className="text-sm">{children}</p>
    </div>
  );
}
