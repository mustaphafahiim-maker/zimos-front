import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Button, Input, Label } from "@store-builder/ui";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

/** Whether the dialog is for a website page or a funnel step (its SEO hints differ). */
type PageScriptKind = "page" | "step";

const STRINGS = {
  en: {
    title: "Page settings — {name}",
    tabs: "Page settings sections",
    seo: "SEO",
    scripts: "Scripts",
    seoTitle: "Title in search results",
    seoDescription: "Description",
    image: "Sharing image (link)",
    imageHint: "Shown when the link is shared. 1200×630 works best.",
    noindex: "Hide this page from search engines",
    count: "{n} / {max}",
    saveSeo: "Save SEO",
    seoSaved: "SEO saved.",
    head: "Code in <head>",
    headHint: "Tracking tools, site verification tags.",
    body: "Code before </body>",
    bodyHint: "Chat widgets, scripts that need the page loaded.",
    active: "Run this code",
    rules: "Runs only on your store's own domain — never in previews or on payment pages. It goes live as soon as you save, not with Publish.",
    saveScripts: "Save scripts",
    scriptsSaved: "Scripts saved.",
    needsSave: "Save the funnel first, then add this step's scripts.",
    noPermission: "Only the owner or someone who can publish the store can see and change page scripts.",
    loading: "Loading…",
    close: "Close",
    open: "Page settings",
    hintPage: "Search engines see this once you publish the website.",
    hintStep: "Saved with the funnel (Save), and live once you publish it.",
  },
  ar: {
    title: "إعدادات الصفحة — {name}",
    tabs: "أقسام إعدادات الصفحة",
    seo: "SEO",
    scripts: "السكربتات",
    seoTitle: "العنوان في نتائج البحث",
    seoDescription: "الوصف",
    image: "صورة المشاركة (رابط)",
    imageHint: "بتظهر لما اللينك يتشارك. الأفضل 1200×630.",
    noindex: "إخفاء الصفحة دي من محركات البحث",
    count: "{n} / {max}",
    saveSeo: "حفظ SEO",
    seoSaved: "تم حفظ SEO.",
    head: "كود في <head>",
    headHint: "أدوات التتبع وأكواد توثيق الموقع.",
    body: "كود قبل </body>",
    bodyHint: "أدوات الشات والسكربتات اللي محتاجة الصفحة تكون اتحمّلت.",
    active: "شغّل الكود ده",
    rules: "بيشتغل على دومين متجرك بس — مش في المعاينة ولا في صفحات الدفع. بيبقى شغال أول ما تحفظ، مش مع النشر.",
    saveScripts: "حفظ السكربتات",
    scriptsSaved: "تم حفظ السكربتات.",
    needsSave: "احفظ الفانل الأول، وبعدين ضيف سكربتات الخطوة دي.",
    noPermission: "المالك أو اللي يقدر ينشر المتجر بس يقدر يشوف ويعدّل سكربتات الصفحة.",
    loading: "جارٍ التحميل…",
    close: "إغلاق",
    open: "إعدادات الصفحة",
    hintPage: "محركات البحث هتشوف ده بعد ما تنشر الموقع.",
    hintStep: "بيتحفظ مع الفانل (حفظ)، ويبقى شغال بعد ما تنشره.",
  },
} satisfies Messages;


/** The builder toolbar's "Page settings" button and its dialog. */
export function PageSettingsButton({
  name,
  seo,
  onSaveSeo,
  scripts,
  compact = false,
}: {
  name: string;
  seo: Record<string, unknown>;
  onSaveSeo: (seo: Record<string, unknown>) => Promise<void> | void;
  scripts: { kind: PageScriptKind; id: string | null };
  /** Icon only (the website editor's toolbar). */
  compact?: boolean;
}) {
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon-sm" : "default"}
        aria-label={t.open}
        title={t.open}
        onClick={() => setOpen(true)}
      >
        <Settings2 className="size-4" aria-hidden />
        {!compact && t.open}
      </Button>
      {open && (
        <PageSettingsDialog
          name={name}
          seo={seo}
          showNoindex={scripts.kind === "page"}
          seoHint={scripts.kind === "page" ? t.hintPage : t.hintStep}
          onSaveSeo={onSaveSeo}
          scripts={scripts}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * A page's settings in the builder (SPEC §9.3): the SEO tab (title,
 * description, sharing image, and for website pages "hide from search
 * engines") and the Scripts tab (code in <head> and before </body>, kept
 * outside the page tree under the store's custom-code rules).
 *
 * SEO is the page's own: `onSaveSeo` saves it the way that page saves —
 * a website page at once (live with the next Publish), a funnel step into the
 * funnel draft. Scripts save on their own, at once.
 */
export function PageSettingsDialog({
  name,
  seo,
  showNoindex,
  seoHint,
  onSaveSeo,
  onClose,
}: {
  name: string;
  seo: Record<string, unknown>;
  showNoindex: boolean;
  /** Where the SEO goes: "live with your next Publish" / "saved with the funnel". */
  seoHint: string;
  onSaveSeo: (seo: Record<string, unknown>) => Promise<void> | void;
  scripts: { kind: PageScriptKind; id: string | null };
  onClose: () => void;
}) {
  const t = useT(STRINGS);
  return (
    <Modal open onClose={onClose} title={fmt(t.title, { name })} footer={<Button variant="outline" onClick={onClose}>{t.close}</Button>}>
      <div className="space-y-4">
        <SeoForm seo={seo} showNoindex={showNoindex} hint={seoHint} onSave={onSaveSeo} />
      </div>
    </Modal>
  );
}

function SeoForm({ seo, showNoindex, hint, onSave }: { seo: Record<string, unknown>; showNoindex: boolean; hint: string; onSave: (seo: Record<string, unknown>) => Promise<void> | void }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [title, setTitle] = useState(str(seo.title));
  const [description, setDescription] = useState(str(seo.description));
  const [image, setImage] = useState(str(seo.ogImage));
  const [noindex, setNoindex] = useState(seo.noindex === true);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      // Keys this form doesn't edit (the canvas position of a funnel step…) stay.
      await onSave({ ...seo, title: title.trim(), description: description.trim(), ogImage: image.trim(), ...(showNoindex ? { noindex } : {}) });
      toast.success(t.seoSaved);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-soft">{hint}</p>
      <div className="space-y-1.5">
        <Label htmlFor="ps-title">{t.seoTitle}</Label>
        <Input id="ps-title" dir="auto" maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} />
        <p className="text-xs text-ink-soft">{fmt(t.count, { n: title.length, max: 70 })}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ps-description">{t.seoDescription}</Label>
        <Textarea id="ps-description" dir="auto" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
        <p className="text-xs text-ink-soft">{fmt(t.count, { n: description.length, max: 160 })}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ps-image">{t.image}</Label>
        <Input id="ps-image" type="url" dir="ltr" maxLength={1000} value={image} aria-describedby="ps-image-hint" onChange={(e) => setImage(e.target.value)} />
        <p id="ps-image-hint" className="text-xs text-ink-soft">
          {t.imageHint}
        </p>
      </div>
      {showNoindex && (
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="size-4 accent-primary" checked={noindex} onChange={(e) => setNoindex(e.target.checked)} />
          {t.noindex}
        </label>
      )}
      <div className="text-end">
        <Button disabled={busy} onClick={() => void save()}>
          {t.saveSeo}
        </Button>
      </div>
    </div>
  );
}

