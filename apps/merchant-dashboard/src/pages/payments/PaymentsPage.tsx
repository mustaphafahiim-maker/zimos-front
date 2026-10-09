import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Alert } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { UnsavedGuardProvider, useUnsavedGuard } from "@/lib/useUnsavedGuard";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { IconBank, IconCard, IconCash, IconChecklist, IconCoins, IconLock, IconPercent } from "@/components/icons";
import { DataState, StateMessage } from "@/components/DataState";
import { TutorialLink } from "@/components/Education";
import { PageHeader } from "@/components/PageHeader";
import { SettingsLayout, SettingsPane, type SettingsSectionDef } from "@/components/settings";
import { ManualTransferSettings } from "./ManualTransferSettings";
import { PaymentRulesSettings } from "./PaymentRulesSettings";
import { CurrencySettings } from "./CurrencySettings";
import { CheckoutMethodsSection } from "./sections/CheckoutMethodsSection";
import { CodSection } from "./sections/CodSection";
import { GatewaysSection } from "./sections/GatewaysSection";
import { PaneSkeleton } from "./sections/paneParts";
// Handoff 384 / 377: the way to the online payments ledger, payouts and disputes.
import { PaymentLedgerLink } from "./ledger/PaymentLedgerLink";
// Handoff 340: InstaPay accounts and wallet numbers shoppers pay to, then send a screenshot.
import { StoreMethodsSettings } from "./StoreMethodsSettings";

/**
 * Role keys that manage payments: the backend gates every /payments call on
 * workspace.manage, which only the owner ("*") and the workspace manager hold
 * among the system roles. A custom role reads as view-only here, and a 403
 * flips the page to view-only.
 */
const PAYMENT_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager"]);

const STRINGS = {
  en: {
    title: "Payments",
    description: "How your customers pay you: cash on delivery, your own gateway for cards and wallets, and direct transfers.",
    search: "Search payments…",
    viewOnlyTitle: "Payments aren't in your role",
    viewOnly: "Only the store owner or a workspace manager can manage payments.",
    viewOnlyForbidden: "Your role can't manage payments, so this is shown read-only.",
    offlineNotice:
      "Online checkout isn't live on the platform yet, so shoppers only see cash on delivery for now. You can connect and test your gateway already; nothing changes for shoppers until it goes live.",
    cod: "Cash on delivery",
    codList: "On or off at checkout, the deposit, settlements",
    codPane: "How most of your orders are paid: the shopper pays the courier at the door.",
    gateways: "Payment gateways",
    gatewaysList: "Cards and wallets through your own account",
    gatewaysPane: "Connect your own payment gateway so shoppers can pay by card or wallet. The money goes straight to your gateway account.",
    methods: "Checkout methods",
    methodsList: "What shoppers see, and in what order",
    methodsPane: "Choose which methods shoppers see at checkout and in what order.",
    transfer: "Bank transfer and wallets",
    transferList: "InstaPay, Vodafone Cash, a bank account",
    transferPane:
      "Let customers pay by InstaPay, Vodafone Cash or bank transfer: they see your instructions at checkout and upload a photo of the receipt. You confirm each transfer from the order.",
    rules: "Payment rules",
    rulesList: "A fee or a discount by payment method",
    rulesPane: "Add a fee or give a discount depending on how the customer pays. It appears as its own line in the order.",
    currencies: "Currencies",
    currenciesList: "The store's currency and the ones shoppers see",
    currenciesPane: "Your store sells and collects in its own currency. You can also show prices in other currencies for visitors from abroad.",
  },
  ar: {
    title: "المدفوعات",
    description: "عملاءك بيدفعولك إزاي: الدفع عند الاستلام، بوابة الدفع بتاعتك للكارت والمحفظة، والتحويل المباشر.",
    search: "دوّر في المدفوعات…",
    viewOnlyTitle: "المدفوعات مش ضمن صلاحياتك",
    viewOnly: "صاحب المتجر أو مدير مساحة العمل بس اللي يقدر يدير المدفوعات.",
    viewOnlyForbidden: "دورك مش بيسمح بإدارة المدفوعات، فهي ظاهرة للعرض بس.",
    offlineNotice:
      "الدفع الأونلاين لسه ما اتفعّلش على المنصة، فالعملاء بيشوفوا الدفع عند الاستلام بس دلوقتي. تقدر تربط البوابة وتجرّبها من دلوقتي، ومفيش حاجة هتتغيّر للعملاء قبل التفعيل.",
    cod: "الدفع عند الاستلام",
    codList: "ظهوره في الفورم، العربون، التحصيل",
    codPane: "أغلب أوردراتك بتتدفع كده: العميل بيدفع للمندوب على الباب.",
    gateways: "بوابات الدفع",
    gatewaysList: "كارت ومحفظة على حسابك إنت",
    gatewaysPane: "اربط بوابة الدفع بتاعتك علشان العملاء يدفعوا بالكارت أو المحفظة. الفلوس بتروح على طول لحساب البوابة بتاعك.",
    methods: "طرق الدفع في الفورم",
    methodsList: "اللي العميل بيشوفه، وترتيبه",
    methodsPane: "اختار الطرق اللي العملاء بيشوفوها في الفورم وترتيبها.",
    transfer: "التحويل البنكي والمحافظ",
    transferList: "إنستاباي، فودافون كاش، حساب بنكي",
    transferPane:
      "خلّي العملاء يدفعوا بإنستاباي أو فودافون كاش أو تحويل بنكي: بيشوفوا تعليماتك في الفورم ويرفعوا صورة الإيصال، وإنت بتأكّد كل تحويل من صفحة الأوردر.",
    rules: "قواعد الدفع",
    rulesList: "رسوم أو خصم حسب طريقة الدفع",
    rulesPane: "ضيف رسوم أو ادّي خصم حسب طريقة دفع العميل، وبيظهر بند لوحده في الأوردر.",
    currencies: "العملات",
    currenciesList: "عملة المتجر والعملات اللي العملاء بيشوفوها",
    currenciesPane: "متجرك بيبيع ويحصّل بعملته. وتقدر كمان تعرض الأسعار بعملات تانية للزوار من برّه.",
  },
} satisfies Messages;

type SectionId = "cod" | "gateways" | "methods" | "transfer" | "rules" | "currencies";

/** Other words a link might use for a section (`?tab=`): each lands on the section that holds it. */
const TAB_ALIASES: Record<string, SectionId> = {
  "cash-on-delivery": "cod",
  deposit: "cod",
  gateway: "gateways",
  "checkout-methods": "methods",
  transfers: "transfer",
  "manual-transfer": "transfer",
  bank: "transfer",
  "payment-rules": "rules",
  fees: "rules",
  currency: "currencies",
};

/** Tailwind's `lg`, where `SettingsLayout` puts the list beside the pane. */
const DESKTOP = "(min-width: 64rem)";

/**
 * /payments — System Settings layout: the sections on the side (a list that
 * pushes to a section on a phone), one section in the pane, the section in
 * `?tab=`. Cash on delivery comes first: it is how these stores are paid.
 */
export function PaymentsPage() {
  const workspaceId = useWorkspaceId();
  return (
    <UnsavedGuardProvider>
      {/* Keyed by store: nothing typed for one store leaks into another. */}
      <PaymentsBody key={workspaceId} workspaceId={workspaceId} />
    </UnsavedGuardProvider>
  );
}

function PaymentsBody({ workspaceId }: { workspaceId: string }) {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  const { confirmLeave } = useUnsavedGuard();
  const roleAllows = PAYMENT_ROLES.has(currentWorkspace?.role ?? "");
  const [forbidden, setForbidden] = useState(false);
  const canManage = roleAllows && !forbidden;
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";

  const gateways = useAsync(
    () => (roleAllows ? apiClient.listPaymentGateways(workspaceId) : Promise.resolve(null)),
    [workspaceId, roleAllows]
  );
  const methods = useAsync(
    () => (roleAllows ? apiClient.listPaymentMethods(workspaceId) : Promise.resolve(null)),
    [workspaceId, roleAllows]
  );
  const list = gateways.data;
  // false: the platform has no gateway key store. Then only COD, the "not on yet" note and transfers exist, as before.
  const configured = list ? list.configured : null;

  function refreshAll() {
    void gateways.refresh({ silent: true });
    void methods.refresh({ silent: true });
  }

  const connectedCount = list?.gateways.filter((g) => g.connection).length ?? 0;
  const sections = useMemo<SettingsSectionDef[]>(() => {
    const all: Array<SettingsSectionDef & { id: SectionId }> = [
      {
        id: "cod",
        label: t.cod,
        description: t.codList,
        icon: IconCash,
        tone: "green",
        keywords: ["cod", "cash", "deposit", "settlement", "كاش", "عربون", "تحصيل", "مندوب", "استلام"],
      },
      {
        id: "gateways",
        label: t.gateways,
        description: t.gatewaysList,
        icon: IconCard,
        tone: "blue",
        badge: connectedCount > 0 ? connectedCount : undefined,
        keywords: ["gateway", "paymob", "kashier", "stripe", "paypal", "card", "visa", "webhook", "keys", "بوابة", "كارت", "فيزا", "محفظة", "مفاتيح", "ربط"],
      },
      {
        id: "methods",
        label: t.methods,
        description: t.methodsList,
        icon: IconChecklist,
        tone: "purple",
        keywords: ["checkout", "methods", "order", "apple pay", "google pay", "valu", "kiosk", "ترتيب", "طرق", "فورم", "تقسيط"],
      },
      {
        id: "transfer",
        label: t.transfer,
        description: t.transferList,
        icon: IconBank,
        tone: "teal",
        keywords: ["instapay", "vodafone cash", "bank", "wallet", "receipt", "transfer", "إنستاباي", "انستاباي", "فودافون كاش", "بنك", "إيصال", "تحويل"],
      },
      {
        id: "rules",
        label: t.rules,
        description: t.rulesList,
        icon: IconPercent,
        tone: "orange",
        keywords: ["fee", "discount", "funnel", "rules", "رسوم", "خصم", "مسار", "قواعد"],
      },
      {
        id: "currencies",
        label: t.currencies,
        description: t.currenciesList,
        icon: IconCoins,
        tone: "gray",
        keywords: ["currency", "exchange", "rate", "usd", "egp", "عملة", "سعر الصرف", "دولار", "جنيه"],
      },
    ];
    // Where online payments are not set up, the methods, rules and currencies never showed.
    return configured === false ? all.filter((s) => s.id === "cod" || s.id === "gateways" || s.id === "transfer") : all;
  }, [t, configured, connectedCount]);

  // The section lives in ?tab=. Phone: list → section is a new history entry, so Back returns to the list.
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const raw = params.get("tab");
  const named = raw === null ? null : (TAB_ALIASES[raw] ?? raw);
  const current = named !== null && sections.some((s) => s.id === named) ? (named as SectionId) : null;
  const pushedFromList = (location.state as { paymentsList?: boolean } | null)?.paymentsList === true;

  const select = useCallback(
    (id: string | null) => {
      if (id === null) {
        // Back to the list: undo the push that opened the section, when there was one.
        if (pushedFromList) {
          navigate(-1);
          return;
        }
        setParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("tab");
            return next;
          },
          { replace: true }
        );
        return;
      }
      const fromPhoneList = current === null && !window.matchMedia(DESKTOP).matches;
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", id);
          return next;
        },
        fromPhoneList ? { state: { paymentsList: true } } : { replace: true, state: location.state }
      );
    },
    [current, pushedFromList, navigate, setParams, location.state]
  );

  /** A jump from inside a pane to another section: asks first when something is unsaved. */
  const goto = useCallback(
    async (id: SectionId) => {
      if (await confirmLeave()) select(id);
    },
    [confirmLeave, select]
  );

  if (!roleAllows) {
    // Exactly as before: other roles get the reason and nothing else.
    return (
      <div className="mx-auto w-full max-w-[46rem]">
        <PageHeader tutorial="payments" title={t.title} description={t.description} />
        <StateMessage role="status" icon={<IconLock aria-hidden />} title={t.viewOnlyTitle} description={t.viewOnly} />
        {/* The ledger has its own permission (financial_reports.view): an accountant still gets there. */}
        <PaymentLedgerLink className="mt-4" />
      </div>
    );
  }

  const shownId: SectionId = current ?? (sections[0]?.id as SectionId | undefined) ?? "cod";
  const notices = (online: boolean) => (
    <>
      {forbidden && <Alert>{t.viewOnlyForbidden}</Alert>}
      {online && list && list.configured && !list.onlineEnabled && <Alert>{t.offlineNotice}</Alert>}
    </>
  );

  let pane: ReactNode;
  switch (shownId) {
    case "gateways":
      pane = (
        <SettingsPane title={t.gateways} description={t.gatewaysPane} icon={IconCard} tone="blue">
          {notices(true)}
          <DataState loading={gateways.loading} error={gateways.error} onRetry={() => void gateways.refresh()} skeleton={<PaneSkeleton rows={3} />}>
            {list && <GatewaysSection list={list} canManage={canManage} onForbidden={() => setForbidden(true)} onChanged={refreshAll} />}
          </DataState>
        </SettingsPane>
      );
      break;
    case "methods":
      pane = (
        <SettingsPane title={t.methods} description={t.methodsPane} icon={IconChecklist} tone="purple">
          {notices(true)}
          <DataState
            loading={gateways.loading || methods.loading}
            error={gateways.error ?? methods.error}
            onRetry={refreshAllLoud}
            skeleton={<PaneSkeleton rows={4} />}
          >
            {methods.data && list && (
              <CheckoutMethodsSection
                key={JSON.stringify(methods.data.methods.map((m) => [m.id, m.enabled, m.available]))}
                methods={methods.data.methods}
                gateways={list.gateways}
                canManage={canManage}
                onForbidden={() => setForbidden(true)}
                onSaved={(next) => methods.setData((prev) => ({ onlineEnabled: prev?.onlineEnabled ?? false, methods: next }))}
              />
            )}
          </DataState>
        </SettingsPane>
      );
      break;
    case "transfer":
      pane = (
        <SettingsPane title={t.transfer} description={t.transferPane} icon={IconBank} tone="teal">
          {notices(false)}
          <ManualTransferSettings
            workspaceId={workspaceId}
            canManage={canManage}
            onForbidden={() => setForbidden(true)}
            onGoto={(id) => void goto(id)}
          />
          <StoreMethodsSettings workspaceId={workspaceId} canManage={canManage} onForbidden={() => setForbidden(true)} />
        </SettingsPane>
      );
      break;
    case "rules":
      pane = (
        <SettingsPane title={t.rules} description={t.rulesPane} icon={IconPercent} tone="orange">
          {notices(false)}
          <DataState loading={methods.loading} error={methods.error} onRetry={() => void methods.refresh()} skeleton={<PaneSkeleton rows={6} />}>
            {methods.data && <PaymentRulesSettings workspaceId={workspaceId} methods={methods.data.methods} canManage={canManage} />}
          </DataState>
        </SettingsPane>
      );
      break;
    case "currencies":
      pane = (
        <SettingsPane title={t.currencies} description={t.currenciesPane} icon={IconCoins} tone="gray">
          {notices(false)}
          <CurrencySettings workspaceId={workspaceId} canManage={canManage} />
        </SettingsPane>
      );
      break;
    default:
      pane = (
        <SettingsPane title={t.cod} description={t.codPane} icon={IconCash} tone="green">
          {notices(false)}
          <CodSection
            workspaceId={workspaceId}
            currency={currency}
            canManage={canManage}
            methods={configured === false ? null : (methods.data?.methods ?? null)}
            methodsLoading={methods.loading}
            methodsError={methods.error}
            onRetryMethods={() => void methods.refresh()}
            configured={configured ?? (gateways.error ? true : null)}
            hasRules={sections.some((s) => s.id === "rules")}
            onForbidden={() => setForbidden(true)}
            onMethodsSaved={(next) => methods.setData((prev) => ({ onlineEnabled: prev?.onlineEnabled ?? false, methods: next }))}
            onGoto={(id) => void goto(id)}
          />
        </SettingsPane>
      );
  }

  function refreshAllLoud() {
    void gateways.refresh();
    void methods.refresh();
  }

  return (
    <SettingsLayout
      title={t.title}
      sections={sections}
      current={current}
      onSelect={select}
      canLeave={confirmLeave}
      searchPlaceholder={t.search}
      listHeader={
        <div className="px-1 lg:px-2">
          <p className="text-sm leading-5 text-ink-soft">{t.description}</p>
          <TutorialLink topic="payments" />
          <PaymentLedgerLink className="mt-3" />
        </div>
      }
    >
      {pane}
    </SettingsLayout>
  );
}
