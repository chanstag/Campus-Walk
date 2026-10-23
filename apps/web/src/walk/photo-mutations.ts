import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resizeImage } from "@/lib/resize-image";
import { useTRPC, useTRPCClient } from "@/trpc";

const UPLOADABLE = ["image/jpeg", "image/png", "image/webp"] as const;
type Uploadable = (typeof UPLOADABLE)[number];

/**
 * Upload picked files to an asset, one after another: downscale, ask the API for a signed PUT
 * URL, PUT the bytes straight to the blob store, then confirm so the row is recorded.
 */
export function useUploadPhotos(assetId: string) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const blob = await resizeImage(file);
        if (!UPLOADABLE.includes(blob.type as Uploadable)) {
          throw new Error(`${file.name}: unsupported image type ${blob.type || "(unknown)"}`);
        }
        const contentType = blob.type as Uploadable;
        const { key, uploadUrl } = await client.assetPhoto.createUpload.mutate({ assetId, contentType, sizeBytes: blob.size });
        const res = await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "content-type": contentType } });
        if (!res.ok) throw new Error(`${file.name}: upload failed (${res.status})`);
        await client.assetPhoto.confirm.mutate({ assetId, key });
        await qc.invalidateQueries(trpc.assetPhoto.list.queryFilter({ assetId }));
      }
    },
  });
}

export function useRemovePhoto(assetId: string) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  return useMutation(
    trpc.assetPhoto.remove.mutationOptions({
      onSettled: () => qc.invalidateQueries(trpc.assetPhoto.list.queryFilter({ assetId })),
    }),
  );
}
