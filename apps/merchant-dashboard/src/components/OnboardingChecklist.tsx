import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Check, Globe, LayoutTemplate, Package, ShoppingBag, Truck, Workflow, X } from "lucide-react";
import { domainsList, funnelsList } from "@store-builder/api-client";
import { Card, cn, useAsync } from "@store-builder/ui";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
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
    stepDone: "Done",
    stepTodo: "Not done yet",
    start: "Start",
    review: "Review",
    productTitle: "Add your first product",
    productDesc: "Photos, price and variants.",
    websiteTitle: "Publish your website",
    websiteDesc: "Pick a template and put your store online.",
    shippingTitle: "Set up shipping zones",
    shippingDesc: "Choose where you deliver and your rates.",
    domainTitle: "Connect a domain",
    domainDesc: "Use your own web address.",
    funnelTitle: "Create your first funnel",
    funnelDesc: "A focused page that turns visits into orders.",
    orderTitle: "Get your first order",
    orderDesc: "Share your store and receive an order.",
  },
  ar: {
    title: "جهّز متجرك",
    subtitle: "كام خطوة بسيطة عشان تستقبل أول طلباتك.",
    progress: "خلصت {done} من {total}",
    dismiss: "اخفي قائمة التجهيز",
    readyTitle: "متجرك جاهز",
    readySubtitle: "كل خطوات التجهيز خلصت. تقدر تخفي الكارت ده.",
    stepDone: "خلصت",
    stepTodo: "لسه",
    start: "ابدأ",
    review: "راجع",
    productTitle: "ضيف أول منتج",
    productDesc: "الصور والسعر والاختيارات.",
    websiteTitle: "انشر موقعك",
    websiteDesc: "اختار قالب ونزّل متجرك أونلاين.",
    shippingTitle: "جهّز مناطق الشحن",
    shippingDesc: "حدد بتوصّل فين وبكام.",
    domainTitle: "اربط دومين",
    domainDesc: "استخدم عنوان موقع خاص بيك.",
    funnelTitle: "اعمل أول فانل",
    funnelDesc: "صفحة مركّزة بتحوّل الزيارات لطلبات.",
    orderTitle: "استقبل أول طلب",
    orderDesc: "شارك متجرك واستقبل طلب.",
  },
};

type StepId = "product" | "website" | "shipping" | "domain" | "funnel" | "order";

const STEPS: Array<{ id: StepId; to: string; icon: LucideIcon }> = [
  { id: "product", to: "/onboarding?step=product", icon: Package },
  { id: "website", to: "/website", icon: LayoutTemplate },
  { id: "shipping", to: "/onboarding?step=delivery", icon: Truck },
  { id: "domain", to: "/settings", icon: Globe },
  { id: "funnel", to: "/funnels", icon: Workflow },
  { id: "order", to: "/orders", icon: ShoppingBag },
];

type Detected = Partial<Record<StepId, boolean>>;

/** A failed check just leaves that step unticked instead of hiding the whole card. */
async function check(fn: () => Promise<boolean>): Promise<boolean> {
  try {
    return await fn();
  } catch {
    return false;
  }
}

/** Home-page setup checklist. Every step is detected from real store data. */
export function OnboardingChecklist() {
  const t = useT(STRINGS);
  const ws = useWorkspaceId();
  const [dismissed, setDismissed] = useLocalStorage<boolean>(`zimos.onboarding.${ws}.dismissed`, false);

  const detected = useAsync(async (): Promise<Detected> => {
    if (!ws) return {};
    const [product, website, shipping, domain, funnel, order] = await Promise.all([
      check(async () => (await apiClient.listProducts(ws, { limit: 1 })).products.length > 0),
      check(async () => (await apiClient.listWebsites(ws)).some((w) => w.status === "published")),
      check(async () => (await apiClient.listShippingZones(ws)).length > 0),
      check(async () => (await domainsList(apiClient, ws)).some((d) => d.status === "verified" || d.status === "active")),
      check(async () => (await funnelsList(apiClient, ws)).length > 0),
      check(async () => (await apiClient.listOrders(ws, { limit: 1 })).orders.length > 0),
    ]);
    return { product, website, shipping, domain, funnel, order };
  }, [ws]);

  if (dismissed) return null;

  const auto = detected.data ?? {};
  const isDone = (id: StepId) => Boolean(auto[id]);
  const doneCount = STEPS.filter((s) => isDone(s.id)).length;
  const total = STEPS.length;
  const allDone = doneCount === total;
  const ratio = doneCount / total;

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

      <ul className="grid gap-2 p-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-3">
        {STEPS.map((step) => {
          const done = isDone(step.id);
          const title = t[`${step.id}Title`];
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-3 transition-colors",
                done ? "border-line bg-paper" : "border-line bg-paper-raised hover:border-line-strong"
              )}
            >
              <span
                role="img"
                aria-label={done ? t.stepDone : t.stepTodo}
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                  done ? "border-primary bg-primary text-white" : "border-line-strong"
                )}
              >
                {done && <Check className="size-3" strokeWidth={3} aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("flex items-center gap-1.5 text-sm font-medium", done ? "text-ink-muted line-through decoration-line-strong" : "text-ink")}>
                  <step.icon className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="truncate">{title}</span>
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">{t[`${step.id}Desc`]}</p>
                <Link to={step.to} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
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
