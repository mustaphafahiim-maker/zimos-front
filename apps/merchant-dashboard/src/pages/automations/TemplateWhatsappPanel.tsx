import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import {
  ApiError,
  automationWhatsappStatus,
  automationWhatsappSubmit,
  whatsappTemplatesSync,
  type AutomationWhatsappStatus,
  type AutomationWhatsappTemplate,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { IconRefresh, IconWhatsApp } from "@/components/icons";
import { SkeletonBar } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    create: "Create on WhatsApp",
    creating: "Sending to WhatsApp…",
    createHint: "ZIMOS sends these templates to your WhatsApp Business account for review, so you don't type them into WhatsApp Manager.",
    autoOn: "Turn the automation on when WhatsApp approves",
    pending: "In review by WhatsApp",
    pendingNote: "The automation is off until it is approved",
    pendingAuto: "It will turn on by itself once approved",
    approved: "Approved",
    approvedOn: "The automation is on.",
    approvedOff: "The automation is off. Switch it on from “My automations”.",
    rejected: "Rejected",
    rejectedHow: "Edit the template in WhatsApp Manager, then press Sync templates",
    incomplete: "Some templates are missing",
    incompleteNote: "Only some of this automation's templates are in your WhatsApp account. Press “Create on WhatsApp” to send the rest.",
    metaReason: "Meta's reason: {reason}",
    sync: "Sync templates",
    syncing: "Syncing…",
    synced: "Templates synced.",
    tableTitle: "Templates in your WhatsApp account",
    colName: "Template",
    colLanguage: "Language",
    colStatus: "Status",
    lang_ar: "Arabic",
    lang_en: "English",
    tpl_PENDING: "In review",
    tpl_APPROVED: "Approved",
    tpl_REJECTED: "Rejected",
    tpl_PAUSED: "Paused",
    tpl_DISABLED: "Disabled",
    reused: "Already in your account — its text may differ",
    submitted: "Sent to WhatsApp for review.",
    nothingNew: "Nothing new to send: these templates are already in your account.",
    err_rate: "WhatsApp is limiting requests, try again shortly",
    err_notConnected: "Connect your WhatsApp Business number first.",
    err_noAccount: "Add the WhatsApp Business Account ID to your WhatsApp connection first.",
    err_auth: "WhatsApp refused the saved access token. Connect WhatsApp again.",
    err_nameTaken: "WhatsApp is still deleting a template with this name. Try again in a while.",
    err_appOff: "The WhatsApp app is switched off for this store. Install it again from the Apps page.",
    openSettings: "Open the WhatsApp settings",
    openApps: "Open the Apps page",
    statusFailed: "The review status could not be read.",
    retry: "Try again",
    noPermission: "Only someone who can manage automations can create the templates on WhatsApp.",
  },
  ar: {
    create: "إنشاء على واتساب",
    creating: "بنبعت لواتساب…",
    createHint: "زيموس بيبعت القوالب دي لحساب واتساب بيزنس بتاعك للمراجعة، من غير ما تكتبها بإيدك في WhatsApp Manager.",
    autoOn: "شغّل الأتمتة تلقائيًا بعد موافقة واتساب",
    pending: "قيد المراجعة من واتساب",
    pendingNote: "الأتمتة متوقفة حتى الموافقة",
    pendingAuto: "ستعمل تلقائيًا بعد الموافقة",
    approved: "تمت الموافقة",
    approvedOn: "الأتمتة شغّالة.",
    approvedOff: "الأتمتة متوقفة. شغّلها من «أتمتتي».",
    rejected: "مرفوض",
    rejectedHow: "عدّل القالب في WhatsApp Manager ثم اضغط مزامنة القوالب",
    incomplete: "فيه قوالب ناقصة",
    incompleteNote: "بعض قوالب الأتمتة دي بس موجودة في حساب واتساب بتاعك. اضغط «إنشاء على واتساب» عشان نبعت الباقي.",
    metaReason: "سبب Meta: {reason}",
    sync: "مزامنة القوالب",
    syncing: "بنزامن…",
    synced: "القوالب اتزامنت.",
    tableTitle: "القوالب في حساب واتساب بتاعك",
    colName: "القالب",
    colLanguage: "اللغة",
    colStatus: "الحالة",
    lang_ar: "العربية",
    lang_en: "الإنجليزية",
    tpl_PENDING: "قيد المراجعة",
    tpl_APPROVED: "مقبول",
    tpl_REJECTED: "مرفوض",
    tpl_PAUSED: "موقوف مؤقتًا",
    tpl_DISABLED: "معطّل",
    reused: "قالب موجود بالفعل في حسابك — النص قد يختلف",
    submitted: "اتبعتت لواتساب للمراجعة.",
    nothingNew: "مفيش جديد يتبعت: القوالب دي موجودة في حسابك.",
    err_rate: "واتساب تحد من الطلبات الآن، حاول بعد قليل",
    err_notConnected: "اربط رقم واتساب بيزنس بتاعك الأول.",
    err_noAccount: "ضيف رقم حساب واتساب بيزنس (Business Account ID) في ربط واتساب الأول.",
    err_auth: "واتساب رفض التوكن المحفوظ. اربط واتساب تاني.",
    err_nameTaken: "واتساب لسه بيمسح قالب بنفس الاسم. جرّب تاني بعد شوية.",
    err_appOff: "تطبيق واتساب مقفول في المتجر ده. نزّله تاني من صفحة التطبيقات.",
    openSettings: "افتح إعدادات واتساب",
    openApps: "افتح صفحة التطبيقات",
    statusFailed: "معرفناش نقرا حالة المراجعة.",
    retry: "جرّب تاني",
    noPermission: "اللي يقدر يدير الأتمتة بس هو اللي ينشئ القوالب على واتساب.",
  },
} satisfies Messages;

type Strings = Record<keyof (typeof STRINGS)["en"], string>;
type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const WHATSAPP_SETTINGS = "/settings?tab=whatsapp";

const OVERALL: Record<string, { key: keyof Strings; tone: Tone }> = {
  pending: { key: "pending", tone: "warning" },
  approved: { key: "approved", tone: "success" },
  rejected: { key: "rejected", tone: "danger" },
  incomplete: { key: "incomplete", tone: "neutral" },
};

const TEMPLATE_TONE: Record<string, Tone> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", PAUSED: "neutral", DISABLED: "neutral" };

const languageName = (t: Strings, code: string): string => (t as Record<string, string | undefined>)[`lang_${code.slice(0, 2)}`] ?? code;
const templateStatus = (t: Strings, status: string): string => (t as Record<string, string | undefined>)[`tpl_${status}`] ?? status;

/** What went wrong with a submit, in the dashboard's words, and where to fix it. */
function problemOf(t: Strings, err: unknown, fallback: (err: unknown) => string): { text: string; link?: { to: string; label: string } } {
  const code = err instanceof ApiError ? err.code : undefined;
  if (code === "WHATSAPP_RATE_LIMITED" || (err instanceof ApiError && err.status === 429)) return { text: t.err_rate };
  if (code === "WHATSAPP_NOT_CONNECTED") return { text: t.err_notConnected, link: { to: WHATSAPP_SETTINGS, label: t.openSettings } };
  if (code === "WHATSAPP_NO_BUSINESS_ACCOUNT") return { text: t.err_noAccount, link: { to: WHATSAPP_SETTINGS, label: t.openSettings } };
  if (code === "WHATSAPP_AUTH_FAILED") return { text: t.err_auth, link: { to: WHATSAPP_SETTINGS, label: t.openSettings } };
  if (code === "WHATSAPP_TEMPLATE_NAME_TAKEN") return { text: t.err_nameTaken };
  if (code === "APP_NOT_INSTALLED") return { text: t.err_appOff, link: { to: "/apps", label: t.openApps } };
  // Meta refused the content: its own words say why.
  if (code === "WHATSAPP_TEMPLATE_REJECTED" && err instanceof ApiError && err.message) return { text: err.message };
  if (err instanceof ApiError && err.status === 403) return { text: t.noPermission };
  return { text: fallback(err) };
}

/**
 * The status of a ready-made automation's templates on WhatsApp, as a chip for
 * its card: nothing until something was submitted, and nothing when the
 * status cannot be read (a role without automations.manage, WhatsApp off).
 * `version` re-reads it after a submit made in the sheet.
 */
export function TemplateWhatsappBadge({ templateKey, version }: { templateKey: string; version: number }) {
  const t = useT(STRINGS) as Strings;
  const workspaceId = useWorkspaceId();
  const status = useAsync(() => automationWhatsappStatus(apiClient, workspaceId, templateKey).catch(() => null), [workspaceId, templateKey, version]);
  const look = status.data?.status ? OVERALL[status.data.status] : undefined;
  if (!look) return null;
  return <StatusBadge value={String(status.data?.status)} tone={look.tone} text={t[look.key]} />;
}

/**
 * «إنشاء على واتساب» (handoff 391), inside the sheet that shows a ready-made
 * automation's template texts: the button, the «شغّل الأتمتة تلقائيًا بعد
 * موافقة واتساب» tick under it, and — once something was submitted, or on
 * opening — where the review stands, with the account's templates one per
 * line (name, language, Meta's status, Meta's reason for a rejected one).
 *
 * A rejected template is fixed in WhatsApp Manager; «مزامنة القوالب» then
 * reads the account again and this panel with it.
 */
export function TemplateWhatsappPanel({
  templateKey,
  couponCode,
  onChanged,
}: {
  templateKey: string;
  /** The coupon typed on the card, for a rule this submit creates. */
  couponCode?: string;
  /** A submit or a sync changed something: the cards and the rules are read again. */
  onChanged: () => void;
}) {
  const t = useT(STRINGS) as Strings;
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const status = useAsync<AutomationWhatsappStatus>(() => automationWhatsappStatus(apiClient, workspaceId, templateKey), [workspaceId, templateKey]);
  const [activate, setActivate] = useState(true);
  const [working, setWorking] = useState<"submit" | "sync" | null>(null);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | null>(null);

  const data = status.data;
  const overall = data?.status ? OVERALL[data.status] : undefined;
  // Nothing submitted yet, or only part of it: the button is the next step. After that it stays, quieter: a store that
  // added a language since (English) sends that language with it, and a click with nothing new sends nothing.
  const firstSubmit = !data?.status || data.status === "incomplete";

  async function submit() {
    if (working) return;
    setWorking("submit");
    setProblem(null);
    try {
      const answer = await automationWhatsappSubmit(apiClient, workspaceId, templateKey, {
        activateWhenApproved: activate,
        locale: locale === "en" ? "en" : "ar",
        ...(couponCode ? { couponCode } : {}),
      });
      status.setData(answer);
      const sentNow = answer.ruleCreated || answer.templates.some((template) => template.outcome === "submitted");
      toast.success(sentNow ? t.submitted : t.nothingNew);
      onChanged();
    } catch (err) {
      setProblem(problemOf(t, err, errorMessage));
    } finally {
      setWorking(null);
    }
  }

  async function sync() {
    if (working) return;
    setWorking("sync");
    setProblem(null);
    try {
      await whatsappTemplatesSync(apiClient, workspaceId);
      await status.refresh({ silent: true });
      toast.success(t.synced);
      onChanged();
    } catch (err) {
      setProblem(problemOf(t, err, errorMessage));
    } finally {
      setWorking(null);
    }
  }

  if (status.loading && !data) {
    return (
      <div className="rounded-2xl bg-paper-sunken px-4 py-4" aria-busy="true">
        <SkeletonBar className="h-4 w-2/5" />
        <SkeletonBar className="mt-3 h-10 w-44" />
      </div>
    );
  }

  if (!data) {
    const failed = problemOf(t, status.error, () => t.statusFailed);
    return (
      <Alert variant={status.error instanceof ApiError && status.error.status === 403 ? undefined : "danger"}>
        <p>{failed.text}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {failed.link && (
            <Link to={failed.link.to} className="text-sm font-semibold text-primary hover:underline">
              {failed.link.label}
            </Link>
          )}
          {!(status.error instanceof ApiError && status.error.status === 403) && (
            <Button type="button" variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => void status.refresh()}>
              {t.retry}
            </Button>
          )}
        </div>
      </Alert>
    );
  }

  const note =
    data.status === "pending"
      ? // A rule switched on by hand before its templates were sent stays on: nothing to say about it being off.
        data.rule?.isActive
        ? null
        : data.rule?.activateWhenApproved
        ? `${t.pendingNote} — ${t.pendingAuto}`
        : t.pendingNote
      : data.status === "approved"
        ? data.rule
          ? data.rule.isActive
            ? t.approvedOn
            : t.approvedOff
          : null
        : data.status === "rejected"
          ? t.rejectedHow
          : data.status === "incomplete"
            ? t.incompleteNote
            : null;

  return (
    <section data-slot="sweep-well" data-whatsapp-submit={templateKey} className="rounded-2xl bg-paper-sunken px-4 py-4" aria-live="polite">
      {overall && (
        <div className="mb-3">
          <StatusBadge value={String(data.status)} tone={overall.tone} text={t[overall.key]} />
          {note && <p className="mt-1.5 text-[13px] leading-5 text-ink">{note}</p>}
        </div>
      )}

      {problem && (
        <Alert variant="danger" className="mb-3">
          <p dir="auto">{problem.text}</p>
          {problem.link && (
            <Link to={problem.link.to} className="mt-1 inline-block text-sm font-semibold text-primary hover:underline">
              {problem.link.label}
            </Link>
          )}
        </Alert>
      )}

      {
        <>
          <Button type="button" variant={firstSubmit ? "default" : "outline"} className="min-h-11 w-full rounded-full px-5 sm:w-auto" disabled={working !== null} aria-busy={working === "submit"} onClick={() => void submit()}>
            <IconWhatsApp className="size-4" aria-hidden />
            {working === "submit" ? t.creating : t.create}
          </Button>
          {data.status !== "approved" && (
            <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
              <input type="checkbox" className="size-5 shrink-0 cursor-pointer accent-primary" checked={activate} disabled={working !== null} onChange={(e) => setActivate(e.target.checked)} />
              <span>{t.autoOn}</span>
            </label>
          )}
          {!data.status && <p className="mt-1 text-[13px] leading-5 text-ink-soft">{t.createHint}</p>}
        </>
      }

      {data.templates.length > 0 && (
        <div className="mt-4">
          <h4 className="text-[13px] leading-5 font-semibold text-ink-soft">{t.tableTitle}</h4>
          <ul className="mt-1.5 divide-y divide-line rounded-xl bg-paper-raised ring-1 ring-line">
            {data.templates.map((template) => (
              <TemplateLine key={template.id} t={t} template={template} />
            ))}
          </ul>
        </div>
      )}

      {data.status && data.status !== "approved" && data.templates.length > 0 && (
        <Button type="button" variant="outline" size="sm" className="mt-3 min-h-11 md:min-h-9" disabled={working !== null} aria-busy={working === "sync"} onClick={() => void sync()}>
          <IconRefresh className="size-4" aria-hidden />
          {working === "sync" ? t.syncing : t.sync}
        </Button>
      )}
    </section>
  );
}

function TemplateLine({ t, template }: { t: Strings; template: AutomationWhatsappTemplate }) {
  return (
    <li className="px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 text-sm text-ink">
          <code dir="ltr" className="font-mono">
            {template.name}
          </code>
          <span className="text-ink-soft"> · {languageName(t, template.language)}</span>
        </p>
        <StatusBadge value={template.status} tone={TEMPLATE_TONE[template.status] ?? "neutral"} text={templateStatus(t, template.status)} />
      </div>
      {template.status === "REJECTED" && template.rejectedReason && (
        <p className="mt-1 text-[13px] leading-5 text-danger">
          {fmt(t.metaReason, { reason: "" })}
          <bdi dir="ltr">{template.rejectedReason}</bdi>
        </p>
      )}
      {template.outcome === "reused" && <p className="mt-1 text-[13px] leading-5 text-ink-soft">{t.reused}</p>}
    </li>
  );
}
