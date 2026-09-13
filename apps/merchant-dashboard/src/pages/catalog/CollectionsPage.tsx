import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Layers } from "lucide-react";
import { Alert, Button, Card, CardContent, Spinner } from "@store-builder/ui";
import type { CollectionSummary, CreateCollectionPayload } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { TextField, Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Collections",
    backProducts: "Products",
    description: "Storefront groupings. Add or remove products from a product's own page.",
    newCollection: "New collection",
    editCollection: "Edit collection",
    emptyTitle: "No collections yet",
    emptyDescription: "Create your first collection to group products on your storefront.",
    name: "Name",
    namePlaceholder: "Summer",
    descriptionLabel: "Description",
    descriptionPlaceholder: "Warm-weather picks",
    savedToast: "Collection saved.",
    createdToast: "\"{name}\" created.",
    deletedToast: "\"{name}\" deleted. Products themselves are untouched.",
    noProducts: "No products in this collection yet.",
    showProducts: "Show products",
    hideProducts: "Hide products",
    rename: "Rename",
    confirmTitle: "Delete \"{name}\"?",
    confirmDescription:
      "A collection is only a storefront grouping — deleting it is permanent, but the products in it are not affected.",
    confirmLabel: "Delete collection",
  },
  ar: {
    title: "المجموعات",
    backProducts: "المنتجات",
    description: "تجميعات المنتجات في متجرك. أضف المنتجات أو أزلها من صفحة كل منتج.",
    newCollection: "مجموعة جديدة",
    editCollection: "تعديل المجموعة",
    emptyTitle: "لا توجد مجموعات بعد",
    emptyDescription: "أنشئ أول مجموعة لتنظيم منتجاتك في المتجر.",
    name: "الاسم",
    namePlaceholder: "الصيف",
    descriptionLabel: "الوصف",
    descriptionPlaceholder: "اختيارات مناسبة للجو الحار",
    savedToast: "تم حفظ المجموعة.",
    createdToast: "تم إنشاء \"{name}\".",
    deletedToast: "تم حذف \"{name}\". المنتجات نفسها لم تتأثر.",
    noProducts: "لا توجد منتجات في هذه المجموعة بعد.",
    showProducts: "عرض المنتجات",
    hideProducts: "إخفاء المنتجات",
    rename: "إعادة تسمية",
    confirmTitle: "حذف \"{name}\"؟",
    confirmDescription:
      "المجموعة مجرد تجميع للعرض في المتجر — حذفها نهائي، لكن المنتجات التي بداخلها لن تتأثر.",
    confirmLabel: "حذف المجموعة",
  },
} satisfies Messages;

function CollectionForm({
  collection,
  onDone,
  onCancel,
}: {
  collection?: CollectionSummary;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT(STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    const payload: CreateCollectionPayload = {
      name: name.trim(),
      description: description.trim(),
    };
    try {
      if (collection) {
        await apiClient.updateCollection(workspaceId, collection.id, payload);
        toast.success(t.savedToast);
      } else {
        await apiClient.createCollection(workspaceId, payload);
        toast.success(fmt(t.createdToast, { name: payload.name }));
      }
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}
      <TextField
        label={t.name}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        placeholder={t.namePlaceholder}
      />
      <Field label={t.descriptionLabel} error={fieldErrors.description}>
        {({ id }) => (
          <Textarea
            id={id}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.descriptionPlaceholder}
          />
        )}
      </Field>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button type="submit" disabled={saving || name.trim().length === 0}>
          {saving ? c.saving : collection ? c.save : c.create}
        </Button>
      </div>
    </form>
  );
}

function CollectionProducts({ collectionId }: { collectionId: string }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const detail = useAsync(
    () => apiClient.getCollection(workspaceId, collectionId),
    [workspaceId, collectionId]
  );

  if (detail.loading) return <Spinner className="size-4" />;
  if (detail.error) return <p className="text-sm text-danger">{getErrorMessage(detail.error)}</p>;

  const products = detail.data?.products ?? [];
  if (products.length === 0) return <p className="text-sm text-ink-soft">{t.noProducts}</p>;

  return (
    <ul className="space-y-1.5 text-sm">
      {products.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-2">
          <Link to={`/catalog/${p.id}`} className="text-primary hover:underline">
            {p.name}
          </Link>
          <StatusBadge value={p.status} />
        </li>
      ))}
    </ul>
  );
}

export function CollectionsPage() {
  const t = useT(STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const list = useAsync(() => apiClient.listCollections(workspaceId), [workspaceId]);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CollectionSummary | null>(null);
  const [deleting, setDeleting] = useState<CollectionSummary | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const reload = () => list.refresh({ silent: true });

  async function confirmDelete() {
    if (!deleting) return;
    await apiClient.deleteCollection(workspaceId, deleting.id);
    toast.success(fmt(t.deletedToast, { name: deleting.name }));
    setDeleting(null);
    reload();
  }

  const collections = list.data ?? [];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={t.title}
        back={{ to: "/catalog", label: t.backProducts }}
        description={t.description}
        actions={<Button onClick={() => setCreating(true)}>{t.newCollection}</Button>}
      />

      <DataState loading={list.loading} error={list.error} onRetry={() => list.refresh()}>
        {collections.length === 0 ? (
          <EmptyState
            icon={<Layers aria-hidden />}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={<Button onClick={() => setCreating(true)}>{t.newCollection}</Button>}
          />
        ) : (
          <div className="space-y-3">
            {collections.map((col) => (
              <Card key={col.id} className="rounded-2xl">
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{col.name}</p>
                      <p className="text-xs text-ink-soft">
                        <bdi dir="ltr">{col.slug}</bdi>
                      </p>
                      {col.description && <p className="mt-1 text-sm text-ink-soft">{col.description}</p>}
                      <button
                        onClick={() => setExpanded((cur) => (cur === col.id ? null : col.id))}
                        aria-expanded={expanded === col.id}
                        className="mt-2 cursor-pointer text-xs text-primary hover:underline"
                      >
                        {expanded === col.id ? t.hideProducts : t.showProducts}
                      </button>
                      {expanded === col.id && (
                        <div className="mt-2 border-s-2 border-line ps-3">
                          <CollectionProducts collectionId={col.id} />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(col)}>
                        {t.rename}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger hover:bg-danger-soft"
                        onClick={() => setDeleting(col)}
                      >
                        {c.delete}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DataState>

      <Modal open={creating} onClose={() => setCreating(false)} title={t.newCollection}>
        <CollectionForm
          onCancel={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            reload();
          }}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={t.editCollection}>
        {editing && (
          <CollectionForm
            collection={editing}
            onCancel={() => setEditing(null)}
            onDone={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={fmt(t.confirmTitle, { name: deleting?.name ?? "" })}
        description={t.confirmDescription}
        confirmLabel={t.confirmLabel}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
