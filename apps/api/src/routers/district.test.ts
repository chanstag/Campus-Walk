import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_GRANTS, PERMISSION_KEYS } from "../auth/permission-catalog.js";
import { anonymousCaller, callerFor, reseed, type Caller } from "../test/db.js";

const SAMPLE_DISTRICT = "Cedar Ridge ISD";

let admin: Caller;
let field: Caller;

beforeAll(async () => {
  await reseed();
  admin = await callerFor("admin");
  field = await callerFor("field");
});

describe("district.list", () => {
  it("returns every district sorted by name, readable by field users", async () => {
    expect((await field.district.list()).map((d) => d.name)).toEqual([SAMPLE_DISTRICT]);
  });

  it("requires a session", async () => {
    await expect(anonymousCaller().district.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("district.create", () => {
  it("adds a district, trimmed, that lists without campuses", async () => {
    const created = await admin.district.create({ name: "  Austin ISD " });
    expect(created.name).toBe("Austin ISD");
    expect((await admin.district.list()).map((d) => d.name)).toEqual(["Austin ISD", SAMPLE_DISTRICT]);
  });

  it("rejects a name already in use, ignoring case, and a blank one", async () => {
    await expect(admin.district.create({ name: "cedar ridge isd" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: `${SAMPLE_DISTRICT} already exists`,
    });
    await expect(admin.district.create({ name: "  " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("is refused to field users by default", async () => {
    await expect(field.district.create({ name: "Field ISD" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Missing permission district:create",
    });
  });
});

describe("district.update", () => {
  it("renames, allowing a case change of its own name but not another district's", async () => {
    const austin = (await admin.district.list()).find((d) => d.name === "Austin ISD")!;
    await expect(admin.district.update({ districtId: austin.id, name: SAMPLE_DISTRICT })).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await admin.district.update({ districtId: austin.id, name: "AUSTIN ISD" })).name).toBe("AUSTIN ISD");
  });

  it("throws NOT_FOUND for an unknown district", async () => {
    await expect(admin.district.update({ districtId: crypto.randomUUID(), name: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is refused to field users by default", async () => {
    const [first] = await admin.district.list();
    await expect(field.district.update({ districtId: first!.id, name: "X" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("district and campus permissions", () => {
  it("default to admin and office only", () => {
    const keys = ["district:create", "district:update", "campus:create", "campus:update"];
    expect(PERMISSION_KEYS).toEqual(expect.arrayContaining(keys));
    expect(DEFAULT_GRANTS.admin).toBe("all");
    expect(DEFAULT_GRANTS.office).toEqual(expect.arrayContaining(keys));
    for (const key of keys) expect(DEFAULT_GRANTS.field, key).not.toContain(key);
  });
});
