import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import { apiErrorDetails, isApiErrorCode, type PublicPlan, type Workspace } from "@store-builder/api-client";
import { IconCelebrate, IconContext, IconDraft, IconExternal } from "@/components/icons";
import { CopyButton } from "@/components/CopyButton";
import { Sheet } from "@/components/Sheet";
import { StoreAddressField } from "@/components/StoreAddressField";
import type { PlanChoice } from "@/components/plans/PlanPicker";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { storeHost, storeUrl, suggestSlug } from "@/lib/storeAddress";
import { useSlugCheck, type SlugCheckState } from "@/lib/useSlugCheck";
import { PlanCards } from "@/pages/PlanCards";

/**
 * Creating a store, once, for the two places it happens: the store picker
 * (the first store is the page itself; a second one is a sheet over the list)
 * and All my stores (a sheet over the cards).
 *
 * `useCreateStoreForm` holds what is typed and makes the same call the picker
 * always made (WorkspaceContext.createWorkspace, then the access read that
 * says whether the new store is a draft). `CreateStoreFields` draws the
 * fields, `StoreCreated` what the merchant sees the moment the store exists,
 * and `CreateStoreSheet` puts both in a sheet.
 */

const STRINGS = {
  en: {
    sheetTitle: "New store",
    sheetBody: "Name it and choose its address. Everything else can wait.",
    storeName: "Store name",
    storeNamePlaceholder: "e.g. Nour's Boutique",
    referral: "Referral code (optional)",
    referralPlaceholder: "e.g. CAIRO10",
    referralHint: "Got a code from a ZIMOS agent? Write it now, or add it later from Settings.",
    planTitle: "Plan for this store",
    create: "Create the store",
    creating: "Creating…",
    createFailed: "Couldn't create the store. Try again.",
    limitStores: "You've reached your plan's store limit ({used} of {max}). Upgrade one of your stores' plans to add another.",
    limitDrafts: "Subscribe to one of your stores before starting another.",
    planGone: "That plan is no longer available. Choose another one.",
    planRequired: "Choose a plan for this store.",
    liveTitle: "{name} is live",
    liveBody: "Your store has its own address. This is the link to send to your customers.",
    draftTitle: "{name} is ready to build",
    draftBody: "It is a draft for now: add your products and design it as you like. When you're ready, subscribe and it goes live at this address.",
    addressError: "We couldn't give your store the address you picked — {error} It was created at the address below instead.",
    linkLabel: "Your store's link",
    linkHint: "You will always find this link at the top of the dashboard.",
    toDashboard: "Open the dashboard",
    visit: "Visit the store",
    copyLink: "Copy the link",
    later: "Stay here",
  },
  ar: {
    sheetTitle: "متجر جديد",
    sheetBody: "سمّيه واختار عنوانه. الباقي يستنى.",
    storeName: "اسم المتجر",
    storeNamePlaceholder: "مثلًا: بوتيك نور",
    referral: "كود الإحالة (اختياري)",
    referralPlaceholder: "مثلًا: CAIRO10",
    referralHint: "معاك كود من مندوب ZIMOS؟ اكتبه دلوقتي، أو ضيفه بعدين من الإعدادات.",
    planTitle: "باقة المتجر ده",
    create: "اعمل المتجر",
    creating: "بنعمله…",
    createFailed: "معرفناش نعمل المتجر. جرّب تاني.",
    limitStores: "وصلت لأقصى عدد متاجر في باقتك ({used} من {max}). رقّي باقة متجر من متاجرك عشان تضيف واحد كمان.",
    limitDrafts: "اشترك في متجر من متاجرك قبل ما تبدأ واحد جديد.",
    planGone: "الباقة دي مبقتش متاحة. اختار باقة تانية.",
    planRequired: "اختار باقة للمتجر ده.",
    liveTitle: "{name} شغّال دلوقتي",
    liveBody: "متجرك بقى ليه عنوانه. ده اللينك اللي تبعته لعملاءك.",
    draftTitle: "{name} جاهز تبنيه",
    draftBody: "هو مسودة دلوقتي: ضيف منتجاتك وصمّمه زي ما تحب. لما تبقى جاهز، اشترك وهيتنشر على العنوان ده.",
    addressError: "معرفناش ندّي متجرك العنوان اللي اخترته — {error} واتعمل على العنوان اللي تحت بداله.",
    linkLabel: "لينك متجرك",
    linkHint: "هتلاقي اللينك ده دايمًا فوق في لوحة التحكم.",
    toDashboard: "افتح لوحة التحكم",
    visit: "زور المتجر",
    copyLink: "انسخ اللينك",
    later: "خلّيني هنا",
  },
} satisfies Messages;

export interface CreatedStore {
  workspace: Workspace;
  addressError?: string;
  /** Made while subscriptions are required: not public until it is subscribed. */
  draft: boolean;
}

export interface CreateStoreForm {
  name: string;
  setName: (value: string) => void;
  slug: string;
  setSlug: (value: string) => void;
  slugCheck: SlugCheckState;
  referralCode: string;
  setReferralCode: (value: string) => void;
  plans: PublicPlan[];
  /** True while the server requires plans and this is not the account's first store. */
  askForPlan: boolean;
  plan: PlanChoice;
  setPlan: (next: PlanChoice) => void;
  creating: boolean;
  error: string | null;
  canSubmit: boolean;
  created: CreatedStore | null;
  submit: (event: FormEvent) => Promise<void>;
  /** Empties the form for the next store. */
  reset: () => void;
}

export function useCreateStoreForm(): CreateStoreForm {
  const t = useT(STRINGS);
  const { workspaces, createWorkspace } = useWorkspace();
  const errorMessage = useErrorMessage();

  const [name, setNameState] = useState("");
  const [slug, setSlugState] = useState("");
  // Until the merchant touches the address it follows the name, so the common
  // case needs no thought. Once they have edited it, it is theirs and the name
  // stops overwriting it.
  const [slugEdited, setSlugEdited] = useState(false);
  // An agent's referral code: optional, attached to the new store's plan.
  const [referralCode, setReferralCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedStore | null>(null);
  // While the server requires plans, a store after the first is created on a
  // plan chosen here (the first one takes the plan chosen at sign-up).
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [planRequired, setPlanRequired] = useState(false);
  const [plan, setPlan] = useState<PlanChoice>({ planId: null, billingCycle: "monthly" });
  // Whether a plan is asked for is decided by the stores that existed before this one was made:
  // the list grows while the new store is still being set up.
  const [hadStores, setHadStores] = useState<boolean | null>(null);

  const slugCheck = useSlugCheck(slug);
  const askForPlan = planRequired && plans.length > 0 && (hadStores ?? workspaces.length > 0);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([apiClient.getSignupOptions(), apiClient.listPublicPlans()]).then(([opts, list]) => {
      if (cancelled) return;
      setPlanRequired(opts.status === "fulfilled" && opts.value.planRequired);
      setPlans(list.status === "fulfilled" ? list.value : []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function setName(value: string) {
    setNameState(value);
    if (!slugEdited) setSlugState(suggestSlug(value));
  }

  function setSlug(value: string) {
    setSlugEdited(true);
    setSlugState(value);
  }

  function describe(err: unknown): string {
    if (isApiErrorCode(err, "PLAN_LIMIT_REACHED")) {
      const details = apiErrorDetails<{ limit?: string; max?: number; used?: number }>(err);
      if (details?.limit === "draft_stores") return t.limitDrafts;
      return fmt(t.limitStores, { max: details?.max ?? "", used: details?.used ?? "" });
    }
    if (isApiErrorCode(err, "PLAN_NOT_AVAILABLE")) return t.planGone;
    if (isApiErrorCode(err, "PLAN_REQUIRED")) return t.planRequired;
    return errorMessage(err) || t.createFailed;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (askForPlan && !plan.planId) {
      setError(t.planRequired);
      return;
    }
    setCreating(true);
    setHadStores(workspaces.length > 0);
    try {
      const result = await createWorkspace(
        name.trim(),
        slug,
        referralCode.trim() || undefined,
        askForPlan && plan.planId ? { planId: plan.planId, billingCycle: plan.billingCycle } : undefined
      );
      // A store made while subscriptions are required starts as a draft.
      const access = await apiClient.getWorkspaceAccess(result.workspace.id).catch(() => null);
      setCreated({ ...result, draft: Boolean(access?.draft) });
    } catch (err) {
      setError(describe(err));
      setHadStores(null);
    } finally {
      setCreating(false);
    }
  }

  function reset() {
    setHadStores(null);
    setNameState("");
    setSlugState("");
    setSlugEdited(false);
    setReferralCode("");
    setError(null);
    setCreated(null);
    setPlan({ planId: null, billingCycle: "monthly" });
  }

  // The address has to be known-good before the store is created: a store can
  // be moved afterwards, but the merchant should not find that out by being
  // given an address they didn't choose.
  const canSubmit = name.trim().length > 0 && slugCheck.status === "available" && !creating;

  return {
    name,
    setName,
    slug,
    setSlug,
    slugCheck,
    referralCode,
    setReferralCode,
    plans,
    askForPlan,
    plan,
    setPlan,
    creating,
    error,
    canSubmit,
    created,
    submit,
    reset,
  };
}

/** 16px in every field, so a phone never zooms in; 44px tall. */
const FIELD = "min-h-11 text-base md:text-base";

/** The fields of a new store: its name, its address, its plan when one is asked for, a referral code. */
export function CreateStoreFields({ form }: { form: CreateStoreForm }) {
  const t = useT(STRINGS);
  const nameId = useId();
  const addressId = useId();
  const referralId = useId();
  const planHeadingId = useId();
  const alert = useRef<HTMLDivElement>(null);

  // A refusal is said at the top of the form: bring it on screen, in a sheet too.
  useEffect(() => {
    if (form.error) alert.current?.scrollIntoView({ block: "nearest" });
  }, [form.error]);

  return (
    <div className="space-y-4">
      {form.error && (
        <div ref={alert}>
          <Alert variant="danger">{form.error}</Alert>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={nameId}>{t.storeName}</Label>
        <Input
          id={nameId}
          name="store-name"
          required
          autoComplete="organization"
          enterKeyHint="next"
          maxLength={200}
          value={form.name}
          disabled={form.creating}
          onChange={(e) => form.setName(e.target.value)}
          placeholder={t.storeNamePlaceholder}
          className={FIELD}
        />
      </div>

      <div className="[&_[data-slot=input]]:h-11 [&_[data-slot=input]]:text-base">
        <StoreAddressField id={addressId} value={form.slug} onChange={form.setSlug} state={form.slugCheck} disabled={form.creating} />
      </div>

      {form.askForPlan && (
        <div className="space-y-2">
          <h3 id={planHeadingId} className="text-sm font-medium text-ink">
            {t.planTitle}
          </h3>
          <PlanCards plans={form.plans} value={form.plan} onChange={form.setPlan} disabled={form.creating} labelledBy={planHeadingId} />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={referralId}>{t.referral}</Label>
        <Input
          id={referralId}
          name="referral-code"
          value={form.referralCode}
          onChange={(e) => form.setReferralCode(e.target.value.toUpperCase())}
          placeholder={t.referralPlaceholder}
          maxLength={32}
          dir="ltr"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-describedby={`${referralId}-hint`}
          className={cn(FIELD, "max-w-60 font-mono")}
          disabled={form.creating}
        />
        <p id={`${referralId}-hint`} className="text-xs leading-5 text-ink-soft">
          {t.referralHint}
        </p>
      </div>
    </div>
  );
}

const DUOTONE = { weight: "duotone" } as const;

/**
 * What a merchant sees the moment their store exists.
 *
 * The link is the whole point of this screen: it is the first time the store
 * has a public address, and it is the thing they will need to send to someone.
 * So it gets the screen to itself rather than a line in a toast that is gone in
 * four seconds. A draft store's address works once it is subscribed, which
 * the screen says instead of calling it live.
 */
export function StoreCreated({ created, heading = "h2" }: { created: CreatedStore; heading?: "h1" | "h2" | "none" }) {
  const t = useT(STRINGS);
  const { workspace, addressError, draft } = created;
  const url = storeUrl(workspace.slug);
  const Heading = heading === "none" ? null : heading;

  return (
    <div>
      {Heading && (
        <>
      <div
        data-slot="auth-tile"
        className={cn(
          "flex size-14 items-center justify-center rounded-[1.25rem] [&_svg]:size-8",
          draft ? "bg-primary-soft text-primary" : "bg-success-soft text-success"
        )}
      >
        <IconContext.Provider value={DUOTONE}>{draft ? <IconDraft aria-hidden /> : <IconCelebrate aria-hidden />}</IconContext.Provider>
      </div>
      <Heading className="mt-4 font-display text-2xl leading-8 font-semibold text-ink">
        {fmt(draft ? t.draftTitle : t.liveTitle, { name: workspace.name })}
      </Heading>
        </>
      )}
      <p className={cn("text-sm leading-6 text-ink-soft", Heading && "mt-2")}>{draft ? t.draftBody : t.liveBody}</p>

      {addressError && (
        <Alert variant="danger" className="mt-4">
          {fmt(t.addressError, { error: addressError })}
        </Alert>
      )}

      <div data-slot="auth-well" className="mt-5 rounded-[1.25rem] border border-line bg-paper-raised p-4">
        <p className="text-xs font-medium text-ink-soft">{t.linkLabel}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {draft ? (
            <bdi dir="ltr" className="min-w-0 font-display text-lg font-medium break-all text-ink">
              {storeHost(workspace.slug)}
            </bdi>
          ) : (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              dir="ltr"
              className="inline-flex min-h-11 min-w-0 items-center font-display text-lg font-medium break-all text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {storeHost(workspace.slug)}
            </a>
          )}
          <CopyButton value={url} label={t.copyLink} />
        </div>
        <p className="mt-2 text-xs leading-5 text-ink-soft">{t.linkHint}</p>
      </div>
    </div>
  );
}

/** The two ways on from a new store: into its dashboard, or — once it is live — to the store itself. */
export function StoreCreatedActions({
  created,
  onOpenDashboard,
  className,
  children,
}: {
  created: CreatedStore;
  onOpenDashboard: () => void;
  className?: string;
  /** A quieter third way, given first (a sheet's «خلّيني هنا»). */
  children?: ReactNode;
}) {
  const t = useT(STRINGS);
  return (
    <>
      {children}
      {!created.draft && (
        <Button variant="outline" className={cn("min-h-11 rounded-full px-5", className)} asChild>
          <a href={storeUrl(created.workspace.slug)} target="_blank" rel="noreferrer">
            <IconExternal className="size-4" aria-hidden />
            {t.visit}
          </a>
        </Button>
      )}
      <Button className={cn("min-h-11 rounded-full px-5", className)} onClick={onOpenDashboard}>
        {t.toDashboard}
      </Button>
    </>
  );
}

/**
 * A new store in a sheet, over the list it will join. What is typed stays if
 * the sheet is closed and opened again; once the store exists the sheet shows
 * its link, and closing it starts a clean form for the next one.
 */
export function CreateStoreSheet({
  open,
  onOpenChange,
  onCreated,
  onOpenDashboard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The store exists: refresh whatever lists stores behind the sheet. */
  onCreated?: (created: CreatedStore) => void;
  onOpenDashboard: (workspaceId: string) => void;
}) {
  const t = useT(STRINGS);
  const form = useCreateStoreForm();
  const formId = useId();
  const { created } = form;

  const told = useRef<string | null>(null);
  useEffect(() => {
    if (!created || told.current === created.workspace.id) return;
    told.current = created.workspace.id;
    onCreated?.(created);
    // onCreated is the parent's callback; only a new store is news.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created]);

  function change(next: boolean) {
    // Nothing closes the sheet while the store is being made.
    if (!next && form.creating) return;
    onOpenChange(next);
    if (!next && created) form.reset();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={change}
      title={created ? fmt(created.draft ? t.draftTitle : t.liveTitle, { name: created.workspace.name }) : t.sheetTitle}
      description={created ? undefined : t.sheetBody}
      size="md"
      footer={
        created ? (
          <StoreCreatedActions created={created} onOpenDashboard={() => onOpenDashboard(created.workspace.id)}>
            <Button variant="ghost" className="rounded-full px-4 text-ink-soft hover:text-ink sm:me-auto" onClick={() => change(false)}>
              {t.later}
            </Button>
          </StoreCreatedActions>
        ) : (
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={!form.canSubmit}>
            {form.creating ? t.creating : t.create}
          </Button>
        )
      }
    >
      {created ? (
        <StoreCreated created={created} heading="none" />
      ) : (
        <form id={formId} onSubmit={(event) => void form.submit(event)}>
          <CreateStoreFields form={form} />
        </form>
      )}
    </Sheet>
  );
}

/** The label of the submit button, for a page that draws its own (the first store). */
export function useCreateStoreLabels() {
  const t = useT(STRINGS);
  return { create: t.create, creating: t.creating };
}
