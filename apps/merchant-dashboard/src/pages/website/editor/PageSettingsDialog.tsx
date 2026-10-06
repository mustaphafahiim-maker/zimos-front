import { useEffect, useState, type ReactNode } from "react";
import { Settings2 } from "lucide-react";
import { Alert, Button, Input, Label } from "@store-builder/ui";
import { ApiError, pageScriptsGet, pageScriptsSave, type PageScriptKind } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { FilterTabs } from "@/components/FilterTabs";
import { Modal } from "@/components/Modal";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Page settings — {name}",
    tabs: "Page settings sections",
    details: "Details",
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
    details: "التفاصيل",
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

type Tab = "details" | "seo" | "scripts";

/** The builder toolbar's "Page settings" button and its dialog. */
export function PageSettingsButton({
  name,
  seo,
  onSaveSeo,
  scripts,
  compact = false,
  details,
}: {
  name: string;
  seo: Record<string, unknown>;
  onSaveSeo: (seo: Record<string, unknown>) => Promise<void> | void;
  scripts: { kind: PageScriptKind; id: string | null };
  /** Icon only (the website editor's toolbar). */
  compact?: boolean;
  /** The Details tab (the page's title and address), shown first when given. */
  details?: ReactNode;
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
          details={details}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * A page's settings in the builder (SPEC §9.3): the Details tab when the
 * page passes one (a funnel step's title and address), the SEO tab (title,
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
  scripts,
  details,
  onClose,
}: {
  name: string;
  seo: Record<string, unknown>;
  details?: ReactNode;
  showNoindex: boolean;
  /** Where the SEO goes: "live with your next Publish" / "saved with the funnel". */
  seoHint: string;
  onSaveSeo: (seo: Record<string, unknown>) => Promise<void> | void;
  scripts: { kind: PageScriptKind; id: string | null };
  onClose: () => void;
}) {
  const t = useT(STRINGS);
  const [tab, setTab] = useState<Tab>(details ? "details" : "seo");
  const tabs = [
    ...(details ? [{ value: "details" as const, label: t.details }] : []),
    { value: "seo" as const, label: t.seo },
    { value: "scripts" as const, label: t.scripts },
  ];
  return (
    <Modal open onClose={onClose} title={fmt(t.title, { name })} footer={<Button variant="outline" onClick={onClose}>{t.close}</Button>}>
      <div className="space-y-4">
        <FilterTabs label={t.tabs} value={tab} onChange={setTab} tabs={tabs} />
        {tab === "details" ? (
          details
        ) : tab === "seo" ? (
          <SeoForm seo={seo} showNoindex={showNoindex} hint={seoHint} onSave={onSaveSeo} />
        ) : (
          <ScriptsForm kind={scripts.kind} id={scripts.id} />
        )}
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

function ScriptsForm({ kind, id }: { kind: PageScriptKind; id: string | null }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "error">(id ? "loading" : "ready");
  const [error, setError] = useState<string | null>(null);
  const [head, setHead] = useState("");
  const [body, setBody] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let live = true;
    pageScriptsGet(apiClient, workspaceId, kind, id)
      .then((s) => {
        if (!live) return;
        setHead(s.head);
        setBody(s.body);
        setActive(s.updatedAt ? s.isActive : true);
        setState("ready");
      })
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiError && err.status === 403) setState("forbidden");
        else {
          setError(errorMessage(err));
          setState("error");
        }
      });
    return () => {
      live = false;
    };
  }, [workspaceId, kind, id, errorMessage]);

  if (!id) return <Alert>{t.needsSave}</Alert>;
  if (state === "loading") return <p className="text-sm text-ink-soft">{t.loading}</p>;
  if (state === "forbidden") return <Alert>{t.noPermission}</Alert>;
  if (state === "error") return <Alert variant="danger">{error}</Alert>;

  async function save() {
    if (!id) return;
    setBusy(true);
    try {
      await pageScriptsSave(apiClient, workspaceId, kind, id, { head, body, isActive: active });
      toast.success(t.scriptsSaved);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Alert>{t.rules}</Alert>
      <div className="space-y-1.5">
        <Label htmlFor="ps-head">{t.head}</Label>
        <Textarea id="ps-head" dir="ltr" rows={5} maxLength={50000} className="font-mono text-xs" value={head} onChange={(e) => setHead(e.target.value)} />
        <p className="text-xs text-ink-soft">{t.headHint}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ps-body">{t.body}</Label>
        <Textarea id="ps-body" dir="ltr" rows={5} maxLength={50000} className="font-mono text-xs" value={body} onChange={(e) => setBody(e.target.value)} />
        <p className="text-xs text-ink-soft">{t.bodyHint}</p>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
        <input type="checkbox" className="size-4 accent-primary" checked={active} onChange={(e) => setActive(e.target.checked)} />
        {t.active}
      </label>
      <div className="text-end">
        <Button disabled={busy} onClick={() => void save()}>
          {t.saveScripts}
        </Button>
      </div>
    </div>
  );
}
