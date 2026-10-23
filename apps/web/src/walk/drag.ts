/**
 * Native HTML5 drag-and-drop of an asset card onto a room in the campus tree. A custom MIME type
 * keeps unrelated drags (files, text) from lighting up drop targets. During dragover the browser
 * only exposes the types, not the data, so targets decide on `isAssetDrag` and read the id on drop.
 */
export const ASSET_DRAG_TYPE = "application/x-campus-walk-asset";

type DragEvent = { dataTransfer: DataTransfer | null };

/** Opacity of the copy that follows the cursor. */
const PREVIEW_OPACITY = "0.7";

/**
 * Hides the browser's own drag preview. Browsers snapshot that preview without honouring CSS
 * opacity (Chrome on Linux draws it fully opaque), so we draw our own copy instead. Created at
 * module load so the image has decoded before the first drag.
 */
const EMPTY_IMAGE = typeof Image === "undefined" ? null : Object.assign(new Image(), {
  src: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
});

/**
 * Starts an asset drag. With `card` and the pointer position, a translucent copy of the card
 * follows the cursor, held at the point where it was grabbed, until the drag ends.
 */
export function startAssetDrag(
  e: DragEvent & { clientX?: number; clientY?: number },
  assetId: string,
  card?: HTMLElement,
) {
  if (!e.dataTransfer) return;
  e.dataTransfer.setData(ASSET_DRAG_TYPE, assetId);
  e.dataTransfer.effectAllowed = "move";
  if (card && EMPTY_IMAGE && e.clientX != null && e.clientY != null) {
    e.dataTransfer.setDragImage(EMPTY_IMAGE, 0, 0);
    followCursor(card, e.clientX, e.clientY);
  }
}

/**
 * A fixed-position copy of the card that tracks `dragover` on the document (the source's own
 * `drag` event reports 0,0 in Firefox). pointer-events: none keeps drop targets under it working.
 */
function followCursor(card: HTMLElement, x: number, y: number) {
  const rect = card.getBoundingClientRect();
  const dx = x - rect.left;
  const dy = y - rect.top;
  const copy = card.cloneNode(true) as HTMLElement;
  Object.assign(copy.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    opacity: PREVIEW_OPACITY,
    pointerEvents: "none",
    zIndex: "100",
    transform: `translate(${rect.left}px, ${rect.top}px)`,
  });
  document.body.appendChild(copy);

  const move = (ev: globalThis.DragEvent) => {
    copy.style.transform = `translate(${ev.clientX - dx}px, ${ev.clientY - dy}px)`;
  };
  const end = () => {
    copy.remove();
    document.removeEventListener("dragover", move);
    document.removeEventListener("dragend", end, true);
    document.removeEventListener("drop", end, true);
  };
  document.addEventListener("dragover", move);
  // dragend bubbles from the card, which a successful move may already have unmounted, so also
  // listen for drop; both in the capture phase so nothing can stop them first.
  document.addEventListener("dragend", end, true);
  document.addEventListener("drop", end, true);
}

export function isAssetDrag(e: DragEvent) {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes(ASSET_DRAG_TYPE);
}

/** The dragged asset's id, or null for any other drag. Only readable in a drop handler. */
export function droppedAssetId(e: DragEvent) {
  return e.dataTransfer?.getData(ASSET_DRAG_TYPE) || null;
}
