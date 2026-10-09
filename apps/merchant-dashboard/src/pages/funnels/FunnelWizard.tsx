import { useState, type ReactNode } from "react";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import {
  currenciesGet,
  funnelExtrasImport,
  funnelExtrasShare,
  funnelExtrasUnshare,
  isApiErrorCode,
  type FunnelDto,
  type Product,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { invalidateCached } from "@/lib/useCachedAsync";
import { useAiErrorText } from "@/lib/aiRun";
import { useMarketplaceErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { IconCaretDown, IconGift, IconInfo, IconProduct, IconShare } from "@/components/icons";
import { CopyButton } from "@/components/CopyButton";
import { TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Sheet, SheetBody, SheetFooter, SheetFrame, SheetHeader } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { useFunnelErrorMessage } from "./funnelAdapter";
import { STARTER_TEMPLATE_TEXT } from "./FunnelEditorPage.strings";
import { AI_FUNNEL_DEFAULTS, AiFunnelFields, AiTemplateCard, type AiFunnelSettings } from "./AiFunnelOption";
import { FunnelTemplateGallery, defaultStarter, isStarterFor, type GalleryPick } from "./FunnelTemplateGallery";
import { MARKET_STRINGS } from "./marketplace/marketplaceStrings";
import { buildFunnel, type WizardTemplate } from "./wizard/buildFunnel";
import { OfferQuestion } from "./wizard/OfferQuestion";
import { ProductQuestion, loadWizardProducts } from "./wizard/ProductQuestion";
import { WIZARD_STRINGS } from "./wizard/wizardStrings";

/**
 * A new funnel in three questions — «بتبيع إيه؟», «أنهي عرض؟», «أنهي شكل؟» —
 * one per screen, then «ابني الفانل». Back keeps every answer. What the old
 * wizard also asked (the name, the link, the currency) has a default and is
 * on the last screen: the name is the product's. The other ways in are quiet
 * links on the first screen: a share code another merchant gave you, and a
 * funnel that only collects numbers. `FunnelShareDialog` is where a merchant
 * gets that code for one of their own funnels.
 *
 * The funnel is made with the calls the wizard always made (./wizard/buildFunnel.ts).
 */

type Goal = "sell" | "leads";
type Screen = "product" | "offer" | "template" | "code";
const LINK = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;
const ORDER: Screen[] = ["product", "offer", "template"];

interface WizardError {
  message: string;
  /** The plan's monthly funnels are used up: the box also offers the way to a bigger plan. */
  planLimit: boolean;
  /** The AI needs a product: the box also offers the way back to the first question. */
  needsProduct?: boolean;
}

interface WizardParts {
  title: string;
  description: string;
  /** 1–3 on a question; null on the code screen. */
  step: number | null;
  screen: Screen;
  body: ReactNode;
  footer: ReactNode;
  busy: boolean;
}

function useFunnelWizard({ active, onCancel, onCreated }: { active: boolean; onCancel: () => void; onCreated: (id: string) => void }): WizardParts {
  const t = useT(WIZARD_STRINGS);
  const m = useT(MARKET_STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const describeError = useFunnelErrorMessage();
  const marketError = useMarketplaceErrorMessage();
  const aiError = useAiErrorText();

  const [screen, setScreen] = useState<Screen>("product");
  const [goal, setGoal] = useState<Goal>("sell");
  const [product, setProduct] = useState<Product | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [upsell, setUpsell] = useState(false);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [pick, setPick] = useState<GalleryPick>(() => ({ kind: "starter", id: defaultStarter("sell", false), lang: locale }));
  // The "AI template" card (AiFunnelOption.tsx): the AI writes the sales page.
  const [ai, setAi] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiFunnelSettings>(AI_FUNNEL_DEFAULTS);
  // null until the merchant types one: the name then follows the product (or the template).
  const [typedName, setTypedName] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [currency, setCurrency] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<WizardError | null>(null);

  // Nothing is fetched until the wizard is first opened.
  const [opened, setOpened] = useState(active);
  if (active && !opened) setOpened(true);
  const products = useAsync(() => (opened ? loadWizardProducts(workspaceId) : Promise.resolve(null)), [workspaceId, opened]);
  const offers = useAsync(
    () => (opened && upsell ? apiClient.listWorkspaceOffers(workspaceId, { limit: 100 }) : Promise.resolve(null)),
    [workspaceId, opened, upsell]
  );
  const currencies = useAsync(() => (opened ? currenciesGet(apiClient, workspaceId).catch(() => null) : Promise.resolve(null)), [workspaceId, opened]);

  const autoName = (
    product?.name ?? (pick.kind === "starter" ? (ai ? "" : STARTER_TEMPLATE_TEXT[pick.lang][pick.id].name) : pick.name)
  ).slice(0, 200);
  const name = typedName ?? autoName;

  const go = (next: Screen) => {
    setError(null);
    setScreen(next);
  };

  /** Onto the last question: a ready funnel chosen earlier that no longer suits the answers gives way to the one that does. */
  function toTemplate(nextGoal: Goal, nextUpsell: boolean) {
    if (!ai && pick.kind === "starter" && !isStarterFor(pick.id, nextGoal, nextUpsell, pick.lang)) {
      setPick({ kind: "starter", id: defaultStarter(nextGoal, nextUpsell), lang: pick.lang });
    }
    if (ai && nextGoal === "leads") setAi(false);
    go("template");
  }

  function next() {
    if (screen === "product") {
      if (!product && !skipped && (products.data ?? []).length > 0) return setError({ message: t.q1Missing, planLimit: false });
      setGoal("sell");
      return go("offer");
    }
    if (screen === "offer") return toTemplate("sell", upsell);
  }

  function back() {
    if (screen === "offer" || screen === "code") return go("product");
    if (screen === "template") return go(goal === "leads" ? "product" : "offer");
  }

  async function importByCode() {
    if (code.trim().length < 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await funnelExtrasImport(apiClient, workspaceId, { shareCode: code.trim() });
      toast.success(fmt(t.imported, { name: result.funnel.name, steps: result.stepCount }));
      invalidateCached("funnels:");
      onCreated(result.funnel.id);
    } catch (err) {
      setError({ message: describeError(err), planLimit: isApiErrorCode(err, "PLAN_LIMIT_REACHED") });
      setBusy(false);
    }
  }

  async function build() {
    if (busy) return;
    const finalName = name.trim();
    if (!finalName) return setError({ message: t.nameRequired, planLimit: false });
    const subdomain = link.trim().toLowerCase();
    if (subdomain && !LINK.test(subdomain)) {
      setMoreOpen(true);
      return setError({ message: t.linkInvalid, planLimit: false });
    }
    if (ai && !product) return setError({ message: t.aiNeedsProduct, planLimit: false, needsProduct: true });

    const template: WizardTemplate = ai
      ? { kind: "ai", settings: aiSettings }
      : pick.kind === "starter"
        ? pick
        : pick.kind === "market"
          ? { kind: "market", id: pick.id }
          : pick.kind === "platform"
            ? { kind: "platform", templateVersionId: pick.templateVersionId }
            : { kind: "copy", funnelId: pick.funnelId };
    setBusy(true);
    setError(null);
    const outcome = await buildFunnel(workspaceId, {
      goal,
      productId: goal === "sell" ? (product?.id ?? "") : "",
      offerId: goal === "sell" && upsell ? offerId : null,
      template,
      name: finalName,
      subdomain,
      currency,
    });
    if (outcome.status === "failed") {
      const message = outcome.source === "market" ? marketError(outcome.error, "template") : outcome.source === "ai" ? aiError(outcome.error) : describeError(outcome.error);
      setError({ message, planLimit: isApiErrorCode(outcome.error, "PLAN_LIMIT_REACHED") });
      setBusy(false);
      return;
    }
    // The funnel exists: whatever did not get through is said once, and the editor opens either way.
    if (outcome.partial) toast.error(fmt(t.createdPartial, { message: describeError(outcome.partial) }));
    else if (outcome.touchError) toast.error(fmt(t.productByHand, { message: describeError(outcome.touchError) }));
    else if (outcome.offerError) toast.error(t.offerByHand);
    else toast.success(template.kind === "market" ? fmt(m.usedToast, { name: outcome.name }) : fmt(t.created, { name: outcome.name }));
    invalidateCached("funnels:");
    onCreated(outcome.id);
  }

  const errorBox = error && (
    <Alert variant="danger" className="space-y-1">
      <p>{error.message}</p>
      {error.planLimit && (
        <ViewLink to="/settings?tab=billing" className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">
          {t.planLimit}
        </ViewLink>
      )}
      {error.needsProduct && (
        <button type="button" className="inline-flex min-h-11 cursor-pointer items-center font-medium underline underline-offset-4" onClick={() => go("product")}>
          {t.chooseProduct}
        </button>
      )}
    </Alert>
  );

  let title = t.q1;
  let description = t.q1Hint;
  let body: ReactNode;

  if (screen === "code") {
    title = t.codeTitle;
    description = t.codeBody;
    body = (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void importByCode();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="funnel-share-code">{t.code}</Label>
          <Input
            id="funnel-share-code"
            dir="ltr"
            maxLength={20}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={code}
            disabled={busy}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="h-12 font-mono text-lg tracking-widest"
          />
        </div>
        {errorBox}
      </form>
    );
  } else if (screen === "product") {
    body = (
      <div className="space-y-3">
        <ProductQuestion
          t={t}
          products={products.data}
          loading={products.loading || (!products.data && !products.error)}
          error={products.error}
          onRetry={() => void products.refresh()}
          value={product}
          onChange={(p) => {
            setProduct(p);
            setSkipped(false);
            setError(null);
          }}
          skipped={skipped}
          onSkip={() => {
            setProduct(null);
            setSkipped(true);
            setError(null);
          }}
          onCode={() => go("code")}
          onLeads={() => {
            setGoal("leads");
            toTemplate("leads", false);
          }}
        />
        {errorBox}
      </div>
    );
  } else if (screen === "offer") {
    title = t.q2;
    description = t.q2Hint;
    body = (
      <OfferQuestion
        t={t}
        product={product}
        upsell={upsell}
        onUpsellChange={setUpsell}
        offerId={offerId}
        onOfferChange={setOfferId}
        offers={offers.data}
        offersLoading={upsell && offers.loading}
        offersError={offers.error}
      />
    );
  } else {
    title = t.q3;
    description = goal === "leads" ? t.q3LeadsHint : t.q3Hint;
    body = (
      <div className="space-y-4">
        <ul aria-label={t.summary} className="flex flex-wrap gap-1.5">
          {goal === "leads" ? (
            <li className="zimos-wizard-fact inline-flex min-h-7 items-center rounded-full bg-paper-sunken px-3 text-xs font-medium text-ink">{t.summaryLeads}</li>
          ) : (
            <>
              <li className="zimos-wizard-fact inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full bg-paper-sunken px-3 text-xs font-medium text-ink">
                <IconProduct className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
                <bdi className="truncate">{product ? fmt(t.summaryProduct, { name: product.name }) : t.summaryNoProduct}</bdi>
              </li>
              <li className="zimos-wizard-fact inline-flex min-h-7 items-center gap-1.5 rounded-full bg-paper-sunken px-3 text-xs font-medium text-ink">
                <IconGift className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
                {upsell ? t.summaryUpsell : t.summaryNoUpsell}
              </li>
            </>
          )}
        </ul>

        <FunnelTemplateGallery
          goal={goal}
          locale={locale}
          upsell={upsell}
          value={ai ? null : pick}
          onChange={(next) => {
            setAi(false);
            setPick(next);
            setError(null);
          }}
          leading={
            goal === "sell" ? (
              <AiTemplateCard
                active={ai}
                onSelect={() => {
                  setAi(true);
                  setError(null);
                }}
              />
            ) : null
          }
        />

        {!ai && pick.kind === "market" && (
          <p className="zimos-funnel-warn flex items-start gap-2 rounded-[0.875rem] bg-accent-soft px-3 py-2 text-sm leading-6 text-accent-dark">
            <IconInfo className="mt-1 size-4 shrink-0" aria-hidden />
            {m.notCopied}
          </p>
        )}
        {ai && <AiFunnelFields value={aiSettings} onChange={setAiSettings} />}

        <section className="space-y-3 border-t border-line pt-4">
          <TextField label={t.name} dir="auto" maxLength={200} value={name} disabled={busy} onChange={(e) => setTypedName(e.target.value)} />
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            className="-ms-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-2 text-sm font-medium text-ink-soft transition-[color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:text-ink focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            {t.moreDetails}
            <IconCaretDown className={cn("size-4 transition-[rotate] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none", moreOpen && "rotate-180")} aria-hidden />
          </button>
          {moreOpen && (
            <div className="space-y-3">
              <TextField label={t.link} dir="ltr" maxLength={63} value={link} disabled={busy} hint={t.linkHint} autoCapitalize="none" spellCheck={false} onChange={(e) => setLink(e.target.value)} />
              {currencies.data && (
                <div className="space-y-1.5">
                  <Label htmlFor="funnel-currency">{t.currency}</Label>
                  <Select id="funnel-currency" value={currency} disabled={busy} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="">{fmt(t.storeCurrency, { code: currencies.data.baseCurrency })}</option>
                    {currencies.data.availableCurrencies
                      .filter((c) => c !== currencies.data?.baseCurrency)
                      .map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                  </Select>
                  <p className="text-xs leading-5 text-ink-soft">{t.currencyHint}</p>
                </div>
              )}
            </div>
          )}
        </section>

        {errorBox}
      </div>
    );
  }

  const footer =
    screen === "code" ? (
      <>
        <Button type="button" variant="outline" onClick={back} disabled={busy}>
          {t.back}
        </Button>
        <Button type="button" onClick={() => void importByCode()} disabled={busy || code.trim().length < 6}>
          {busy ? t.importing : t.importIt}
        </Button>
      </>
    ) : (
      <>
        <Button type="button" variant="outline" onClick={screen === "product" ? onCancel : back} disabled={busy}>
          {screen === "product" ? t.cancel : t.back}
        </Button>
        {screen === "template" ? (
          <Button type="button" onClick={() => void build()} disabled={busy} aria-busy={busy || undefined}>
            {busy ? t.building : t.build}
          </Button>
        ) : (
          <Button type="button" onClick={next}>
            {t.next}
          </Button>
        )}
      </>
    );

  const index = ORDER.indexOf(screen);
  return { title, description, step: index < 0 ? null : index + 1, screen, body, footer, busy };
}

/** The line over the questions: three segments, the ones answered and the current one lit. */
function WizardProgress({ step, className }: { step: number | null; className?: string }) {
  const t = useT(WIZARD_STRINGS);
  if (step === null) return null;
  const label = fmt(t.progress, { n: step, total: ORDER.length });
  return (
    <div role="progressbar" aria-label={t.steps} aria-valuemin={1} aria-valuemax={ORDER.length} aria-valuenow={step} aria-valuetext={label} className={cn("flex items-center gap-1.5", className)}>
      {ORDER.map((id, i) => (
        <span
          key={id}
          data-on={i < step ? "" : undefined}
          className={cn(
            "zimos-wizard-bar h-1 flex-1 rounded-full transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
            i < step ? "bg-primary" : "bg-line-strong"
          )}
        />
      ))}
      <span className="ms-1.5 shrink-0 text-xs leading-4 font-medium text-ink-soft tabular-nums">{label}</span>
    </div>
  );
}

const SCREEN_IN = "motion-safe:animate-[funnel-wizard-in_var(--dur-move)_var(--ease-spring)_both]";

/**
 * The wizard as a sheet — full height on a phone, a centred pane from 640px.
 * It stays mounted while the page is, so closing it and coming back keeps the
 * answers; it cannot be closed while the funnel is being built.
 */
export function FunnelWizardSheet({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (id: string) => void }) {
  const wizard = useFunnelWizard({ active: open, onCancel: () => onOpenChange(false), onCreated });
  return (
    <SheetFrame
      open={open}
      onOpenChange={(next) => {
        if (next || !wizard.busy) onOpenChange(next);
      }}
      size="lg"
      className="zimos-funnel-wizard max-sm:h-[92dvh] sm:h-[min(85dvh,46rem)]"
    >
      <SheetHeader title={wizard.title} description={wizard.description} />
      <WizardProgress step={wizard.step} className="shrink-0 px-5 pb-3" />
      <SheetBody key={wizard.screen} className={SCREEN_IN}>
        {wizard.body}
      </SheetBody>
      <SheetFooter>{wizard.footer}</SheetFooter>
    </SheetFrame>
  );
}

/** The same wizard laid in the page's flow, for a caller that has its own frame around it. */
export function FunnelWizard({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const wizard = useFunnelWizard({ active: true, onCancel, onCreated });
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base leading-6 font-semibold text-ink">{wizard.title}</h3>
        <p className="text-sm leading-6 text-ink-soft">{wizard.description}</p>
      </div>
      <WizardProgress step={wizard.step} />
      <div key={wizard.screen} className={SCREEN_IN}>
        {wizard.body}
      </div>
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:gap-3 *:data-[slot=button]:min-h-11">{wizard.footer}</div>
    </div>
  );
}

/** The row button that opens the share dialog, with its own label in both languages. */
export function ShareFunnelButton({ onClick }: { onClick: () => void }) {
  const t = useT(WIZARD_STRINGS);
  return (
    <Button size="icon-sm" variant="ghost" title={t.shareCode} aria-label={t.shareCode} onClick={onClick}>
      <IconShare className="size-4" aria-hidden />
    </Button>
  );
}

/** Shows (creating it on first open) the share code of one funnel, with copy and stop. A small sheet. */
export function FunnelShareDialog({ funnel, onClose }: { funnel: FunnelDto | null; onClose: () => void }) {
  const t = useT(WIZARD_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const describeError = useFunnelErrorMessage();
  const code = useAsync(
    () => (funnel ? funnelExtrasShare(apiClient, workspaceId, funnel.id) : Promise.resolve(null)),
    [workspaceId, funnel?.id]
  );

  return (
    <Sheet
      open={funnel !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.shareTitle}
      description={t.shareDescription}
      size="sm"
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            disabled={!code.data}
            onClick={async () => {
              if (!funnel) return;
              try {
                await funnelExtrasUnshare(apiClient, workspaceId, funnel.id);
                toast.success(t.shareStopped);
                onClose();
              } catch (err) {
                toast.error(describeError(err));
              }
            }}
          >
            {t.shareStop}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.close}
          </Button>
        </>
      }
    >
      {code.error ? (
        <Alert variant="danger">{describeError(code.error)}</Alert>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <bdi
            dir="ltr"
            aria-label={code.loading ? t.codeLoading : undefined}
            className="zimos-funnel-code flex min-h-12 items-center rounded-[0.875rem] bg-paper-sunken px-4 font-mono text-xl tracking-widest text-ink ring-1 ring-line"
          >
            {code.loading ? "…" : (code.data ?? "—")}
          </bdi>
          {code.data && <CopyButton value={code.data} label={t.copy} />}
        </div>
      )}
    </Sheet>
  );
}
