import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { blobStore } from "../storage/index.js";
import { anonymousCaller, callerFor, findRoomByNumber, reseed, type Caller } from "../test/db.js";

let field: Caller;
let assetId: string;
let otherAssetId: string;

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

/** Stands in for the browser's PUT to the signed URL. */
async function upload(caller: Caller, forAsset = assetId) {
  const { key, uploadUrl } = await caller.assetPhoto.createUpload({ assetId: forAsset, contentType: "image/jpeg", sizeBytes: JPEG.length });
  await blobStore.write(key, JPEG);
  return { key, uploadUrl };
}

beforeAll(async () => {
  await reseed();
  field = await callerFor("field");
  const room = await findRoomByNumber("101");
  const assets = await field.asset.byRoom({ roomId: room.id });
  assetId = assets[0]!.id;
  otherAssetId = assets[1]!.id;
});

describe("assetPhoto upload", () => {
  it("issues a signed PUT URL for a key under the asset", async () => {
    const { key, uploadUrl } = await field.assetPhoto.createUpload({ assetId, contentType: "image/png", sizeBytes: 1000 });
    expect(key).toMatch(new RegExp(`^assets/${assetId}/[0-9a-f-]{36}\\.png$`));
    expect(uploadUrl).toMatch(new RegExp(`^/files/${key}\\?exp=\\d+&sig=`));
  });

  it("rejects oversized photos and unknown assets", async () => {
    await expect(
      field.assetPhoto.createUpload({ assetId, contentType: "image/jpeg", sizeBytes: 50 * 1024 * 1024 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      field.assetPhoto.createUpload({ assetId: randomUUID(), contentType: "image/jpeg", sizeBytes: 10 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("confirms an uploaded file and lists it with a signed URL", async () => {
    const { key } = await upload(field);
    const row = await field.assetPhoto.confirm({ assetId, key });
    expect(row).toMatchObject({ assetId, key, contentType: "image/jpeg", sizeBytes: JPEG.length });
    expect(row.uploadedBy).not.toBeNull();

    const photos = await field.assetPhoto.list({ assetId });
    expect(photos.map((p) => p.key)).toContain(key);
    expect(photos.find((p) => p.key === key)!.url).toMatch(/^\/files\/assets\/.+\?exp=\d+&sig=/);
  });

  it("refuses to confirm twice, a missing file, or another asset's key", async () => {
    const { key } = await upload(field);
    await field.assetPhoto.confirm({ assetId, key });
    await expect(field.assetPhoto.confirm({ assetId, key })).rejects.toMatchObject({ code: "CONFLICT" });

    const { key: neverUploaded } = await field.assetPhoto.createUpload({ assetId, contentType: "image/jpeg", sizeBytes: 10 });
    await expect(field.assetPhoto.confirm({ assetId, key: neverUploaded })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const { key: otherKey } = await upload(field, otherAssetId);
    await expect(field.assetPhoto.confirm({ assetId, key: otherKey })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires a session", async () => {
    await expect(anonymousCaller().assetPhoto.list({ assetId })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("assetPhoto.remove", () => {
  it("deletes the row and the file", async () => {
    const { key } = await upload(field);
    const row = await field.assetPhoto.confirm({ assetId, key });
    await field.assetPhoto.remove({ photoId: row.id });
    expect(await blobStore.stat(key)).toBeNull();
    expect((await field.assetPhoto.list({ assetId })).map((p) => p.id)).not.toContain(row.id);
    await expect(field.assetPhoto.remove({ photoId: row.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("asset.remove", () => {
  it("removes the asset's photo files too", async () => {
    const { key } = await upload(field, otherAssetId);
    await field.assetPhoto.confirm({ assetId: otherAssetId, key });
    await field.asset.remove({ assetId: otherAssetId });
    expect(await blobStore.stat(key)).toBeNull();
  });
});
