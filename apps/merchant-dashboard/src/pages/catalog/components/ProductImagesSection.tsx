import { useEffect, useRef, useState, type ReactNode } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { Alert } from "@store-builder/ui";
import type { ProductMedia } from "@store-builder/api-client";
import { IconUpload } from "@/components/icons";
import { SaveBar } from "@/components/SaveBar";
import { useToast } from "@/components/Toast";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { MAX_IMAGE_BYTES } from "@/lib/media";
import { pluralOf } from "@/lib/plural";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DropZone } from "../media/DropZone";
import { MEDIA_STRINGS } from "../media/mediaStrings";
import { PhotoGrid } from "../media/PhotoGrid";
import { SectionFrame } from "../media/SectionFrame";
import { useFileDrop } from "../media/useFileDrop";
import { FINE_POINTER_QUERY, useMediaQuery } from "../media/useMediaQuery";
import { usePhotoUploads } from "../media/usePhotoUploads";
import { useProductGroup } from "../product/groupContext";
import { SectionSaveBar } from "../product/saveQueue";
import { useProductCardFrame } from "./ProductPageCard";

/**
 * Two modes:
 *  - "edit": self-contained — keeps its own draft and PATCHes the product's whole
 *    media array on Save. The save affordance is the shared SaveBar, shown while
 *    the draft differs from what is saved.
 *  - "create": fully controlled by the parent (the New Product form). It just uploads
 *    files and reports the media array up via onChange; the parent sends it in the
 *    single create payload. `error` shows the parent's "image required" message.
 */
type Props = (
  | {
      mode: "edit";
      productId: string;
      media: ProductMedia[];
      /** Media this section doesn't show (the product's video), saved back alongside the pictures. */
      keep?: ProductMedia[];
      onChanged: () => void;
      error?: undefined;
      onUploadingChange?: undefined;
    }
  | {
      mode: "create";
      value: ProductMedia[];
      onChange: (media: ProductMedia[]) => void;
      error?: string;
      onUploadingChange?: (count: number) => void;
    }
) & {
  /** Without the card and its heading — for a caller that draws both itself. */
  embedded?: boolean;
};

const photoKey = (media: ProductMedia) => media.path || media.url;

/**
 * The product's photos: a grid to rearrange by dragging (the first photo is
 * the main one), files dropped anywhere on the section or chosen from «ارفع
 * صور», each upload its own tile, and a removal that can be undone.
 *
 * Nothing about saving changed. Reordering, adding and removing only change
 * the local list; in edit mode the whole list (plus the video kept aside) is
 * sent on Save, in create mode the parent form sends it with the product.
 *
 * Where it sits decides its frame (`SectionFrame`): a card on its own, a part
 * of the «الصور والفيديو» group on the product page. On that page the save bar
 * is the page's one bar (`SectionSaveBar`), so two unsaved sections never draw
 * two bars over each other; anywhere else it is a plain `SaveBar` under the card.
 */
export function ProductImagesSection(props: Props) {
  const t = useT(MEDIA_STRINGS);
  const errorMessage = useErrorMessage();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const finePointer = useMediaQuery(FINE_POINTER_QUERY, false);
  const group = useProductGroup();
  const frame = useProductCardFrame();
  const embedded = props.embedded === true;
  /** Inside the product page: it frames the section and keeps the one save bar. */
  const inPage = !embedded && (group !== null || frame !== "card");

  // Edit mode keeps a local draft synced from the saved prop; create mode is
  // fully controlled, so `items` is read straight from props.value.
  const savedMedia = props.mode === "edit" ? props.media : [];
  const [editItems, setEditItems] = useState<ProductMedia[]>(savedMedia);
  const savedJson = props.mode === "edit" ? JSON.stringify(savedMedia) : "";
  useEffect(() => {
    if (props.mode === "edit") setEditItems(savedMedia);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedJson]);

  const [saving, setSaving] = useState(false);

  const items = props.mode === "create" ? props.value : editItems;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  function commit(next: ProductMedia[]) {
    // Two uploads can land in one tick: the second must build on the first, not on the last render.
    itemsRef.current = next;
    if (props.mode === "create") props.onChange(next);
    else setEditItems(next);
  }
  // Uploads and the Undo toast outlive the render that started them.
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const uploads = usePhotoUploads({
    workspaceId,
    onUploaded: (media) => commitRef.current([...itemsRef.current, ...media]),
  });

  // Let the parent (create flow) disable "Create product" while uploads run.
  useEffect(() => {
    if (props.mode === "create") props.onUploadingChange?.(uploads.busy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploads.busy]);

  const drop = useFileDrop(uploads.add, saving);

  function move(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    commit(arrayMove(items, from, to));
  }

  /** Gone from the list at once; «تراجع» puts it back where it was. Nothing reaches the server until Save. */
  function remove(index: number) {
    const removed = items[index];
    if (!removed) return;
    commit(items.filter((_, i) => i !== index));
    toast.undo(t.removedToast, () => {
      const now = itemsRef.current;
      if (now.some((media) => photoKey(media) === photoKey(removed))) return;
      const next = [...now];
      next.splice(Math.min(index, next.length), 0, removed);
      commitRef.current(next);
    });
  }

  const dirty = props.mode === "edit" && JSON.stringify(editItems) !== savedJson;
  // Leaving with an unsaved order or new photos asks first, where a guard is mounted (no guard: nothing happens).
  // On the product page the page's own bar reports it, so it is not said twice.
  useReportDirty(dirty && !inPage);

  async function save() {
    if (props.mode !== "edit") return;
    setSaving(true);
    try {
      await apiClient.updateProduct(workspaceId, props.productId, { media: [...editItems, ...(props.keep ?? [])] });
      toast.success(t.savedToast);
      props.onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const failures = uploads.pending.filter((upload) => upload.phase === "error");

  const badge: ReactNode =
    props.mode === "create" || items.length > 0 ? (
      <>
        {props.mode === "create" && (
          <span className="text-danger" aria-hidden>
            *
          </span>
        )}
        {items.length > 0 && <span className="ms-1.5 text-sm font-normal text-ink-soft">{pluralOf(t, "photos", items.length)}</span>}
      </>
    ) : undefined;

  const section = (
    <SectionFrame
      title={t.title}
      badge={badge}
      // How to rearrange, once there is something to rearrange. A finger presses and holds; a mouse just drags.
      description={items.length > 1 ? (finePointer ? t.hint : t.hintTouch) : undefined}
      embedded={embedded}
    >
      <DropZone drop={drop} label={t.dropHere} icon={IconUpload} slot="product-photos">
        {props.mode === "create" && props.error && (
          <Alert variant="danger" className="mb-4">
            {props.error}
          </Alert>
        )}

        <PhotoGrid
          items={items}
          pending={uploads.pending}
          onMove={move}
          onRemove={remove}
          onAddFiles={uploads.add}
          onRetry={uploads.retry}
          onDismiss={uploads.dismiss}
          locked={saving}
        />

        {failures.length > 0 && (
          <ul role="alert" className="mt-3 space-y-1 text-sm text-danger">
            {failures.map((upload) => (
              <li key={upload.id}>
                <bdi className="font-medium">{upload.name}</bdi>: {upload.error}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs leading-5 text-ink-soft">{fmt(t.formats, { mb: MAX_IMAGE_BYTES / (1024 * 1024) })}</p>
      </DropZone>

      {props.mode === "edit" && inPage && (
        <SectionSaveBar
          section={t.title}
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onDiscard={() => setEditItems(savedMedia)}
          disabled={uploads.busy > 0}
        />
      )}
    </SectionFrame>
  );

  // On the product page the section is the group's own child: nothing may wrap it, or it loses its place among the parts.
  if (props.mode !== "edit" || inPage) return section;

  return (
    // The save bar sits beside the card, not inside it: a card clips its content, and a clipped box cannot stick.
    <div className="space-y-3">
      {section}
      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={() => void save()}
        onDiscard={() => setEditItems(savedMedia)}
        message={t.unsaved}
        saveLabel={t.save}
        disabled={uploads.busy > 0}
      />
    </div>
  );
}
