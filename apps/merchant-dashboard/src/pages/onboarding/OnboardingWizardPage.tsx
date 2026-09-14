import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Button, Progress, Stepper, ZimosLogo } from "@store-builder/ui";
import { fmt, useT } from "@/i18n/LocaleContext";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { BrandLoader } from "@/components/BrandLoader";
import { SKIPPABLE, STEP_IDS, isStepId, type StepId } from "./data";
import { clearState, initialState, loadState, saveState, type WizardState } from "./state";
import { STRINGS } from "./strings";
import { StepBasics } from "./StepBasics";
import { StepLook } from "./StepLook";
import { StepProduct } from "./StepProduct";
import { StepDelivery } from "./StepDelivery";
import { StepLaunch } from "./StepLaunch";

const FORM_ID = "onboarding-step-form";

/** First-run store setup, rendered outside the dashboard shell at /onboarding. */
export function OnboardingWizardPage() {
  const t = useT(STRINGS);
  const { user } = useAuth();
  const { loading, currentWorkspace, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const userId = user?.id ?? "anon";

  const [state, setState] = useState<WizardState | null>(null);
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const prevStep = useRef<StepId | null>(null);

  // Initialise once workspaces are known: resume from sessionStorage, or honour
  // a ?step= deep link / a fresh start handed over from the workspace picker.
  useEffect(() => {
    if (loading || state) return;
    const nav = (location.state ?? {}) as { fresh?: boolean; name?: string };
    const deep = params.get("step");
    let s = nav.fresh ? null : loadState(userId);

    if (isStepId(deep) && currentWorkspace) {
      if (!s || s.workspaceId !== currentWorkspace.id) {
        s = { ...initialState(), workspaceId: currentWorkspace.id };
      }
      s = { ...s, step: deep };
      if (deep === "product") s.product = undefined; // create another product
      if (deep === "delivery") s.delivery = undefined; // add another zone
      setParams({}, { replace: true }); // a refresh now resumes instead of resetting
    }
    s = s ?? initialState();
    if (!s.workspaceId && s.step !== "basics") s.step = "basics";
    setState(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    if (state) saveState(userId, state);
  }, [state, userId]);

  useEffect(() => {
    if (!state) return;
    if (prevStep.current && prevStep.current !== state.step) {
      headingRef.current?.focus();
      window.scrollTo({ top: 0 });
    }
    prevStep.current = state.step;
  }, [state]);

  useEffect(() => {
    if (state?.workspaceId && currentWorkspace?.id !== state.workspaceId) selectWorkspace(state.workspaceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.workspaceId]);

  const update = useCallback((patch: Partial<WizardState>) => {
    setState((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const goTo = useCallback((step: StepId) => update({ step }), [update]);

  const next = useCallback((patch: Partial<WizardState> = {}) => {
    setState((prev) => {
      if (!prev) return prev;
      const i = STEP_IDS.indexOf(prev.step);
      return {
        ...prev,
        ...patch,
        skipped: prev.skipped.filter((s) => s !== prev.step),
        step: STEP_IDS[Math.min(i + 1, STEP_IDS.length - 1)],
      };
    });
  }, []);

  if (!state) return <BrandLoader />;

  const index = STEP_IDS.indexOf(state.step);
  const canSkip = SKIPPABLE.includes(state.step);
  const isLast = state.step === "launch";

  const skip = () =>
    setState((prev) =>
      prev
        ? {
            ...prev,
            skipped: prev.skipped.includes(prev.step) ? prev.skipped : [...prev.skipped, prev.step],
            step: STEP_IDS[index + 1],
          }
        : prev
    );

  const finish = () => {
    clearState(userId);
    navigate("/");
  };

  const exit = () => navigate(state.workspaceId ? "/" : "/workspaces");

  const stepProps = { state, update, next, goTo, setSaving, saving, formId: FORM_ID };
  const labels = [t.basicsLabel, t.lookLabel, t.productLabel, t.deliveryLabel, t.launchLabel];
  const titles: Record<StepId, [string, string]> = {
    basics: [t.basicsTitle, t.basicsSubtitle],
    look: [t.lookTitle, t.lookSubtitle],
    product: [t.productTitle, t.productSubtitle],
    delivery: [t.deliveryTitle, t.deliverySubtitle],
    launch: [t.launchTitle, t.launchSubtitle],
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-paper-raised px-4 py-3 sm:px-8">
        <ZimosLogo height={28} />
        <div className="flex items-center gap-1">
          <LanguageSwitch />
          <button
            type="button"
            onClick={exit}
            aria-label={t.exit}
            title={t.exit}
            className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] text-ink-muted transition-colors hover:bg-primary-soft hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </header>

      <nav aria-label={t.pageTitle} className="border-b border-line bg-paper-raised px-4 py-4 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="hidden md:block">
            <Stepper steps={labels.map((label, i) => ({ label, description: state.skipped.includes(STEP_IDS[i]) ? t.skippedTag : undefined }))} current={index} />
          </div>
          <div className="md:hidden">
            <p className="mb-2 flex justify-between text-xs font-medium text-ink-soft">
              <span aria-current="step">{labels[index]}</span>
              <span className="tabular">{fmt(t.stepOf, { n: index + 1, total: STEP_IDS.length })}</span>
            </p>
            <Progress value={index + 1} max={STEP_IDS.length} label={fmt(t.stepOf, { n: index + 1, total: STEP_IDS.length })} />
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-8">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-ink outline-none sm:text-3xl">
          {titles[state.step][0]}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">{titles[state.step][1]}</p>
        <div className="mt-6">
          {state.step === "basics" && <StepBasics {...stepProps} initialName={(location.state as { name?: string } | null)?.name} />}
          {state.step === "look" && <StepLook {...stepProps} />}
          {state.step === "product" && <StepProduct {...stepProps} />}
          {state.step === "delivery" && <StepDelivery {...stepProps} />}
          {state.step === "launch" && <StepLaunch {...stepProps} onFinish={finish} />}
        </div>
      </main>

      <footer className="sticky bottom-0 z-10 border-t border-line bg-paper-raised/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center gap-2">
          <Button type="button" variant="ghost" disabled={index === 0 || saving} onClick={() => goTo(STEP_IDS[index - 1])}>
            <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
            <span className="max-[380px]:sr-only">{t.back}</span>
          </Button>
          <div className="flex-1" />
          {canSkip && (
            <Button type="button" variant="ghost" disabled={saving} onClick={skip}>
              {t.skip}
            </Button>
          )}
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {saving ? t.saving : isLast ? t.goDashboard : t.continue}
            {!saving && <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />}
          </Button>
        </div>
      </footer>
    </div>
  );
}
