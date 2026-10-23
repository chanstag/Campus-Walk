/**
 * Native HTML5 drag-and-drop of an asset card onto a room in the campus tree. A custom MIME type
 * keeps unrelated drags (files, text) from lighting up drop targets. During dragover the browser
 * only exposes the types, not the data, so targets decide on `isAssetDrag` and read the id on drop.
 */
export const ASSET_DRAG_TYPE = "application/x-campus-walk-asset";

type DragEvent = { dataTransfer: DataTransfer | null };

export function startAssetDrag(e: DragEvent, assetId: string) {
  if (!e.dataTransfer) return;
  e.dataTransfer.setData(ASSET_DRAG_TYPE, assetId);
  e.dataTransfer.effectAllowed = "move";
}

export function isAssetDrag(e: DragEvent) {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes(ASSET_DRAG_TYPE);
}

/** The dragged asset's id, or null for any other drag. Only readable in a drop handler. */
export function droppedAssetId(e: DragEvent) {
  return e.dataTransfer?.getData(ASSET_DRAG_TYPE) || null;
}
