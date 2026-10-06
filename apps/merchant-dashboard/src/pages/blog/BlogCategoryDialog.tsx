import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "@store-builder/ui";
import {
  apiErrorCode,
  apiFieldProblems,
  blogCategoryCreate,
  blogCategoryUpdate,
  type BlogCategoryRef,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Textarea } from "@/components/Textarea";

const STRINGS = {
  en: {
    newTitle: "New category",
    editTitle: "Edit category",
    name: "Name",
    namePlaceholder: "e.g. Care tips",
    slug: "Link",
    slugHint: "Empty: made from the name. Arabic letters are fine.",
    description: "Description",
    descriptionHint: "Optional. Shown at the top of the category's page.",
    position: "Order",
    positionHint: "Smaller numbers show first.",
    cancel: "Cancel",
    add: "Add category",
    save: "Save",
    saving: "Saving…",
    nameRequired: "Write a name.",
    tooLong: "This is too long.",
    slugTaken: "Another category already uses this link. Change it or leave it empty.",
    checkField: "Check this.",
  },
  ar: {
    newTitle: "تصنيف جديد",
    editTitle: "تعديل التصنيف",
    name: "الاسم",
    namePlaceholder: "مثلًا: نصايح العناية",
    slug: "اللينك",
    slugHint: "سيبه فاضي وهنعمله من الاسم. الحروف العربي تنفع.",
    description: "الوصف",
    descriptionHint: "اختياري. بيظهر في أول صفحة التصنيف.",
    position: "الترتيب",
    positionHint: "الأرقام الأصغر بتظهر الأول.",
    cancel: "إلغاء",
    add: "ضيف التصنيف",
    save: "احفظ",
    saving: "بنحفظ…",
    nameRequired: "اكتب اسم.",
    tooLong: "الكلام ده طويل زيادة.",
    slugTaken: "في تصنيف تاني واخد اللينك ده. غيّره أو سيبه فاضي.",
    checkField: "راجع الخانة دي.",
  },
} satisfies Messages;

type FieldKey = "name" | "slug" | "description" | "position";

/**
 * Add or edit one blog category (handoff 190): name, link, description and
 * order. Used by Blog → Categories and by the post editor's «تصنيف جديد».
 */
export function BlogCategoryDialog({
  open,
  category,
  nextPosition = 0,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Null for a new category. */
  category: BlogCategoryRef | null;
  nextPosition?: number;
  onClose: () => void;
  onSaved: (category: BlogCategoryRef) => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [position, setPosition] = useState("0");
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setSlug(category?.slug ?? "");
    setDescription(category?.description ?? "");
    setPosition(String(category?.position ?? nextPosition));
    setErrors({});
    setFormError(null);
  }, [open, category, nextPosition]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    // Opened from the post editor: the submit must not reach anything around the dialog.
    e.stopPropagation();
    if (saving) return;
    const found: Partial<Record<FieldKey, string>> = {};
    if (!name.trim()) found.name = t.nameRequired;
    else if (name.trim().length > 120) found.name = t.tooLong;
    if (slug.trim().length > 140) found.slug = t.tooLong;
    if (description.trim().length > 500) found.description = t.tooLong;
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const order = Math.min(10000, Math.max(0, Number.parseInt(position, 10) || 0));
    setSaving(true);
    setFormError(null);
    try {
      const body = { name: name.trim(), slug: slug.trim(), description: description.trim() || null, position: order };
      const saved = category
        ? await blogCategoryUpdate(apiClient, workspaceId, category.id, body)
        : await blogCategoryCreate(apiClient, workspaceId, body);
      onSaved(saved);
    } catch (err) {
      if (apiErrorCode(err) === "SLUG_TAKEN") {
        setErrors({ slug: t.slugTaken });
      } else {
        const problems = apiFieldProblems(err);
        const byField: Partial<Record<FieldKey, string>> = {};
        for (const p of problems) {
          const key = p.field.split(".")[0] as FieldKey;
          if (key === "name" || key === "slug" || key === "description" || key === "position") byField[key] = t.checkField;
        }
        if (Object.keys(byField).length > 0) setErrors(byField);
        else setFormError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? t.editTitle : t.newTitle}
      footer={
        <>
          <Button type="button" variant="outline" className="min-h-11 sm:min-h-10" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form="blog-category-form" className="min-h-11 sm:min-h-10" disabled={saving}>
            {saving ? t.saving : category ? t.save : t.add}
          </Button>
        </>
      }
    >
      <form id="blog-category-form" className="space-y-4" onSubmit={(e) => void submit(e)} noValidate>
        {formError && (
          <p role="alert" className="rounded-[var(--radius)] bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}
        <Field label={t.name} required error={errors.name}>
          {({ id, ...aria }) => (
            <Input id={id} {...aria} dir="auto" maxLength={120} autoFocus placeholder={t.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>
        <Field label={t.slug} hint={t.slugHint} error={errors.slug}>
          {({ id, ...aria }) => <Input id={id} {...aria} dir="auto" maxLength={140} value={slug} onChange={(e) => setSlug(e.target.value)} />}
        </Field>
        <Field label={t.description} hint={t.descriptionHint} error={errors.description}>
          {({ id, ...aria }) => (
            <Textarea id={id} {...aria} dir="auto" rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
          )}
        </Field>
        <Field label={t.position} hint={t.positionHint} error={errors.position}>
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              type="number"
              inputMode="numeric"
              dir="ltr"
              min={0}
              max={10000}
              step={1}
              className="max-w-32"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
