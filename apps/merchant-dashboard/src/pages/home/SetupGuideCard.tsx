import { useState } from "react";
import { Link } from "react-router-dom";
import { IconCaretLeft, IconCircle, IconClose, IconSuccess } from "@/components/icons";
import { Card, cn } from "@store-builder/ui";
import { dashboardSetupGuide, type SetupStepKey } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatPercentValue } from "@/lib/format";
import { storeUrl } from "@/lib/storeAddress";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { useCustomDomainsClosed } from "@/pages/storeDesign/customDomainsGate";

const STRINGS = {
  en: {
    title: "Get your store ready",
    progress: "{completed} of {total} steps done",
    optional: "Optional",
    hide: "Hide the setup guide",
    go: "Set up",
    product: "Add your first product",
    productHint: "A name, a price, a quantity and a photo are enough to start.",
    website: "Publish your store",
    websiteHint: "Pick a template, adjust it and publish.",
    payment: "Choose how customers pay",
    paymentHint: "Cash on delivery works from day one; add a gateway for cards.",
    shipping: "Set up shipping",
    shippingHint: "Connect a courier or set a delivery price per governorate.",
    domain: "Connect your own domain",
    domainHint: "Sell on yourstore.com instead of the Zimos address.",
    pixel: "Add an ad pixel",
    pixelHint: "So Meta, TikTok or Snapchat can measure your campaigns.",
    order: "Place a test order",
    orderHint: "Order from your own store to see the whole loop: confirm, ship, deliver.",
    next: "Next step",
    doneLabel: "Done",
  },
  ar: {
    title: "جهّز متجرك",
    progress: "خلصت {completed} من {total} خطوات",
    optional: "اختياري",
    hide: "اخفي دليل التجهيز",
    go: "ابدأ",
    product: "ضيف أول منتج",
    productHint: "اسم وسعر وكمية وصورة كفاية عشان تبدأ.",
    website: "انشر متجرك",
    websiteHint: "اختار قالب، عدّله وانشره.",
    payment: "اختار طرق الدفع",
    paymentHint: "الدفع عند الاستلام شغال من أول يوم؛ ضيف بوابة دفع للكروت.",
    shipping: "جهّز الشحن",
    shippingHint: "اربط شركة شحن أو حط سعر توصيل لكل محافظة.",
    domain: "اربط الدومين بتاعك",
    domainHint: "بيع على yourstore.com بدل عنوان زيموس.",
    pixel: "ضيف بيكسل الإعلانات",
    pixelHint: "عشان ميتا أو تيك توك أو سناب شات يقيسوا حملاتك.",
    order: "اعمل أوردر تجريبي",
    orderHint: "اطلب من متجرك بنفسك وشوف الدورة كلها: تأكيد، شحن، تسليم.",
    next: "الخطوة الجاية",
    doneLabel: "خلصت",
  },
} satisfies Messages;

const STEP_LINK: Record<SetupStepKey, string> = {
  product: "/catalog/new",
  website: "/website",
  payment: "/payments",
  shipping: "/shipping",
  // Domains live under Store settings (the old "/settings" link had no domain section).
  domain: "/store-settings/domains",
  pixel: "/marketing",
  order: "/orders",
};

const hiddenKey = (workspaceId: string) => `zimos.setupGuide.hidden.${workspaceId}`;

/**
 * Setup guide (SPEC §18.6): the launch checklist on the home page, ticked from
 * what the store really has. It leaves on its own once every required step is
 * done, and can be hidden before that.
 */
export function SetupGuideCard({ className = "mb-[var(--bento-gap)]" }: { className?: string }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const guide = useAsync(() => dashboardSetupGuide(apiClient, workspaceId), [workspaceId]);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(hiddenKey(workspaceId)) === "1";
    } catch {
      return false;
    }
  });

  // Asked only while the guide still offers the domain step.
  const domainsClosed = useCustomDomainsClosed(!hidden && Boolean(guide.data && !guide.data.done && guide.data.steps.some((step) => step.key === "domain" && !step.done)));

  // The home page already has its own loading and error states; the guide is
  // an extra, so it only appears once it has something to say.
  if (hidden || !guide.data || guide.data.done) return null;
  const { steps, completed, total, percent } = guide.data;
  // Custom domains closed on this server (handoff 341): the step has nowhere to go, so it is not offered.
  const todo = steps.filter((step) => !step.done && !(step.key === "domain" && domainsClosed));
  // Required steps first: the next one is the first required step not done yet.
  const next = todo.find((step) => !step.optional) ?? todo[0] ?? null;
  const rest = todo.filter((step) => step !== next);
  const done = steps.filter((step) => step.done);
  const storeLink = currentWorkspace?.slug ? storeUrl(currentWorkspace.slug) : null;

  function hide() {
    setHidden(true);
    try {
      localStorage.setItem(hiddenKey(workspaceId), "1");
    } catch {
      /* private mode — hidden for this visit only */
    }
  }

  return (
    <Card className={cn("gap-0 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink">{t.title}</h2>
          <p className="mt-0.5 text-sm text-ink-soft">{fmt(t.progress, { completed, total })}</p>
        </div>
        <span className="tabular-nums text-2xl font-semibold text-primary">{formatPercentValue(percent / 100, 0)}</span>
        <button type="button" onClick={hide} aria-label={t.hide} title={t.hide} className="flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:bg-paper-sunken hover:text-ink">
          <IconClose className="size-4" aria-hidden />
        </button>
      </div>
      <div
        role="progressbar"
        aria-label={t.title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-3 h-2 overflow-hidden rounded-full bg-paper-sunken"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>

      {/* The one step to do now, big; the rest to do below it; what is done, in one line. */}
      {next && (
        <StepLink step={next} t={t} storeLink={storeLink} className="mt-4 border-primary/40 bg-primary-soft">
          <span className="mb-0.5 block text-xs font-semibold text-primary-dark">{t.next}</span>
        </StepLink>
      )}
      {rest.length > 0 && (
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {rest.map((step) => (
            <li key={step.key}>
              <StepLink step={step} t={t} storeLink={storeLink} />
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
          <span className="font-medium text-success">{/* One count on the card (the required steps, above); this line only names what's done (N-13). */}
          {t.doneLabel}:</span>
          {done.map((step) => (
            <span key={step.key} className="inline-flex items-center gap-1">
              <IconSuccess className="size-3.5 text-success" aria-hidden />
              {t[step.key]}
            </span>
          ))}
        </p>
      )}
    </Card>
  );
}

type GuideStep = { key: SetupStepKey; done: boolean; optional?: boolean };

function StepLink({
  step,
  t,
  storeLink,
  className,
  children,
}: {
  step: GuideStep;
  t: (typeof STRINGS)["en"];
  storeLink: string | null;
  className?: string;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <IconCircle className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden />
      <span className="min-w-0 flex-1">
        {children}
        <span className="block text-sm font-medium text-ink">
          {t[step.key]}
          {step.optional && <span className="ms-2 text-xs font-normal text-ink-soft">({t.optional})</span>}
        </span>
        <span className="mt-0.5 block text-xs text-ink-soft">{t[`${step.key}Hint`]}</span>
      </span>
      <IconCaretLeft className="mt-0.5 size-4 shrink-0 text-ink-soft ltr:rotate-180" aria-hidden />
    </>
  );
  const classes = cn(
    "flex h-full min-h-14 items-start gap-3 rounded-[var(--radius)] border border-line p-3 transition-colors hover:border-primary/40",
    className
  );
  // The test order is placed on the store itself, in a new tab.
  if (step.key === "order" && storeLink) {
    return (
      <a href={storeLink} target="_blank" rel="noreferrer" className={classes}>
        {body}
      </a>
    );
  }
  return (
    <Link to={STEP_LINK[step.key]} className={classes}>
      {body}
    </Link>
  );
}

/*
 * Shared with the slim row the home shows once the store has its first order
 * (pages/home/today/SetupRow.tsx): the same step names, the same destinations
 * and the same "hidden" key, so hiding one hides the other.
 */
export { STRINGS as SETUP_GUIDE_STRINGS, STEP_LINK as SETUP_STEP_LINK, hiddenKey as setupGuideHiddenKey };
