import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { assetPhoto } from "../db/schema.js";
import { MAX_PHOTO_BYTES, PHOTO_CONTENT_TYPES, blobStore, newPhotoKey, photoKeyAssetId, type PhotoContentType } from "../storage/index.js";
import { authorizedProcedure, router } from "../trpc.js";
import { requireAsset } from "./asset.js";

const contentType = z.enum(Object.keys(PHOTO_CONTENT_TYPES) as [PhotoContentType, ...PhotoContentType[]]);

/**
 * Photos on an asset. Uploading is three steps, shaped like S3 presigned uploads so another blob
 * store slots in unchanged: `createUpload` returns a signed PUT URL, the browser PUTs the bytes,
 * then `confirm` records the row. An upload that is never confirmed leaves an orphan file only.
 */
export const assetPhotoRouter = router({
  /** Oldest first, each with a signed URL valid for an hour. */
  list: authorizedProcedure("asset", "read").input(z.object({ assetId: z.uuid() })).query(async ({ ctx, input }) => {
    const rows = await ctx.db.query.assetPhoto.findMany({
      where: eq(assetPhoto.assetId, input.assetId),
      orderBy: asc(assetPhoto.createdAt),
    });
    return Promise.all(rows.map(async (row) => ({ ...row, url: await blobStore.downloadUrl(row.key) })));
  }),

  createUpload: authorizedProcedure("asset", "update")
    .input(z.object({ assetId: z.uuid(), contentType, sizeBytes: z.number().int().positive().max(MAX_PHOTO_BYTES) }))
    .mutation(async ({ ctx, input }) => {
      await requireAsset(ctx.db, input.assetId);
      const key = newPhotoKey(input.assetId, input.contentType);
      return { key, uploadUrl: await blobStore.uploadUrl(key, input.contentType) };
    }),

  confirm: authorizedProcedure("asset", "update")
    .input(z.object({ assetId: z.uuid(), key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireAsset(ctx.db, input.assetId);
      if (photoKeyAssetId(input.key) !== input.assetId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Upload key does not belong to this asset" });
      }
      const stats = await blobStore.stat(input.key);
      if (!stats) throw new TRPCError({ code: "BAD_REQUEST", message: "Nothing was uploaded for this key" });
      const [row] = await ctx.db
        .insert(assetPhoto)
        .values({ assetId: input.assetId, key: input.key, contentType: stats.contentType, sizeBytes: stats.size, uploadedBy: ctx.user.id })
        .onConflictDoNothing({ target: assetPhoto.key })
        .returning();
      if (!row) throw new TRPCError({ code: "CONFLICT", message: "This upload was already confirmed" });
      return row;
    }),

  remove: authorizedProcedure("asset", "update").input(z.object({ photoId: z.uuid() })).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db.delete(assetPhoto).where(eq(assetPhoto.id, input.photoId)).returning();
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Photo not found" });
    await blobStore.delete([row.key]);
    return { id: row.id, assetId: row.assetId };
  }),
});
