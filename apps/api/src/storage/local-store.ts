// Local-disk blob store. Files live under STORAGE_DIR at their key; the Fastify /files route
// (routes.ts) serves and accepts them when the URL's signature checks out.
import { createReadStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { contentTypeOfKey, photoKeyAssetId, type BlobStore, type PhotoContentType } from "./blob-store.js";
import { sign, verify, type SignedRequest } from "./sign.js";

const GET_TTL_SECONDS = 60 * 60;
const PUT_TTL_SECONDS = 5 * 60;

export class LocalBlobStore implements BlobStore {
  constructor(
    private readonly root: string,
    private readonly secret: Buffer,
  ) {}

  async uploadUrl(key: string, contentType: PhotoContentType) {
    return this.url({ method: "PUT", key, exp: expiresIn(PUT_TTL_SECONDS), contentType });
  }

  async downloadUrl(key: string) {
    return this.url({ method: "GET", key, exp: expiresIn(GET_TTL_SECONDS) });
  }

  async stat(key: string) {
    const contentType = contentTypeOfKey(key);
    try {
      const file = await stat(this.path(key));
      return file.isFile() && contentType ? { size: file.size, contentType } : null;
    } catch {
      return null;
    }
  }

  async delete(keys: string[]) {
    await Promise.all(keys.map((key) => rm(this.path(key), { force: true })));
  }

  /** Used by the /files route once `verify` passes. Writes via a temp file so readers never see half a photo. */
  async write(key: string, body: Buffer) {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    await writeFile(tmp, body);
    await rename(tmp, target);
  }

  read(key: string) {
    return createReadStream(this.path(key));
  }

  verify(req: SignedRequest, signature: string) {
    return photoKeyAssetId(req.key) !== null && verify(this.secret, req, signature);
  }

  private url(req: SignedRequest) {
    const params = new URLSearchParams({ exp: String(req.exp), sig: sign(this.secret, req) });
    return `/files/${req.key}?${params}`;
  }

  /** Only keys we issue are ever joined onto the root, so `..` can never escape it. */
  private path(key: string) {
    if (photoKeyAssetId(key) === null) throw new Error(`Not a blob key: ${key}`);
    return join(this.root, key);
  }
}

function expiresIn(seconds: number) {
  return Math.floor(Date.now() / 1000) + seconds;
}
