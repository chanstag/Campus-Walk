// Loads the sample dataset from sample_data/campus_walk_sample_data into the
// database. Destructive: truncates every table first so the result is exactly
// the sample. Sample ids (C-100, B-101, R-101-101, A-00001) are mapped to
// generated UUIDs in memory and are not stored.
//
//   pnpm --filter api db:seed            # or `pnpm db:seed` from the repo root
//   SEED_DIR=/path/to/csvs pnpm --filter api db:seed

import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { db } from "./client.js";
import { asset, assetType, building, campus, district, floor, room } from "./schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const SEED_DIR =
  process.env.SEED_DIR ?? resolve(here, "../../../../sample_data/campus_walk_sample_data");

// ---------- csv ----------

/** Minimal RFC 4180 reader: quoted fields, escaped quotes, CRLF. Returns rows as objects keyed by header. */
function readCsv(name: string): Record<string, string>[] {
  const text = readFileSync(resolve(SEED_DIR, name), "utf8");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  if (!header) return [];
  return body
    .filter((r) => r.some((v) => v !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const str = (v: string) => (v === "" ? null : v);
const int = (v: string) => (v === "" ? null : Number.parseInt(v, 10));
const date = (v: string) => (v === "" ? null : new Date(`${v}T00:00:00Z`));
const bool = (v: string) => v.toLowerCase() === "true";

/** Maps a sample id to a generated uuid, asserting it was registered. */
class IdMap {
  private m = new Map<string, string>();
  constructor(private label: string) {}
  add(sampleId: string) {
    const id = crypto.randomUUID();
    this.m.set(sampleId, id);
    return id;
  }
  get(sampleId: string) {
    const id = this.m.get(sampleId);
    if (!id) throw new Error(`${this.label}: unknown sample id ${sampleId}`);
    return id;
  }
  maybe(sampleId: string) {
    return sampleId === "" ? null : this.get(sampleId);
  }
}

async function insertChunked<T>(table: Parameters<typeof db.insert>[0], rows: T[], size = 200) {
  for (let i = 0; i < rows.length; i += size) {
    await db.insert(table).values(rows.slice(i, i + size) as never);
  }
}

// ---------- main ----------

async function main() {
  console.log(`[db:seed] reading ${SEED_DIR}`);
  const campuses = readCsv("campuses.csv");
  const buildings = readCsv("buildings.csv");
  const floors = readCsv("floors.csv");
  const rooms = readCsv("rooms.csv");
  const assetTypes = readCsv("asset_types.csv");
  const assets = readCsv("assets.csv");

  console.log("[db:seed] truncating");
  await db.execute(
    sql`truncate table asset, asset_type, room, floor, building, campus, district restart identity cascade`,
  );

  // District is implied by campuses.csv (one id, no name there); the JSON names it.
  const districts = new IdMap("district");
  const districtIds = [...new Set(campuses.map((c) => c.district_id!))];
  await db.insert(district).values(
    districtIds.map((d) => ({ id: districts.add(d), name: d === "D-01" ? "Cedar Ridge ISD" : d })),
  );

  const campusIds = new IdMap("campus");
  await db.insert(campus).values(
    campuses.map((c) => ({
      id: campusIds.add(c.campus_id!),
      districtId: districts.get(c.district_id!),
      name: c.name!,
      campusType: str(c.campus_type!),
      address: str(c.address!),
      yearOpened: int(c.year_opened!),
      siteAcres: str(c.site_acres!),
    })),
  );

  const buildingIds = new IdMap("building");
  await db.insert(building).values(
    buildings.map((b) => ({
      id: buildingIds.add(b.building_id!),
      campusId: campusIds.get(b.campus_id!),
      name: b.name!,
      buildingType: str(b.building_type!),
      yearBuilt: int(b.year_built!),
      grossSf: int(b.gross_sf!),
    })),
  );

  const floorIds = new IdMap("floor");
  await db.insert(floor).values(
    floors.map((f) => ({
      id: floorIds.add(f.floor_id!),
      buildingId: buildingIds.get(f.building_id!),
      level: int(f.level!)!,
      name: f.name!,
    })),
  );

  const roomIds = new IdMap("room");
  await insertChunked(
    room,
    rooms.map((r) => ({
      id: roomIds.add(r.room_id!),
      floorId: floorIds.get(r.floor_id!),
      number: r.room_number!,
      name: r.room_name!,
      roomType: str(r.room_type!),
      areaSf: int(r.area_sf!),
      capacity: int(r.capacity!),
      // Sample has no room-level condition or notes; walked_on is the assessment date.
      assessedAt: date(r.walked_on!),
    })),
  );

  const typeIds = new IdMap("asset_type");
  await db.insert(assetType).values(
    assetTypes.map((t) => ({
      id: typeIds.add(t.asset_type_id!),
      category: t.category!,
      name: t.name!,
      usefulLifeYears: int(t.useful_life_years!),
      typicallyBuildingLevel: bool(t.typically_building_level!),
    })),
  );

  await insertChunked(
    asset,
    assets.map((a) => ({
      assetTypeId: typeIds.get(a.asset_type_id!),
      buildingId: buildingIds.get(a.building_id!),
      roomId: roomIds.maybe(a.room_id!),
      assetTag: str(a.asset_tag!),
      quantity: int(a.quantity!) ?? 1,
      manufacturer: str(a.manufacturer!),
      model: str(a.model!),
      serialNumber: str(a.serial_number!),
      installYear: int(a.install_year!),
      condition: int(a.condition_rating!),
      notes: str(a.condition_notes!),
      assessedAt: date(a.last_assessed_on!),
      assessedBy: str(a.assessed_by!),
    })),
  );

  const counts = await db.execute<{ t: string; n: number }>(sql`
    select 'district' t, count(*)::int n from district
    union all select 'campus', count(*)::int from campus
    union all select 'building', count(*)::int from building
    union all select 'floor', count(*)::int from floor
    union all select 'room', count(*)::int from room
    union all select 'asset_type', count(*)::int from asset_type
    union all select 'asset', count(*)::int from asset
  `);
  for (const { t, n } of counts.rows) console.log(`[db:seed] ${t.padEnd(10)} ${n}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
