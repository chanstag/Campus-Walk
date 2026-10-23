// Where photo bytes live. Postgres stores only the object key; URLs are signed per request.
// `LocalBlobStore` is the only driver for now; an S3/R2 driver implements the same interface
// with presigned PUT/GET URLs, so neither the schema nor the web client changes.
import { randomUUID } from "node:crypto";

export interface BlobStore {
  /** Short-lived URL the browser PUTs the bytes to, with `Content-Type: contentType`. */
  uploadUrl(key: string, contentType: PhotoContentType): Promise<string>;
  /** Short-lived URL to GET the object. */
  downloadUrl(key: string): Promise<string>;
  /** Size and type of a stored object, or null if nothing is there. */
  stat(key: string): Promise<{ size: number; contentType: PhotoContentType } | null>;
  /** Missing keys are ignored. */
  delete(keys: string[]): Promise<void>;
}

export const PHOTO_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type PhotoContentType = keyof typeof PHOTO_CONTENT_TYPES;

/** Upper bound on one photo. The web client downscales before uploading, so real ones are far smaller. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PHOTO_KEY = new RegExp(`^assets/(${UUID})/${UUID}\\.(jpg|png|webp)$`);

export function newPhotoKey(assetId: string, contentType: PhotoContentType) {
  return `assets/${assetId}/${randomUUID()}.${PHOTO_CONTENT_TYPES[contentType]}`;
}

/** The asset id a key belongs to, or null if the key is not one we would have issued. */
export function photoKeyAssetId(key: string): string | null {
  return PHOTO_KEY.exec(key)?.[1] ?? null;
}

export function contentTypeOfKey(key: string): PhotoContentType | null {
  const ext = key.slice(key.lastIndexOf(".") + 1);
  const entry = Object.entries(PHOTO_CONTENT_TYPES).find(([, e]) => e === ext);
  return (entry?.[0] as PhotoContentType | undefined) ?? null;
}
