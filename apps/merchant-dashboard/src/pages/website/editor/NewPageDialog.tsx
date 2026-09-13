import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import type { CreateWebsitePagePayload, WebsitePage } from "@store-builder/api-client";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { useCommon, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";

type PageType = WebsitePage["pageType"];

/** The backend's pageType enum, minus nothing — all seven are selectable. */
const PAGE_TYPE_ORDER: PageType[] = [
  "custom",
  "static",
  "product",
  "collection",
  "blog_post",
  "cart",
  "home",
];

const PAGE_TYPE_LABELS: Record<Locale, Record<PageType, string>> = {
  en: {
    custom: "Custom",
    static: "Static (About, Contact…)",
    product: "Product",
    collection: "Collection",
    blog_post: "Blog post",
    cart: "Cart",
    home: "Home",
  },
  ar: {
    custom: "مخصّصة",
    static: "ثابتة (من نحن، تواصل معنا…)",
    product: "منتج",
    collection: "مجموعة",
    blog_post: "مقال مدوّنة",
    cart: "سلة التسوق",
    home: "الرئيسية",
  },
};

const STRINGS = {
  en: {
    title: "New page",
    description: "Adds an empty page to this site. You can add blocks to it right away.",
    creating: "Creating…",
    createPage: "Create page",
    pageTitle: "Title",
    pageTitleHint: "Shown in the editor's page switcher.",
    path: "Path",
    pathInvalid: "Use a path like /about — letters, numbers and dashes.",
    pathHint: "The URL this page lives at, e.g. /about.",
    pageType: "Page type",
  },
  ar: {
    title: "صفحة جديدة",
    description: "تُضيف صفحة فارغة إلى هذا الموقع، ويمكنك إضافة الأقسام إليها فورًا.",
    creating: "جارٍ الإنشاء…",
    createPage: "إنشاء الصفحة",
    pageTitle: "العنوان",
    pageTitleHint: "يظهر في شريط تبديل الصفحات داخل المحرّر.",
    path: "المسار",
    pathInvalid: "استخدم مسارًا مثل ‎/about‎ — أحرف لاتينية وأرقام وشرطات فقط.",
    pathHint: "رابط الصفحة (URL)، مثل ‎/about‎.",
    pageType: "نوع الصفحة",
  },
} satisfies Messages;

/** "Our Story" -> "/our-story". Leading slash, lowercase, no double dashes. */
function slugifyPath(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `/${slug}` : "";
}

export function NewPageDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  /** Throw to keep the dialog open with the error shown inline. */
  onCreate: (payload: CreateWebsitePagePayload) => Promise<void>;
}) {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const typeLabels = PAGE_TYPE_LABELS[locale];

  const [title, setTitle] = useState("");
  const [path, setPath] = useState("");
  // Once the merchant edits the path themselves, stop overwriting it from the title.
  const [pathTouched, setPathTouched] = useState(false);
  const [pageType, setPageType] = useState<PageType>("custom");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function reset() {
    setTitle("");
    setPath("");
    setPathTouched(false);
    setPageType("custom");
    setError(null);
    setFieldErrors({});
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  const effectivePath = pathTouched ? path : slugifyPath(title);
  const pathValid = /^\/[a-z0-9\-/]*$/i.test(effectivePath);
  const canSubmit = title.trim().length > 0 && effectivePath.length > 0 && pathValid && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await onCreate({ title: title.trim(), path: effectivePath, pageType });
      reset();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={t.title}
      description={t.description}
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={busy}>
            {c.cancel}
          </Button>
          <Button onClick={(e) => void submit(e)} disabled={!canSubmit}>
            {busy ? t.creating : t.createPage}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <TextField
          label={t.pageTitle}
          required
          autoFocus
          dir="auto"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={fieldErrors.title}
          hint={t.pageTitleHint}
        />

        <TextField
          label={t.path}
          required
          dir="ltr"
          placeholder="/about"
          value={effectivePath}
          onChange={(e) => {
            setPathTouched(true);
            setPath(e.target.value);
          }}
          error={fieldErrors.path ?? (effectivePath && !pathValid ? t.pathInvalid : undefined)}
          hint={t.pathHint}
        />

        <Field label={t.pageType} error={fieldErrors.pageType}>
          {({ id, ...aria }) => (
            <Select
              id={id}
              {...aria}
              value={pageType}
              onChange={(e) => setPageType(e.target.value as PageType)}
            >
              {PAGE_TYPE_ORDER.map((value) => (
                <option key={value} value={value}>
                  {typeLabels[value]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {/* Lets Enter submit the form without a visible duplicate button. */}
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden />
      </form>
    </Modal>
  );
}
