import { useEffect, useId, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import { isApiErrorCode, type PublicPlan } from "@store-builder/api-client";
import { IconRefresh, IconWarning } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { SkeletonBar, StateMessage } from "@/components/DataState";
import type { PlanChoice } from "@/components/plans/PlanPicker";
import { TermsConsent } from "@/components/plans/TermsConsent";
import { useErrorMessage } from "@/lib/errorMessages";
import { forgetPlanChoice, recallPlanChoice } from "@/lib/planChoice";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { AUTH_SUBMIT, AuthFooter, AuthHeading, AuthLinkButton, AuthShell } from "./AuthShell";
import { PlanCards } from "./PlanCards";

const STRINGS = {
  en: {
    title: "Choose your plan",
    body: "Pick the plan for your first store. You subscribe when you're ready to publish it.",
    save: "Continue",
    saving: "Saving…",
    choose: "Choose a plan to continue.",
    planGone: "That plan is no longer available. Choose another one.",
    loading: "Loading plans…",
    loadFailed: "We couldn't load the plans",
    loadFailedBody: "Check your connection and try again.",
    retry: "Try again",
    signOut: "Sign out",
    notNow: "Not you, or not now?",
  },
  ar: {
    title: "اختار باقتك",
    body: "اختار باقة متجرك الأول. هتشترك لما تبقى جاهز تنشره.",
    save: "كمّل",
    saving: "بنحفظ…",
    choose: "اختار باقة عشان تكمّل.",
    planGone: "الباقة دي مبقتش متاحة. اختار باقة تانية.",
    loading: "بنحمّل الباقات…",
    loadFailed: "معرفناش نحمّل الباقات",
    loadFailedBody: "راجع النت وجرّب تاني.",
    retry: "جرّب تاني",
    signOut: "اخرج من الحساب",
    notNow: "مش إنت، أو مش دلوقتي؟",
  },
} satisfies Messages;

/** Two plan cards while the list loads: a name, a price and three lines, in the cards' own box. */
function PlansSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="space-y-3">
        <SkeletonBar className="h-11 w-44" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((card) => (
            <div key={card} data-slot="plan-card" className="rounded-[1.25rem] border border-line bg-paper-raised p-4">
              <SkeletonBar className="h-4 w-1/2" />
              <SkeletonBar className="mt-4 h-6 w-2/3" />
              <SkeletonBar className="mt-5 w-4/5" />
              <SkeletonBar className="mt-3 w-3/5" />
              <SkeletonBar className="mt-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The step an account made through Google goes through while the server
 * requires a plan at sign-up (ProtectedRoute sends it here after the
 * username step): the plans on offer, and the terms, which the Google
 * sign-in never showed it. Starts from the plan picked on the sign-up form
 * before going to Google, if any.
 */
export function ChoosePlanPage() {
  const t = useT(STRINGS);
  const { needsPlan, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const errorMessage = useErrorMessage();
  const headingId = useId();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/workspaces";

  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [choice, setChoice] = useState<PlanChoice>(() => recallPlanChoice() ?? { planId: null, billingCycle: "monthly" });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoadError(false);
    apiClient
      .listPublicPlans()
      .then((list) => {
        setPlans(list);
        setChoice((current) => ({ ...current, planId: list.some((p) => p.id === current.planId) ? current.planId : null }));
      })
      .catch(() => setLoadError(true));
  };

  useEffect(load, []);

  // Chosen already (another tab), or no longer required: nothing to do here.
  useEffect(() => {
    if (!needsPlan) navigate(from, { replace: true });
  }, [needsPlan, from, navigate]);

  async function save() {
    setError(null);
    if (!choice.planId) {
      setError(t.choose);
      return;
    }
    if (!acceptTerms) {
      setTermsError(true);
      return;
    }
    setSaving(true);
    try {
      await apiClient.choosePlan({ planId: choice.planId, billingCycle: choice.billingCycle, acceptTerms: true });
      forgetPlanChoice();
      await refreshUser();
      navigate(from, { replace: true });
    } catch (err) {
      setError(isApiErrorCode(err, "PLAN_NOT_AVAILABLE") ? t.planGone : errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <AuthShell size="md">
      <AuthHeading id={headingId} title={t.title}>
        {t.body}
      </AuthHeading>

      <div className="mt-5">
        {loadError ? (
          <StateMessage
            role="alert"
            tone="danger"
            icon={<IconWarning aria-hidden />}
            title={t.loadFailed}
            description={t.loadFailedBody}
            className="shadow-none"
            action={
              <Button variant="outline" className="min-h-11 rounded-full px-5" onClick={load}>
                <IconRefresh weight="bold" className="size-4" aria-hidden />
                {t.retry}
              </Button>
            }
          />
        ) : !plans ? (
          <PlansSkeleton label={t.loading} />
        ) : (
          <PlanCards plans={plans} value={choice} onChange={setChoice} disabled={saving} labelledBy={headingId} />
        )}
      </div>

      {/* Said right over the two things it can be about: the plans above, the terms and the button below. */}
      {error && (
        <Alert variant="danger" className="mt-4">
          {error}
        </Alert>
      )}

      <div className="mt-5">
        <TermsConsent
          checked={acceptTerms}
          onChange={(next) => {
            setAcceptTerms(next);
            if (next) setTermsError(false);
          }}
          showError={termsError}
          disabled={saving}
        />
      </div>

      <Button className={`mt-5 ${AUTH_SUBMIT}`} onClick={() => void save()} disabled={saving || !plans}>
        {saving ? t.saving : t.save}
      </Button>
      {/* A way out of this step (Google sign-ups land here first). */}
      <AuthFooter>
        {t.notNow}
        <AuthLinkButton onClick={() => logout()}>{t.signOut}</AuthLinkButton>
      </AuthFooter>
    </AuthShell>
  );
}
