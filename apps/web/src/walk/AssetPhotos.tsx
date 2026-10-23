import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useCan } from "@/auth/permissions";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { useTRPC } from "@/trpc";
import { useRemovePhoto, useUploadPhotos } from "./photo-mutations";

/** Signed URLs live an hour; refetch well before that so a cached <img src> never expires. */
const PHOTO_STALE_MS = 30 * 60 * 1000;

/** Thumbnail strip on an asset card, with "add photo" (camera on phones) and a full-size viewer. */
export function AssetPhotos({ assetId, label }: { assetId: string; label: string }) {
  const trpc = useTRPC();
  const photos = useQuery({ ...trpc.assetPhoto.list.queryOptions({ assetId }), staleTime: PHOTO_STALE_MS });
  const upload = useUploadPhotos(assetId);
  const { can: canUpdate } = useCan("asset", "update");
  const input = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const current = photos.data?.find((p) => p.id === viewing);

  if (!canUpdate && !photos.data?.length) return null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {photos.data?.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setViewing(p.id)}
            className="size-12 overflow-hidden rounded-md border bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={`Open photo ${i + 1} of ${label}`}
          >
            <img src={p.url} alt="" loading="lazy" draggable={false} className="size-full object-cover" />
          </button>
        ))}
        {canUpdate && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="size-12 border-dashed text-muted-foreground"
              aria-label={`Add photo of ${label}`}
              disabled={upload.isPending}
              onClick={() => input.current?.click()}
            >
              {upload.isPending ? <Icons.sync.syncing className="animate-spin" /> : <Icons.addPhoto />}
            </Button>
            <input
              ref={input}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              hidden
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                e.target.value = "";
                if (files.length) upload.mutate(files);
              }}
            />
          </>
        )}
      </div>
      {upload.error && <p className="text-xs text-destructive">{upload.error.message}</p>}
      {photos.error && <p className="text-xs text-destructive">Could not load photos: {photos.error.message}</p>}

      <Dialog open={!!current} onOpenChange={(open) => !open && setViewing(null)}>
        {current && (
          <PhotoViewer
            assetId={assetId}
            label={label}
            photo={current}
            canDelete={canUpdate}
            onDeleted={() => setViewing(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

function PhotoViewer({
  assetId,
  label,
  photo,
  canDelete,
  onDeleted,
}: {
  assetId: string;
  label: string;
  photo: { id: string; url: string; createdAt: Date };
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const remove = useRemovePhoto(assetId);
  return (
    <DialogContent className="sm:max-w-3xl">
      <DialogTitle>{label}</DialogTitle>
      <img src={photo.url} alt={`Photo of ${label}`} className="max-h-[70vh] w-full rounded-md object-contain" />
      <DialogFooter className="items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">Added {photo.createdAt.toLocaleString()}</p>
        {canDelete && (
          <Button
            variant="destructive"
            size="sm"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ photoId: photo.id }, { onSuccess: onDeleted })}
          >
            <Icons.ui.delete />
            Delete photo
          </Button>
        )}
      </DialogFooter>
      {remove.error && <p className="text-xs text-destructive">{remove.error.message}</p>}
    </DialogContent>
  );
}
