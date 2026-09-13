import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Check,
  Globe,
  HandCoins,
  LayoutTemplate,
  MessageCircle,
  Package,
  Target,
  Truck,
  Workflow,
  X,
} from "lucide-react";
import { Card, cn } from "@store-builder/ui";
import { fmt, useT } from "@/i18n/LocaleContext";
import { mockApi } from "@/mock/api";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { formatNumber, formatPercentValue } from "@/lib/format";

const STRINGS = {
  en: {
    title: "Set up your store",
    subtitle: "A few steps to get ready for your first orders.",
    progress: "{done} of {total} complete",
    dismiss: "Dismiss setup checklist",
    readyTitle: "Your store is ready",
    readySubtitle: "Every setup step is done. You can hide this card.",
    markDone: "Mark “{step}” as done",
    markUndone: "Mark “{step}” as not done",
    detected: "Detected automatically",
    start: "Start",
    review: "Review",
    productTitle: "Add your first product",
    productDesc: "Photos, price and variants.",
    templateTitle: "Choose a template",
    templateDesc: "Pick a look for your storefront.",
    domainTitle: "Connect a domain",
    domainDesc: "Use your own web address.",
    shippingTitle: "Set up shipping & carriers",
    shippingDesc: "Connect a carrier and set your rates.",
    codTitle: "Enable cash on delivery",
    codDesc: "Let customers pay when the order arrives.",
    whatsappTitle: "Connect WhatsApp",
    whatsappDesc: "Confirm orders and reply to customers.",
    adsTitle: "Connect your ad account",
    adsDesc: "Track spend and profit per campaign.",
    funnelTitle: "Launch your first funnel",
    funnelDesc: "A focused page that turns visits into orders.",
  },
  ar: {
    title: "جهّز متجرك",
    subtitle: "خطوات قليلة لتستعد لاستقبال أول طلباتك.",
    progress: "اكتمل {done} من {total}",
    dismiss: "إخفاء قائمة الإعداد",
    readyTitle: "متجرك جاهز",
    readySubtitle: "اكتملت كل خطوات الإعداد. يمكنك إخفاء هذه البطاقة.",
    markDone: "تعليم «{step}» كمكتملة",
    markUndone: "تعليم «{step}» كغير مكتملة",
    detected: "تم اكتشافها تلقائيًا",
    start: "ابدأ",
    review: "مراجعة",
    productTitle: "أضف منتجك الأول",
    productDesc: "الصور والسعر والخيارات.",
    templateTitle: "اختر قالبًا",
    templateDesc: "اختر شكل واجهة متجرك.",
    domainTitle: "اربط نطاقًا",
    domainDesc: "استخدم عنوان موقعك الخاص.",
    shippingTitle: "إعداد الشحن وشركات الشحن",
    shippingDesc: "اربط شركة شحن وحدّد أسعارك.",
    codTitle: "فعّل الدفع عند الاستلام",
    codDesc: "اسمح للعملاء بالدفع عند وصول الطلب.",
    whatsappTitle: "اربط واتساب",
    whatsappDesc: "أكّد الطلبات وتواصل مع عملائك.",
    adsTitle: "اربط حسابك الإعلاني",
    adsDesc: "تابع الإنفاق والربح لكل حملة.",
    funnelTitle: "أطلق أول مسار بيع",
    funnelDesc: "صفحة مركّزة تحوّل الزيارات إلى طلبات.",
  },
};

type StepId = "product" | "template" | "domain" | "shipping" | "cod" | "whatsapp" | "ads" | "funnel";

const STEPS: Array<{ id: StepId; to: string; icon: LucideIcon }> = [
  { id: "product", to: "/catalog/new", icon: Package },
  { id: "template", to: "/templates", icon: LayoutTemplate },
  { id: "domain", to: "/settings", icon: Globe },
  { id: "shipping", to: "/shipping", icon: Truck },
  { id: "cod", to: "/payments", icon: HandCoins },
  { id: "whatsapp", to: "/inbox/bot", icon: MessageCircle },
  { id: "ads", to: "/ads", icon: Target },
  { id: "funnel", to: "/funnels", icon: Workflow },
];

type Detected = Partial<Record<StepId, boolean>>;

/** Home-page setup checklist. Manual ticks + auto-detection from mock data, persisted per store. */
export function OnboardingChecklist() {
  const t = useT(STRINGS);
  const ws = useWorkspaceId();
  const [manual, setManual] = useLocalStorage<StepId[]>(`zimos.onboarding.${ws}.done`, []);
  const [dismissed, setDismissed] = useLocalStorage<boolean>(`zimos.onboarding.${ws}.dismissed`, false);

  const detected = useAsync(async (): Promise<Detected> => {
    if (!ws) return {};
    try {
      const [domains, carriers, gateways, waBot, adAccounts, funnels] = await Promise.all([
        mockApi.listDomains(ws),
        mockApi.listCarrierAccounts(ws),
        mockApi.listGateways(ws),
        mockApi.getWaBot(ws),
        mockApi.listAdAccounts(ws),
        mockApi.listFunnels(ws),
      ]);
      return {
        domain: domains.some((d) => d.status === "verified" || d.status === "active"),
        shipping: carriers.some((c) => c.status === "connected"),
        cod: gateways.some((g) => g.key === "cod" && g.enabled),
        whatsapp: waBot.connected,
        ads: adAccounts.some((a) => a.status === "connected"),
        funnel: funnels.some((f) => f.status === "published"),
      };
    } catch {
      return {};
    }
  }, [ws]);

  if (dismissed) return null;

  const auto = detected.data ?? {};
  const isDone = (id: StepId) => Boolean(auto[id]) || manual.includes(id);
  const doneCount = STEPS.filter((s) => isDone(s.id)).length;
  const total = STEPS.length;
  const allDone = doneCount === total;
  const ratio = doneCount / total;

  const toggleManual = (id: StepId) =>
    setManual((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{allDone ? t.readyTitle : t.title}</h2>
          <p className="mt-0.5 text-sm text-ink-soft">{allDone ? t.readySubtitle : t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t.dismiss}
          title={t.dismiss}
          className="-me-1.5 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-ink-muted transition-colors hover:bg-primary-soft hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="flex items-center gap-3 px-5 pt-4 sm:px-6">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-zimos-ice dark:bg-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={doneCount}
          aria-valuetext={fmt(t.progress, { done: formatNumber(doneCount), total: formatNumber(total) })}
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${ratio * 100}%` }} />
        </div>
        <span className="tabular shrink-0 text-xs font-medium text-ink-soft">
          {fmt(t.progress, { done: formatNumber(doneCount), total: formatNumber(total) })} · {formatPercentValue(ratio, 0)}
        </span>
      </div>

      <ul className="grid gap-2 p-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4">
        {STEPS.map((step) => {
          const done = isDone(step.id);
          const autoDone = Boolean(auto[step.id]);
          const title = t[`${step.id}Title`];
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-3 transition-colors",
                done ? "border-line bg-paper" : "border-line bg-paper-raised hover:border-line-strong"
              )}
            >
              <button
                type="button"
                onClick={() => !autoDone && toggleManual(step.id)}
                disabled={autoDone}
                aria-pressed={done}
                aria-label={fmt(done ? t.markUndone : t.markDone, { step: title })}
                title={autoDone ? t.detected : fmt(done ? t.markUndone : t.markDone, { step: title })}
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  done ? "border-primary bg-primary text-white" : "cursor-pointer border-line-strong hover:border-primary",
                  autoDone && "cursor-default"
                )}
              >
                {done && <Check className="size-3" strokeWidth={3} aria-hidden />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("flex items-center gap-1.5 text-sm font-medium", done ? "text-ink-muted line-through decoration-line-strong" : "text-ink")}>
                  <step.icon className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="truncate">{title}</span>
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">{t[`${step.id}Desc`]}</p>
                <Link
                  to={step.to}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {done ? t.review : t.start}
                  <ArrowRight className="size-3 rtl:-scale-x-100" aria-hidden />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
