import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Button, Card, Input, cn } from "@store-builder/ui";
import {
  automationFlowsDelete,
  automationFlowsEnableTemplate,
  automationFlowsList,
  automationFlowsListRuns,
  automationFlowsListTemplates,
  automationFlowsUpdate,
  type AutomationFlowList,
  type AutomationFlowRule,
  type AutomationFlowRun,
  type AutomationFlowRunStatus,
  type AutomationFlowTemplate,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { CardSkeleton, DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconCheck, IconChecklist, IconDelete, IconEdit, IconPause, IconPlay, IconPlus, IconRobot, IconSparkle } from "@/components/icons";
import { ChipRow, ListRowCard, ListSkeleton, type ChipItem } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { PageHeader } from "@/components/PageHeader";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { Fact, Facts } from "@/pages/marketing/kit/Facts";
import { Switch } from "@/pages/marketing/kit/Switch";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction, rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { useIsCompact, useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { AUTOMATION_STRINGS, stepSummary, stepTypeLabel, triggerLabel } from "./automationText";
// «إنشاء على واتساب»: a ready-made automation's templates sent to the store's WhatsApp account (handoff 391).
import { TemplateWhatsappBadge, TemplateWhatsappPanel } from "./TemplateWhatsappPanel";
import { RUN_DETAIL_STRINGS, runDetailText } from "./runDetail";
import { RuleEditorDialog } from "./RuleEditorDialog";

/**
 * Automations (SPEC §14.2): rules that run an ordered sequence of steps when
 * something happens to an order — messages, waits, a webhook, a tag, a status
 * change, a note to the team.
 *
 * Three views as chips (`?tab=` keeps the choice): the store's own automations
 * first — each a card with its switch and ONE sentence of what starts it and
 * what it does; the ready-made ones, switched on with a tap; and the run log.
 * A card opens its preview (every step, its numbers, edit, delete); the editor
 * is a sheet.
 */

const STRINGS = {
  en: {
    title: "Automations",
    description: "Run a sequence of steps by itself when something happens to an order: messages, waits, tags, status changes.",
    newRule: "New automation",
    notConnected: "WhatsApp isn't connected, so WhatsApp steps will fail until it is.",
    connect: "Connect WhatsApp",
    tabsLabel: "Automations view",
    tabRules: "Yours",
    tabTemplates: "Ready-made",
    tabLog: "Run log",
    templatesDesc: "Switch one on with a tap, then adjust it like any other automation.",
    enable: "Switch on",
    enabling: "Switching on…",
    enabled: "Switched on",
    off: "Off",
    viewMessages: "Messages to approve",
    messagesTitle: "WhatsApp templates for “{name}”",
    messagesDesc:
      "WhatsApp only sends templates approved in your own Meta account. Create each of these there under exactly this name; until Meta approves it, that step fails and says so in the log.",
    templateName: "Template name",
    buttons: "Quick-reply buttons",
    close: "Close",
    templateEnabled: "“{name}” is on. Review its steps.",
    templateCoupon: "Coupon for the last reminder (optional)",
    noTemplates: "No ready-made automations yet",
    noRules: "No automations yet",
    noRulesDesc: "An automation does the follow-up for you: a WhatsApp message when an order ships, a reminder for an abandoned checkout. Start from a ready-made one.",
    seeTemplates: "See the ready-made ones",
    active: "Active",
    sentence: "When: {trigger} ← {steps}",
    stepJoin: " ← ",
    whenTrigger: "When",
    stats: "{sent} done · {skipped} skipped · {failed} failed",
    statsTitle: "Runs",
    lastRun: "Last run {date}",
    lastRunFact: "Last run",
    never: "Never ran",
    stepsTitle: "Steps, in order",
    peek: "Preview the automation {name}",
    menuLabel: "Actions for this automation",
    edit: "Edit",
    delete: "Delete",
    deleteRule: "Delete this automation",
    turnOn: "Turn on",
    turnOff: "Turn off",
    showLog: "Show its runs",
    turnedOn: "“{name}” is on.",
    turnedOff: "“{name}” is off. Sequences already waiting carry on.",
    saved: "Automation saved.",
    created: "Automation created.",
    deleteTitle: "Delete this automation?",
    deleteDesc: "“{name}” will stop running. Sequences that are waiting stop too. Its past runs stay in the log.",
    deleting: "Deleting…",
    cancel: "Cancel",
    deleted: "Automation deleted.",
    filter: "Filter runs by result",
    allRules: "All automations",
    all: "All",
    sent: "Done",
    skipped: "Skipped",
    failed: "Failed",
    noRuns: "Nothing has run yet",
    noRunsDesc: "Each step an automation runs, skips or fails on shows up here.",
    colTime: "Time",
    colRule: "Automation",
    colStep: "Step",
    colOrder: "Order",
    colStatus: "Result",
    colDetail: "Detail",
    deletedRule: "Deleted automation",
    wholeRule: "Whole automation",
    stepN: "{n}. {step}",
  },
  ar: {
    title: "الأتمتة",
    description: "خلّي سلسلة خطوات تتنفّذ لوحدها لما حاجة تحصل للأوردر: رسايل، انتظار، وسوم، تغيير حالة.",
    newRule: "أتمتة جديدة",
    notConnected: "واتساب مش مربوط، فخطوات واتساب هتفشل لحد ما تربطه.",
    connect: "اربط واتساب",
    tabsLabel: "عرض الأتمتة",
    tabRules: "بتاعتك",
    tabTemplates: "جاهزة",
    tabLog: "السجل",
    templatesDesc: "شغّل أي واحدة بضغطة، وبعدين عدّلها زي أي أتمتة تانية.",
    enable: "شغّلها",
    enabling: "بنشغّلها…",
    enabled: "شغّالة",
    off: "متوقفة",
    viewMessages: "الرسايل اللي لازم تتعتمد",
    messagesTitle: "قوالب واتساب لـ «{name}»",
    messagesDesc:
      "واتساب بيبعت بس القوالب المعتمدة في حسابك على Meta. اعمل كل قالب هناك بنفس الاسم بالظبط؛ ولحد ما Meta تعتمده الخطوة دي هتفشل والسبب هيظهر في السجل.",
    templateName: "اسم القالب",
    buttons: "أزرار الرد السريع",
    close: "إغلاق",
    templateEnabled: "«{name}» اشتغلت. راجع خطواتها.",
    templateCoupon: "كود خصم للتذكير الأخير (اختياري)",
    noTemplates: "لسه مفيش أتمتة جاهزة",
    noRules: "لسه مفيش أتمتة",
    noRulesDesc: "الأتمتة بتعمل المتابعة مكانك: رسالة واتساب لما الأوردر يتشحن، تذكير للي ساب الأوردر في النص. ابدأ بواحدة جاهزة.",
    seeTemplates: "شوف الجاهزة",
    active: "شغّالة",
    sentence: "لما: {trigger} ← {steps}",
    stepJoin: " ← ",
    whenTrigger: "لما",
    stats: "{sent} تمّت · {skipped} اتخطّت · {failed} فشلت",
    statsTitle: "التشغيل",
    lastRun: "آخر تشغيل {date}",
    lastRunFact: "آخر تشغيل",
    never: "لسه ما اشتغلتش",
    stepsTitle: "الخطوات بالترتيب",
    peek: "معاينة أتمتة {name}",
    menuLabel: "إجراءات الأتمتة",
    edit: "عدّل",
    delete: "امسح",
    deleteRule: "امسح الأتمتة دي",
    turnOn: "شغّلها",
    turnOff: "وقّفها",
    showLog: "شوف سجلّها",
    turnedOn: "«{name}» اشتغلت.",
    turnedOff: "«{name}» اتوقفت. السلاسل اللي مستنية هتكمّل.",
    saved: "الأتمتة اتحفظت.",
    created: "الأتمتة اتعملت.",
    deleteTitle: "تمسح الأتمتة دي؟",
    deleteDesc: "«{name}» هتبطّل تشتغل، والسلاسل اللي مستنية هتقف كمان. سجل تشغيلها القديم هيفضل.",
    deleting: "بنمسح…",
    cancel: "إلغاء",
    deleted: "الأتمتة اتمسحت.",
    filter: "فلتر السجل بالنتيجة",
    allRules: "كل الأتمتة",
    all: "الكل",
    sent: "تمّت",
    skipped: "اتخطّت",
    failed: "فشلت",
    noRuns: "لسه مفيش حاجة اشتغلت",
    noRunsDesc: "كل خطوة الأتمتة تنفّذها أو تتخطاها أو تفشل فيها بتظهر هنا.",
    colTime: "الوقت",
    colRule: "الأتمتة",
    colStep: "الخطوة",
    colOrder: "الأوردر",
    colStatus: "النتيجة",
    colDetail: "التفاصيل",
    deletedRule: "أتمتة اتمسحت",
    wholeRule: "الأتمتة كلها",
    stepN: "{n}. {step}",
  },
} satisfies Messages;

// Stopgap: the server's copy for one ready-made automation still carries a reference to the spec,
// "(SPEC §18.2)", written for developers. Remove once automationTemplates.js in the backend is clean.
const withoutSpecRefs = (text: string) => text.replace(/\s*\(SPEC §[\d.]+\)/g, "");

const RUN_TONE = { sent: "success", skipped: "neutral", failed: "danger" } as const;
const RUNS_PAGE = 50;
type RunFilter = "all" | AutomationFlowRunStatus;
type Tab = "rules" | "templates" | "log";
const isTab = (value: string | null): value is Tab => value === "rules" || value === "templates" || value === "log";
const EMPTY_RULES: AutomationFlowList = { rules: [], triggers: [], tokens: [], stepTypes: [] };

export function AutomationsPage() {
  const t = useT(STRINGS);
  const at = useT(AUTOMATION_STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const compact = useIsCompact();
  const phone = useIsPhone();

  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const tab: Tab = isTab(rawTab) ? rawTab : "rules";
  function selectTab(next: Tab) {
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next === "rules") out.delete("tab");
        else out.set("tab", next);
        return out;
      },
      { replace: true }
    );
  }

  const integration = useAsync(() => apiClient.getWhatsappIntegration(workspaceId), [workspaceId]);
  const rules = useAsync(() => automationFlowsList(apiClient, workspaceId), [workspaceId]);
  const templates = useAsync(() => automationFlowsListTemplates(apiClient, workspaceId), [workspaceId]);

  const [editing, setEditing] = useState<AutomationFlowRule | "new" | null>(null);
  const [toDelete, setToDelete] = useState<AutomationFlowRule | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [enabling, setEnabling] = useState<string | null>(null);
  const [messagesOf, setMessagesOf] = useState<AutomationFlowTemplate | null>(null);
  // Bumped when templates were sent to WhatsApp or synced: the cards' review chips are read again.
  const [whatsappVersion, setWhatsappVersion] = useState(0);
  const runWords = useT(RUN_DETAIL_STRINGS);
  // The automation being looked at. It stays here while its sheet closes, so the sheet does not empty on its way out.
  const [peek, setPeek] = useState<{ id: string; open: boolean } | null>(null);

  // --- run log (own paging + filters) ---
  const [runFilter, setRunFilter] = useState<RunFilter>("all");
  const [runRule, setRunRule] = useState("");
  const [runs, setRuns] = useState<AutomationFlowRun[]>([]);
  const [runsCursor, setRunsCursor] = useState<string | null>(null);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsMore, setRunsMore] = useState(false);
  const [runsError, setRunsError] = useState<unknown>(null);
  const runsCall = useRef(0);

  const loadRuns = useCallback(
    async (before: string | null, silent = false) => {
      const id = ++runsCall.current;
      if (before) setRunsMore(true);
      else if (!silent) setRunsLoading(true);
      setRunsError(null);
      try {
        const page = await automationFlowsListRuns(apiClient, workspaceId, {
          limit: RUNS_PAGE,
          before,
          status: runFilter === "all" ? undefined : runFilter,
          ruleId: runRule || undefined,
        });
        if (id !== runsCall.current) return;
        setRuns((prev) => (before ? [...prev, ...page.runs] : page.runs));
        setRunsCursor(page.nextCursor);
      } catch (err) {
        if (id === runsCall.current) setRunsError(err);
      } finally {
        if (id === runsCall.current) {
          setRunsLoading(false);
          setRunsMore(false);
        }
      }
    },
    [workspaceId, runFilter, runRule]
  );

  useEffect(() => {
    void loadRuns(null);
  }, [loadRuns]);

  const list = rules.data?.rules ?? [];
  const ruleNames = new Map(list.map((r) => [r.id, r.name]));
  const peeked = peek ? (list.find((r) => r.id === peek.id) ?? null) : null;
  const closePeek = () => setPeek((current) => (current ? { ...current, open: false } : current));

  const patchRule = (id: string, isActive: boolean) =>
    rules.setData((prev) => {
      const current = prev ?? EMPTY_RULES;
      return { ...current, rules: current.rules.map((r) => (r.id === id ? { ...r, isActive } : r)) };
    });

  /** The switch answers at once; the request follows, and the toast can take it back. */
  async function toggle(rule: AutomationFlowRule, next: boolean, undoable = true): Promise<void> {
    setToggling(rule.id);
    patchRule(rule.id, next);
    try {
      await automationFlowsUpdate(apiClient, workspaceId, rule.id, { isActive: next });
      const message = fmt(next ? t.turnedOn : t.turnedOff, { name: rule.name });
      if (undoable) toast.undo(message, () => toggle(rule, !next, false));
      else toast.success(message);
      void rules.refresh({ silent: true });
    } catch (err) {
      patchRule(rule.id, !next);
      toast.error(errorMessage(err));
    } finally {
      setToggling(null);
    }
  }

  // The coupon a template that offers one gives in its last message (abandoned cart).
  const [templateCoupons, setTemplateCoupons] = useState<Record<string, string>>({});
  const lang = locale === "en" ? "en" : "ar";

  async function enableTemplate(template: AutomationFlowTemplate) {
    setEnabling(template.key);
    try {
      const couponCode = template.acceptsCoupon ? (templateCoupons[template.key] ?? "").trim() : "";
      await automationFlowsEnableTemplate(apiClient, workspaceId, template.key, lang, couponCode ? { couponCode } : {});
      toast.success(fmt(t.templateEnabled, { name: template.name[lang] }));
      await Promise.all([rules.refresh({ silent: true }), templates.refresh({ silent: true })]);
      if (template.whatsappTemplates.length > 0) setMessagesOf(template);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setEnabling(null);
    }
  }

  function showLogOf(rule: AutomationFlowRule) {
    closePeek();
    setRunRule(rule.id);
    selectTab("log");
  }

  function menuFor(rule: AutomationFlowRule): ContextMenuItem[] {
    return [
      { id: "edit", label: t.edit, icon: IconEdit, onSelect: () => setEditing(rule) },
      {
        id: "toggle",
        label: rule.isActive ? t.turnOff : t.turnOn,
        icon: rule.isActive ? IconPause : IconPlay,
        disabled: toggling === rule.id,
        onSelect: () => void toggle(rule, !rule.isActive),
      },
      { id: "log", label: t.showLog, icon: IconChecklist, onSelect: () => showLogOf(rule) },
      { id: "delete", label: t.delete, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setToDelete(rule) },
    ];
  }

  const chips: ChipItem<Tab>[] = [
    { value: "rules", label: t.tabRules, count: rules.data ? list.length : null },
    { value: "templates", label: t.tabTemplates, count: templates.data ? templates.data.length : null },
    { value: "log", label: t.tabLog },
  ];

  const newButton = (
    <Button type="button" className="min-h-11 rounded-full px-5" onClick={() => setEditing("new")} disabled={!rules.data}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.newRule}
    </Button>
  );

  const cardsSkeleton = (
    <div className="grid gap-[var(--bento-gap)] md:grid-cols-2">
      <CardSkeleton lines={2} />
      <CardSkeleton lines={2} />
    </div>
  );

  const stepName = (run: AutomationFlowRun) =>
    run.stepType
      ? run.stepIndex !== null
        ? fmt(t.stepN, { n: run.stepIndex + 1, step: stepTypeLabel(at, run.stepType) })
        : stepTypeLabel(at, run.stepType)
      : t.wholeRule;

  const runRows = runs.map((run) => {
    const name = (run.ruleId && ruleNames.get(run.ruleId)) ?? t.deletedRule;
    const result = <StatusBadge value={run.status} tone={RUN_TONE[run.status]} text={t[run.status]} />;
    const order = run.order ? (
      <ViewLink
        to={`/orders/${run.order.id}`}
        className="rounded-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <bdi dir="ltr">{run.order.orderNumber ?? "—"}</bdi>
      </ViewLink>
    ) : null;
    const when = (
      <time dateTime={run.createdAt} title={formatDateTime(run.createdAt)}>
        {formatRelativeTime(run.createdAt)}
      </time>
    );
    // The server's own words (or the platform's), in whatever language they came.
    const detail = run.detail ? (
      <span dir="auto" className={cn("wrap-anywhere", run.status === "failed" ? "text-danger" : "text-ink-soft")}>
        {runDetailText(runWords, run.detail)}
      </span>
    ) : null;
    if (compact) {
      return (
        <li key={run.id}>
          <ListRowCard
            title={<bdi dir="auto">{name}</bdi>}
            amount={order}
            status={result}
            meta={
              <>
                {stepName(run)} · {when}
              </>
            }
            footer={detail && <span className="text-xs leading-4">{detail}</span>}
          />
        </li>
      );
    }
    return (
      <DeskRow key={run.id}>
        <span className="text-xs whitespace-nowrap text-ink-soft">{when}</span>
        <div className="min-w-0">
          <p dir="auto" className="truncate text-sm leading-6 font-medium text-ink">
            {name}
          </p>
          <p className="truncate text-xs leading-5 text-ink-soft">{stepName(run)}</p>
        </div>
        <span className="text-sm">{order ?? "—"}</span>
        <div className="flex items-center">{result}</div>
        <p className="min-w-0 text-[13px] leading-5">{detail ?? <span className="text-ink-soft">—</span>}</p>
      </DeskRow>
    );
  });

  return (
    <div className="min-w-0 max-w-5xl">
      <PageHeader
        tutorial="automations"
        title={t.title}
        // A phone keeps the first screen for the automations: the sentence is for wider screens.
        description={phone ? undefined : t.description}
        primaryAction={newButton}
      />

      {integration.data && !integration.data.connected && (
        <Alert variant="default" className="mb-4 border-accent/40 bg-accent-soft text-accent-dark dark:text-accent">
          <p>
            {t.notConnected}{" "}
            <Link to="/settings#whatsapp" className="font-semibold underline">
              {t.connect}
            </Link>
          </p>
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <ChipRow items={chips} value={tab} onChange={selectTab} label={t.tabsLabel} collapseEmpty={false} countsLoading={rules.loading || templates.loading} />

        {tab === "rules" && (
          <DataState loading={rules.loading && !rules.data} error={rules.data ? null : rules.error} onRetry={() => void rules.refresh()} skeleton={cardsSkeleton}>
            {list.length === 0 ? (
              <EmptyState
                icon={<IconRobot aria-hidden />}
                title={t.noRules}
                description={t.noRulesDesc}
                action={
                  <Button type="button" className="rounded-full px-5" onClick={() => selectTab("templates")}>
                    <IconSparkle className="size-4" weight="bold" aria-hidden />
                    {t.seeTemplates}
                  </Button>
                }
              />
            ) : (
              <ul aria-label={t.tabRules} className="grid gap-[var(--bento-gap)] md:grid-cols-2">
                {list.map((rule) => {
                  const onPeek = () => setPeek({ id: rule.id, open: true });
                  const keys = rowKeyProps(onPeek);
                  return (
                    <li key={rule.id} className="min-w-0">
                      <ContextMenu items={menuFor(rule)} label={t.menuLabel}>
                        <Card
                          data-on={rule.isActive ? "" : undefined}
                          className="zimos-auto-card relative h-full gap-0 p-4 transition-[scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-safe:has-[[data-row-open]:active]:scale-[0.985] motion-reduce:transition-none"
                        >
                          {/* The card is one target: a button laid over it; the switch sits above it. */}
                          <div
                            role="button"
                            aria-haspopup="dialog"
                            aria-label={fmt(t.peek, { name: rule.name })}
                            data-row-open=""
                            {...keys}
                            onKeyDown={(event) => {
                              keys.onKeyDown(event);
                              if (event.key !== "Enter" || event.target !== event.currentTarget || event.defaultPrevented) return;
                              event.preventDefault();
                              onPeek();
                            }}
                            onClick={onPeek}
                            className="absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          />
                          <div className="flex items-start justify-between gap-3">
                            <h3 dir="auto" className="min-w-0 flex-1 truncate pt-2.5 text-[15px] leading-6 font-semibold text-ink">
                              {rule.name}
                            </h3>
                            <Switch
                              checked={rule.isActive}
                              busy={toggling === rule.id}
                              label={`${t.active}: ${rule.name}`}
                              onChange={(next) => void toggle(rule, next)}
                              className="-me-1"
                            />
                          </div>
                          {/* What starts it and what it does, in one sentence. */}
                          <p dir="auto" className={cn("mt-1 line-clamp-2 text-sm leading-6", rule.isActive ? "text-ink" : "text-ink-soft")}>
                            {fmt(t.sentence, { trigger: triggerLabel(at, rule.trigger), steps: rule.actions.map((step) => stepSummary(at, step)).join(t.stepJoin) })}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-ink-soft">
                            {fmt(t.stats, { sent: rule.stats.sent, skipped: rule.stats.skipped, failed: rule.stats.failed })}
                            {" · "}
                            {rule.stats.lastRunAt ? fmt(t.lastRun, { date: formatRelativeTime(rule.stats.lastRunAt) }) : t.never}
                          </p>
                        </Card>
                      </ContextMenu>
                    </li>
                  );
                })}
              </ul>
            )}
          </DataState>
        )}

        {tab === "templates" && (
          <DataState loading={templates.loading && !templates.data} error={templates.data ? null : templates.error} onRetry={() => void templates.refresh()} skeleton={cardsSkeleton}>
            {(templates.data ?? []).length === 0 ? (
              <EmptyState icon={<IconSparkle aria-hidden />} title={t.noTemplates} />
            ) : (
              <>
                <p className="px-1 text-[13px] leading-5 text-ink-soft">{t.templatesDesc}</p>
                <ul className="grid gap-[var(--bento-gap)] md:grid-cols-2 xl:grid-cols-3">
                  {(templates.data ?? []).map((template) => (
                    <li key={template.key} className="min-w-0">
                      <Card className="h-full gap-0 p-4">
                        <div className="flex items-start gap-3">
                          <span className="zimos-accordion-chip flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                            <IconSparkle className="size-[18px]" weight="duotone" aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-[15px] leading-6 font-semibold text-ink">{template.name[lang]}</h3>
                            <p className="mt-0.5 text-[13px] leading-5 text-ink-soft">{withoutSpecRefs(template.description[lang])}</p>
                          </div>
                        </div>
                        {template.whatsappTemplates.length > 0 && (
                          <div className="mt-2 empty:hidden">
                            <TemplateWhatsappBadge templateKey={template.key} version={whatsappVersion} />
                          </div>
                        )}
                        {template.acceptsCoupon && !template.ruleId && (
                          <Input
                            className="mt-3"
                            dir="ltr"
                            maxLength={100}
                            aria-label={t.templateCoupon}
                            placeholder={t.templateCoupon}
                            value={templateCoupons[template.key] ?? ""}
                            onChange={(e) => setTemplateCoupons((prev) => ({ ...prev, [template.key]: e.target.value }))}
                          />
                        )}
                        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                          {template.whatsappTemplates.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setMessagesOf(template)}
                              className="-mx-2 inline-flex min-h-11 cursor-pointer items-center rounded-full px-2 text-[13px] font-semibold text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              {t.viewMessages}
                            </button>
                          ) : (
                            <span />
                          )}
                          {template.ruleId ? (
                            <span className="inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-success">
                              <IconCheck className="size-4" weight="bold" aria-hidden />
                              {t.enabled}
                            </span>
                          ) : (
                            <RowAction label={t.enable} icon={IconPlay} busy={enabling === template.key} disabled={enabling !== null} onClick={() => void enableTemplate(template)} />
                          )}
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </DataState>
        )}

        {tab === "log" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                label={t.filter}
                size="sm"
                className="max-sm:w-full"
                value={runFilter}
                onChange={setRunFilter}
                options={[
                  { value: "all", label: t.all },
                  { value: "sent", label: t.sent },
                  { value: "skipped", label: t.skipped },
                  { value: "failed", label: t.failed },
                ]}
              />
              <Select aria-label={t.colRule} value={runRule} onChange={(e) => setRunRule(e.target.value)} className="h-11 rounded-full sm:ms-auto sm:h-10 sm:w-auto sm:max-w-60">
                <option value="">{t.allRules}</option>
                {list.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>
            <DataState loading={runsLoading} error={runs.length === 0 ? runsError : null} onRetry={() => void loadRuns(null)} skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={5} />}>
              {runs.length === 0 ? (
                <EmptyState icon={<IconChecklist aria-hidden />} title={t.noRuns} description={t.noRunsDesc} />
              ) : compact ? (
                <ul aria-label={t.tabLog} className="flex flex-col gap-2.5">
                  {runRows}
                </ul>
              ) : (
                <DeskList
                  columns="grid-cols-[max-content_minmax(0,1.1fr)_max-content_max-content_minmax(0,1.4fr)]"
                  label={t.tabLog}
                  head={[{ label: t.colTime }, { label: t.colRule }, { label: t.colOrder }, { label: t.colStatus }, { label: t.colDetail }]}
                >
                  {runRows}
                </DeskList>
              )}
              <LoadMore hasMore={Boolean(runsCursor)} loading={runsMore} onClick={() => void loadRuns(runsCursor)} />
            </DataState>
          </>
        )}
      </div>

      {/* The preview of an automation: every step, its numbers, and what can be done to it. */}
      {peeked && (
        <Sheet
          open={Boolean(peek?.open)}
          onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
          side="auto-end"
          title={<bdi dir="auto">{peeked.name}</bdi>}
          description={`${t.whenTrigger}: ${triggerLabel(at, peeked.trigger)}`}
          footer={
            <>
              <Button type="button" variant="outline" className="rounded-full px-5" onClick={() => showLogOf(peeked)}>
                <IconChecklist className="size-4" weight="bold" aria-hidden />
                {t.showLog}
              </Button>
              <Button
                type="button"
                className="rounded-full px-5"
                onClick={() => {
                  closePeek();
                  setEditing(peeked);
                }}
              >
                <IconEdit className="size-4" weight="bold" aria-hidden />
                {t.edit}
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            <div>
              <h3 className="text-[13px] leading-5 font-semibold text-ink-soft">{t.stepsTitle}</h3>
              <ol className="mt-2 space-y-2">
                {peeked.actions.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm leading-6">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold tabular-nums text-primary" aria-hidden>
                      {fmt("{n}", { n: i + 1 })}
                    </span>
                    <span className={cn("min-w-0 wrap-anywhere", step.type === "wait" ? "text-ink-soft" : "text-ink")} dir="auto">
                      {stepSummary(at, step)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <Facts>
              <Fact label={t.active}>
                <StatusBadge value={peeked.isActive ? "active" : "paused"} tone={peeked.isActive ? "success" : "neutral"} text={peeked.isActive ? t.enabled : t.off} />
              </Fact>
              <Fact label={t.statsTitle}>{fmt(t.stats, { sent: peeked.stats.sent, skipped: peeked.stats.skipped, failed: peeked.stats.failed })}</Fact>
              <Fact label={t.lastRunFact}>{peeked.stats.lastRunAt ? formatDateTime(peeked.stats.lastRunAt) : t.never}</Fact>
            </Facts>
            <div className="border-t border-line pt-3">
              <button
                type="button"
                onClick={() => {
                  closePeek();
                  setToDelete(peeked);
                }}
                className="-mx-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-semibold text-danger transition-[background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:active:scale-[0.97] motion-reduce:transition-none"
              >
                <IconDelete className="size-4" aria-hidden />
                {t.deleteRule}
              </button>
            </div>
          </div>
        </Sheet>
      )}

      {editing && rules.data && (
        <RuleEditorDialog
          key={editing === "new" ? "new" : editing.id}
          rule={editing === "new" ? null : editing}
          triggers={rules.data.triggers}
          tokens={rules.data.tokens}
          stepTypes={rules.data.stepTypes}
          onClose={() => setEditing(null)}
          onSaved={(_, created) => {
            setEditing(null);
            toast.success(created ? t.created : t.saved);
            void rules.refresh({ silent: true });
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t.deleteTitle}
        description={toDelete ? fmt(t.deleteDesc, { name: toDelete.name }) : undefined}
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        busyLabel={t.deleting}
        destructive
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await automationFlowsDelete(apiClient, workspaceId, toDelete.id);
          setToDelete(null);
          toast.success(t.deleted);
          await Promise.all([rules.refresh({ silent: true }), templates.refresh({ silent: true })]);
          void loadRuns(null, true);
        }}
      />

      {/* Nothing is typed here: a plain sheet, so closing it never asks. */}
      <Sheet
        open={Boolean(messagesOf)}
        onOpenChange={(open) => {
          if (!open) setMessagesOf(null);
        }}
        title={messagesOf ? fmt(t.messagesTitle, { name: messagesOf.name[lang] }) : ""}
        description={t.messagesDesc}
        footer={
          <Button type="button" className="rounded-full px-5" onClick={() => setMessagesOf(null)}>
            {t.close}
          </Button>
        }
      >
        <div className="space-y-3">
          {(messagesOf?.whatsappTemplates ?? []).map((m) => (
            <div key={m.name} data-slot="sweep-well" className="rounded-2xl bg-paper-sunken px-4 py-3">
              <p className="text-xs text-ink-soft">{t.templateName}</p>
              <code dir="ltr" className="block text-start font-mono text-sm text-ink select-all">
                {m.name}
              </code>
              <p dir="rtl" className="mt-2 rounded-xl bg-paper-raised p-3 text-sm leading-6 whitespace-pre-wrap text-ink select-all">
                {m.body}
              </p>
              {m.buttons && m.buttons.length > 0 && (
                <p className="mt-2 text-xs text-ink-soft">
                  {t.buttons}:{" "}
                  {m.buttons.map((b) => (
                    <span key={b} dir="rtl" className="me-1 inline-block rounded-full bg-paper-raised px-2.5 py-0.5 text-ink ring-1 ring-line">
                      {b}
                    </span>
                  ))}
                </p>
              )}
            </div>
          ))}
          {messagesOf && messagesOf.whatsappTemplates.length > 0 && (
            <TemplateWhatsappPanel
              key={messagesOf.key}
              templateKey={messagesOf.key}
              couponCode={messagesOf.acceptsCoupon ? (templateCoupons[messagesOf.key] ?? "").trim() || undefined : undefined}
              onChanged={() => {
                setWhatsappVersion((current) => current + 1);
                void Promise.all([rules.refresh({ silent: true }), templates.refresh({ silent: true })]);
              }}
            />
          )}
        </div>
      </Sheet>
    </div>
  );
}
