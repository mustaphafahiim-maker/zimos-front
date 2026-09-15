import { useState } from "react";
import { ImageOff, Pencil, RefreshCw } from "lucide-react";
import { Alert, Button, Modal, Toggle, useAsync } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField } from "@/components/forms";
import { Status } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { adminApi, type AdminTemplate } from "@/lib/adminApi";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatNumber } from "@/lib/format";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Templates",
    description: "Store templates merchants can start from.",
    empty: "No templates yet.",
    published: "Published",
    versions: "{n} version(s) · active v{v}",
    noActive: "{n} version(s) · none active",
    usage: "Used by {n} website(s)",
    added: "Added {date}",
    uncategorized: "Uncategorized",
    editTitle: "Edit {name}",
    name: "Name",
    category: "Category",
    thumbnail: "Thumbnail URL",
    thumbnailHint: "Full https:// URL. Leave empty to remove.",
    saved: "Template updated.",
    publishedToast: "{name} is published.",
    unpublishedToast: "{name} is unpublished.",
    unpublishTitle: "Unpublish {name}?",
    unpublishDesc: "Merchants won't be able to pick it for new websites. Existing websites keep working.",
    unpublish: "Unpublish",
    nameInvalid: "Name must be at least 2 characters.",
  },
  ar: {
    title: "القوالب",
    description: "قوالب المتاجر اللي التجار يقدروا يبدأوا منها.",
    empty: "مفيش قوالب لسه.",
    published: "منشور",
    versions: "{n} إصدار · النشط v{v}",
    noActive: "{n} إصدار · مفيش نشط",
    usage: "مستخدم في {n} موقع",
    added: "اتضاف {date}",
    uncategorized: "من غير تصنيف",
    editTitle: "تعديل {name}",
    name: "الاسم",
    category: "التصنيف",
    thumbnail: "رابط الصورة المصغرة",
    thumbnailHint: "رابط كامل بـ https://. سيبه فاضي عشان تشيلها.",
    saved: "القالب اتعدّل.",
    publishedToast: "{name} اتنشر.",
    unpublishedToast: "{name} اتشال من النشر.",
    unpublishTitle: "تشيل {name} من النشر؟",
    unpublishDesc: "التجار مش هيقدروا يختاروه لمواقع جديدة. المواقع الموجودة هتفضل شغالة.",
    unpublish: "شيل من النشر",
    nameInvalid: "الاسم لازم يكون حرفين على الأقل.",
  },
};

export function TemplatesPage() {
  const t = useT(STRINGS);
  const c = useCommon();
  const toast = useToast();
  const { data, loading, error, refresh } = useAsync(() => adminApi.listTemplates(), []);
  const [editing, setEditing] = useState<AdminTemplate | null>(null);
  const [form, setForm] = useState({ name: "", category: "", thumbnailUrl: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [unpublishing, setUnpublishing] = useState<AdminTemplate | null>(null);

  const openEdit = (tpl: AdminTemplate) => {
    setForm({ name: tpl.name, category: tpl.category ?? "", thumbnailUrl: tpl.thumbnailUrl ?? "" });
    setFormError(null);
    setEditing(tpl);
  };

  const save = async () => {
    if (!editing) return;
    if (form.name.trim().length < 2) {
      setFormError(t.nameInvalid);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await adminApi.updateTemplate(editing.id, { name: form.name.trim(), category: form.category.trim() || null, thumbnailUrl: form.thumbnailUrl.trim() || null });
      toast.success(t.saved);
      setEditing(null);
      void refresh({ silent: true });
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const publish = async (tpl: AdminTemplate) => {
    try {
      await adminApi.updateTemplate(tpl.id, { isPublished: true });
      toast.success(fmt(t.publishedToast, { name: tpl.name }));
      void refresh({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw /> {c.refresh}
          </Button>
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()} empty={!!data && data.length === 0} emptyMessage={t.empty}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((tpl) => {
            const activeVersion = tpl.versions.find((v) => v.isActive);
            const usage = tpl.versions.reduce((s, v) => s + v.websites, 0);
            return (
              <article key={tpl.id} className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised shadow-[var(--shadow-card)]">
                <div className="flex aspect-[16/9] items-center justify-center bg-paper">
                  {tpl.thumbnailUrl ? (
                    <img src={tpl.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                  ) : (
                    <ImageOff className="size-8 text-ink-muted" aria-hidden />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-ink">{tpl.name}</h2>
                      <p className="text-xs text-ink-soft">{tpl.category || t.uncategorized}</p>
                    </div>
                    <Status value={tpl.isPublished ? "published" : "unpublished"} />
                  </div>
                  <p className="text-xs text-ink-soft">
                    {activeVersion ? fmt(t.versions, { n: formatNumber(tpl.versions.length), v: activeVersion.version }) : fmt(t.noActive, { n: formatNumber(tpl.versions.length) })}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {fmt(t.usage, { n: formatNumber(usage) })} · {fmt(t.added, { date: formatDate(tpl.createdAt) })}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
                    <Toggle checked={tpl.isPublished} onChange={(next) => (next ? void publish(tpl) : setUnpublishing(tpl))} label={t.published} />
                    <Button variant="outline" size="sm" onClick={() => openEdit(tpl)}>
                      <Pencil /> {c.edit}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </DataState>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={fmt(t.editTitle, { name: editing?.name ?? "" })}
        closeLabel={c.close}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              {c.cancel}
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? c.working : c.save}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <Alert variant="danger">{formError}</Alert>}
          <TextField label={t.name} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <TextField label={t.category} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} dir="ltr" />
          <TextField label={t.thumbnail} type="url" value={form.thumbnailUrl} onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))} hint={t.thumbnailHint} dir="ltr" />
        </div>
      </Modal>

      <ConfirmDialog
        open={unpublishing !== null}
        title={fmt(t.unpublishTitle, { name: unpublishing?.name ?? "" })}
        description={t.unpublishDesc}
        confirmLabel={t.unpublish}
        destructive
        onCancel={() => setUnpublishing(null)}
        onConfirm={async () => {
          if (!unpublishing) return;
          await adminApi.updateTemplate(unpublishing.id, { isPublished: false });
          toast.success(fmt(t.unpublishedToast, { name: unpublishing.name }));
          setUnpublishing(null);
          void refresh({ silent: true });
        }}
      />
    </div>
  );
}
