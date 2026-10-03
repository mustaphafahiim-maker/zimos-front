import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { ImagePlus, MousePointerClick, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Alert, Button, Card } from "@store-builder/ui";
import {
  ApiError,
  shoppableImagesCreate,
  shoppableImagesDelete,
  shoppableImagesList,
  shoppableImagesUpdate,
  type Product,
  type ShoppableHotspot,
  type ShoppableImage,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { useT, fmt, useCommon, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Field, TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Shoppable images",
    description: "One picture, several products: put a point on each product and customers tap it to buy.",
    add: "New image",
    emptyTitle: "No shoppable images yet",
    emptyDescription: "Upload a picture of your products in use — a room, an outfit, a table — and mark each product on it.",
    points: "{count} products",
    hidden: "Hidden",
    copyLink: "Copy link",
    copyId: "Copy ID for the page builder",
    edit: "Edit",
    createTitle: "New shoppable image",
    editTitle: "Edit shoppable image",
    name: "Title",
    image: "Picture",
    imageUrl: "Picture link",
    upload: "Upload a picture",
    uploading: "Uploading…",
    or: "or paste a link",
    canvasHint: "Click the picture where a product is, then choose the product.",
    noImage: "Add a picture first.",
    point: "Point {n}",
    product: "Product",
    chooseProduct: "Choose a product",
    removePoint: "Remove point {n}",
    maxPoints: "A picture holds up to 20 points.",
    needProduct: "Choose a product for every point, or remove the point.",
    shown: "Shown in the store",
    saved: "Shoppable image saved.",
    deleteTitle: "Delete “{name}”?",
    deleteDescription: "Its public page stops working, and any page block that uses it disappears.",
    deleting: "Deleting…",
    deleted: "Shoppable image deleted.",
    productMissing: "A point is linked to a product that no longer exists.",
  },
  ar: {
    title: "الصور التفاعلية",
    description: "صورة واحدة وعدة منتجات: ضع نقطة على كل منتج والعميل يضغط عليها ليشتري.",
    add: "صورة جديدة",
    emptyTitle: "لا توجد صور تفاعلية بعد",
    emptyDescription: "ارفع صورة لمنتجاتك وهي مستخدمة — غرفة، طقم ملابس، سفرة — وحدّد كل منتج عليها.",
    points: "{count} منتجات",
    hidden: "مخفية",
    copyLink: "نسخ الرابط",
    copyId: "نسخ المعرّف لمحرر الصفحات",
    edit: "تعديل",
    createTitle: "صورة تفاعلية جديدة",
    editTitle: "تعديل الصورة التفاعلية",
    name: "العنوان",
    image: "الصورة",
    imageUrl: "رابط الصورة",
    upload: "رفع صورة",
    uploading: "جارٍ الرفع…",
    or: "أو الصق رابطًا",
    canvasHint: "اضغط على مكان المنتج في الصورة ثم اختر المنتج.",
    noImage: "أضف صورة أولًا.",
    point: "نقطة {n}",
    product: "المنتج",
    chooseProduct: "اختر منتجًا",
    removePoint: "حذف النقطة {n}",
    maxPoints: "الصورة تحمل 20 نقطة كحد أقصى.",
    needProduct: "اختر منتجًا لكل نقطة أو احذف النقطة.",
    shown: "ظاهرة في المتجر",
    saved: "تم حفظ الصورة التفاعلية.",
    deleteTitle: "حذف «{name}»؟",
    deleteDescription: "تتوقف صفحتها العامة عن العمل، ويختفي أي عنصر في الصفحات يستخدمها.",
    deleting: "جارٍ الحذف…",
    deleted: "تم حذف الصورة التفاعلية.",
    productMissing: "توجد نقطة مربوطة بمنتج لم يعد موجودًا.",
  },
} satisfies Messages;

const MAX_POINTS = 20;

/** Shoppable images (SPEC §7.9): pictures with product hotspots. */
export function ShoppableImagesPage() {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => shoppableImagesList(apiClient, workspaceId), [workspaceId]);
  const images = list.data ?? [];
  const [editing, setEditing] = useState<ShoppableImage | "new" | null>(null);
  const [removing, setRemoving] = useState<ShoppableImage | null>(null);

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden />
            {t.add}
          </Button>
        }
      />
      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        {images.length === 0 ? (
          <EmptyState
            icon={<MousePointerClick className="size-6" aria-hidden />}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={<Button onClick={() => setEditing("new")}>{t.add}</Button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => (
              <Card key={image.id} className="gap-0 overflow-hidden p-0">
                <div dir="ltr" className="relative aspect-[4/3] bg-paper">
                  <img src={image.imageUrl} alt="" className="size-full object-cover" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 dir="auto" className="min-w-0 truncate text-sm font-semibold text-ink">
                      {image.title}
                    </h2>
                    {!image.isActive && <StatusBadge value="hidden" tone="neutral" text={t.hidden} />}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">{fmt(t.points, { count: image.hotspots.length })}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <CopyButton value={`${STOREFRONT_URL}/store/${workspaceId}/looks/${image.slug}`} label={t.copyLink} />
                    <CopyButton value={image.id} label={t.copyId} />
                    <Button size="sm" variant="outline" className="min-h-9" onClick={() => setEditing(image)}>
                      <Pencil className="size-4" aria-hidden />
                      {t.edit}
                    </Button>
                    <Button size="sm" variant="outline" className="min-h-9" aria-label={common.delete} onClick={() => setRemoving(image)}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </DataState>

      <ShoppableEditor
        image={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void list.refresh({ silent: true });
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title={removing ? fmt(t.deleteTitle, { name: removing.title }) : ""}
        description={t.deleteDescription}
        confirmLabel={common.delete}
        busyLabel={t.deleting}
        cancelLabel={common.cancel}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await shoppableImagesDelete(apiClient, workspaceId, removing.id);
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          toast.success(t.deleted);
          setRemoving(null);
          void list.refresh({ silent: true });
        }}
      />
    </div>
  );
}

interface DraftPoint {
  x: number;
  y: number;
  productId: string;
}

function ShoppableEditor({ image, onClose, onSaved }: { image: ShoppableImage | "new" | null; onClose: () => void; onSaved: () => void }) {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const existing = image && image !== "new" ? image : null;
  const open = image !== null;

  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [points, setPoints] = useState<DraftPoint[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(existing?.title ?? "");
    setImageUrl(existing?.imageUrl ?? "");
    setPoints(existing?.hotspots ?? []);
    setIsActive(existing?.isActive ?? true);
    setError(null);
    let cancelled = false;
    apiClient
      .listProducts(workspaceId, { limit: 200 })
      .then((result) => {
        if (!cancelled) setProducts(result.products);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id, workspaceId]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const media = await apiClient.uploadMedia(workspaceId, file);
      setImageUrl(media.url);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function addPoint(e: MouseEvent<HTMLDivElement>) {
    if (points.length >= MAX_POINTS) {
      setError(t.maxPoints);
      return;
    }
    // The picture is laid out left-to-right in every language, so x is measured from its left edge.
    const box = e.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - box.left) / box.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - box.top) / box.height) * 100));
    setPoints((prev) => [...prev, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, productId: "" }]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (points.some((p) => !p.productId)) {
      setError(t.needProduct);
      return;
    }
    setBusy(true);
    setError(null);
    const hotspots: ShoppableHotspot[] = points.map((p) => ({ x: p.x, y: p.y, productId: p.productId }));
    try {
      if (existing) await shoppableImagesUpdate(apiClient, workspaceId, existing.id, { title: title.trim(), imageUrl: imageUrl.trim(), hotspots, isActive });
      else await shoppableImagesCreate(apiClient, workspaceId, { title: title.trim(), imageUrl: imageUrl.trim(), hotspots, isActive });
      toast.success(t.saved);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError && err.code === "PRODUCT_NOT_FOUND" ? t.productMissing : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? t.editTitle : t.createTitle} className="max-w-3xl">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <TextField label={t.name} required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />

        <div className="flex flex-wrap items-end gap-3">
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
          <Button type="button" variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
            <Upload className="size-4" aria-hidden />
            {uploading ? t.uploading : t.upload}
          </Button>
          <TextField
            className="min-w-56 flex-1"
            label={t.imageUrl}
            hint={t.or}
            type="url"
            dir="ltr"
            required
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            maxLength={1000}
          />
        </div>

        {imageUrl.trim() ? (
          <div>
            <p className="mb-2 text-xs text-ink-soft">{t.canvasHint}</p>
            <div dir="ltr" onClick={addPoint} className="relative cursor-crosshair overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper">
              <img src={imageUrl} alt={t.image} className="block h-auto w-full select-none" draggable={false} />
              {points.map((point, index) => (
                <span
                  key={index}
                  className="pointer-events-none absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-primary text-xs font-bold text-white shadow-lg"
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                >
                  {index + 1}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line text-sm text-ink-soft">
            <ImagePlus className="size-6" aria-hidden />
            {t.noImage}
          </div>
        )}

        {points.length > 0 && (
          <ul className="space-y-2">
            {points.map((point, index) => (
              <li key={index} className="flex items-end gap-2">
                <span className="mb-2 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{index + 1}</span>
                <Field className="min-w-0 flex-1" label={`${fmt(t.point, { n: index + 1 })} — ${t.product}`} labelHidden>
                  {(props) => (
                    <Select
                      {...props}
                      value={point.productId}
                      onChange={(e) => setPoints((prev) => prev.map((p, i) => (i === index ? { ...p, productId: e.target.value } : p)))}
                    >
                      <option value="">{t.chooseProduct}</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10"
                  aria-label={fmt(t.removePoint, { n: index + 1 })}
                  onClick={() => setPoints((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          {t.shown}
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {common.cancel}
          </Button>
          <Button type="submit" disabled={busy || uploading || !title.trim() || !imageUrl.trim()}>
            {busy ? common.saving : common.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
