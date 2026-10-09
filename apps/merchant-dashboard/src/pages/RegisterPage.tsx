import { useEffect, useId, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Alert } from "@store-builder/ui";
import {
  accountSignupEmailCode,
  accountSignupSwitches,
  apiFieldProblems,
  isApiErrorCode,
  type BillingCycle,
  type PublicPlan,
  type SignupOptions,
  type VerificationChallenge,
} from "@store-builder/api-client";
import { useAuth, ApiError } from "@/context/AuthContext";
import { apiBaseUrl, apiClient } from "@/lib/apiClient";
import { unmetPasswordRules } from "@/lib/passwordRules";
import { UsernameField } from "@/components/UsernameField";
import { normalizeUsername, usernameSubmittable, type UsernameStatus } from "@/lib/username";
import { useLocale, useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { PlanSummary, type PlanChoice } from "@/components/plans/PlanPicker";
import { TermsConsent } from "@/components/plans/TermsConsent";
import { VerifyCodePanel } from "@/components/VerifyCodePanel";
import { rememberPlanChoice } from "@/lib/planChoice";
import { rememberReferralCode } from "@/lib/referralCode";
import { errorMessageNow } from "@/lib/errorMessages";
import { rememberSignupEmailCode, takeAfterAuth } from "@/lib/emailConfirm";
import { siteVisitForSignup } from "@/lib/siteVisit";
import {
  AUTH_SUBMIT,
  AuthBusy,
  AuthDivider,
  AuthField,
  AuthFooter,
  AuthHeading,
  AuthLink,
  AuthLinkButton,
  AuthPasswordField,
  AuthRules,
  AuthShell,
  GoogleMark,
} from "./AuthShell";
import { PlanCards } from "./PlanCards";

const STRINGS = {
  en: {
    title: "Create your account",
    subtitle: "Your store is ready to build in a few minutes.",
    google: "Continue with Google",
    or: "or",
    fullName: "Full name",
    fullNamePlaceholder: "Your name",
    email: "Email",
    phone: "Phone (optional)",
    phoneRequired: "Mobile number",
    phoneInvalid: "Enter a valid mobile number",
    password: "Password",
    confirm: "Password again",
    passwordRules: "The password still misses the rules listed under it.",
    mismatch: "The two passwords are not the same. Type them again.",
    chooseUsername: "Choose a username that is free first.",
    usernameTaken: "Someone just took this username. Choose another one.",
    emailTaken: "An account with this email already exists. Sign in instead.",
    planGone: "That plan is no longer available. Choose another one.",
    planRequired: "Choose a plan to continue.",
    termsRequired: "Agree to the terms to continue.",
    unavailable: "Sign-up isn't available right now. Try again later.",
    tooMany: "Too many attempts from this network — wait 15 minutes and try again",
    generic: "Something went wrong. Please try again.",
    create: "Create account",
    creating: "Creating account…",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    planStepTitle: "Choose your plan",
    planStepSubtitle: "You can change it later. You subscribe when you're ready to publish your store.",
    continue: "Continue",
    yourPlan: "Your plan",
    change: "Change",
    stepOf: "Step {n} of {total}",
    loading: "Loading plans…",
  },
  ar: {
    title: "اعمل حسابك",
    subtitle: "متجرك هيبقى جاهز تبنيه في دقايق.",
    google: "كمّل بحساب جوجل",
    or: "أو",
    fullName: "الاسم بالكامل",
    fullNamePlaceholder: "اسمك",
    email: "الإيميل",
    phone: "رقم الهاتف (اختياري)",
    phoneRequired: "رقم الموبايل",
    phoneInvalid: "اكتب رقم موبايل صحيح",
    password: "كلمة السر",
    confirm: "كلمة السر تاني",
    passwordRules: "كلمة السر لسه ناقصها الشروط اللي مكتوبة تحتها.",
    mismatch: "كلمتين السر مش زي بعض. اكتبهم تاني.",
    chooseUsername: "اختار اسم مستخدم متاح الأول.",
    usernameTaken: "حد لسه واخد الاسم ده. اختار اسم تاني.",
    emailTaken: "في حساب بالإيميل ده. ادخل بيه بدل ما تعمل حساب جديد.",
    planGone: "الباقة دي مبقتش متاحة. اختار باقة تانية.",
    planRequired: "اختار باقة عشان تكمّل.",
    termsRequired: "وافق على الشروط عشان تكمّل.",
    unavailable: "التسجيل مش متاح دلوقتي. جرّب بعدين.",
    tooMany: "محاولات كتير من الشبكة دي — استنى ربع ساعة وجرّب تاني",
    generic: "حصلت مشكلة. جرّب تاني.",
    create: "اعمل الحساب",
    creating: "بنعمل الحساب…",
    haveAccount: "عندك حساب؟",
    signIn: "ادخل",
    planStepTitle: "اختار باقتك",
    planStepSubtitle: "تقدر تغيّرها بعدين. هتشترك لما تبقى جاهز تنشر متجرك.",
    continue: "كمّل",
    yourPlan: "باقتك",
    change: "غيّرها",
    stepOf: "الخطوة {n} من {total}",
    loading: "بنحمّل الباقات…",
  },
} satisfies Messages;

/** The fields an error can sit under. */
type FieldName = "username" | "email" | "phone" | "password" | "confirm";
const FIELD_ID: Record<FieldName, string> = {
  phone: "phone",
  username: "register-username",
  email: "email",
  password: "password",
  confirm: "confirm",
};

/** The first invalid field: on screen and under the cursor. The username field keeps its input inside a wrapper. */
function focusField(field: FieldName) {
  window.setTimeout(() => {
    const node = document.getElementById(FIELD_ID[field]);
    const input = node instanceof HTMLInputElement ? node : (node?.querySelector("input") ?? null);
    input?.scrollIntoView({ block: "center" });
    input?.focus({ preventScroll: true });
  }, 0);
}

type Step = "plan" | "account" | "code";

/**
 * Sign-up. What it asks for follows the server (GET /auth/signup-options):
 * a plan first, while plans are required and some are on offer (preselected
 * from ?plan=&cycle= when the marketing site sent the visitor); always the
 * terms; and, while sign-up codes are on, the code screen after the form,
 * which signs the new account in. With none of that switched on it behaves
 * as it always has.
 */
export function RegisterPage() {
  const { login, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // A ZIMOS referral link (/register?ref=CODE): offered again in Billing once the store exists.
  useEffect(() => rememberReferralCode(params.get("ref")), [params]);
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const planHeadingId = useId();

  const [options, setOptions] = useState<SignupOptions | null>(null);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [choice, setChoice] = useState<PlanChoice>(() => ({
    planId: params.get("plan"),
    billingCycle: params.get("cycle") === "yearly" ? "yearly" : "monthly",
  }));
  const [step, setStep] = useState<Step>("account");
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // The server's switches (handoff 330): a mobile number is a must, and the email is confirmed by code after going in.
  const switches = accountSignupSwitches(options);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const unmetRules = unmetPasswordRules(password);
  const planStep = Boolean(options?.planRequired && plans.length > 0);
  const selectedPlan = plans.find((p) => p.id === choice.planId) ?? null;

  useEffect(() => {
    let cancelled = false;
    // A server or network that can't answer leaves the form as it always was.
    Promise.allSettled([apiClient.getSignupOptions(), apiClient.listPublicPlans()]).then(([opts, list]) => {
      if (cancelled) return;
      const nextOptions = opts.status === "fulfilled" ? opts.value : null;
      const nextPlans = list.status === "fulfilled" ? list.value : [];
      setOptions(nextOptions);
      setPlans(nextPlans);
      setChoice((current) => ({
        ...current,
        planId: nextPlans.some((p) => p.id === current.planId) ? current.planId : null,
      }));
      if (nextOptions?.planRequired && nextPlans.length > 0) setStep("plan");
      setLoadingOptions(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleGoogleLogin() {
    // Kept for the plan page an account made through Google lands on.
    if (choice.planId) rememberPlanChoice(choice);
    window.location.href = `${apiBaseUrl}/auth/google`;
  }

  function describe(err: unknown): string {
    if (isApiErrorCode(err, "USERNAME_TAKEN")) return t.usernameTaken;
    if (isApiErrorCode(err, "EMAIL_TAKEN")) return t.emailTaken;
    if (isApiErrorCode(err, "PLAN_NOT_AVAILABLE")) return t.planGone;
    if (isApiErrorCode(err, "PLAN_REQUIRED")) return t.planRequired;
    if (isApiErrorCode(err, "TERMS_REQUIRED")) return t.termsRequired;
    if (isApiErrorCode(err, "SIGNUP_UNAVAILABLE")) return t.unavailable;
    if (err instanceof ApiError && err.status === 429) return t.tooMany;
    if (err instanceof ApiError) return errorMessageNow(err);
    return t.generic;
  }

  // What is wrong with a field, said under that field.
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});

  function failField(field: FieldName, message: string) {
    const next: Partial<Record<FieldName, string>> = {};
    next[field] = message;
    setFieldErrors(next);
    focusField(field);
  }

  function clearField(field: FieldName) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    // Client-side gate before the API call — the backend enforces the same
    // password rule, so blocking here just spares a round-trip and a raw
    // server error. Typing is never blocked, only submitting.
    if (unmetRules.length > 0) {
      failField("password", t.passwordRules);
      return;
    }
    if (password !== confirm) {
      failField("confirm", t.mismatch);
      return;
    }
    if (!usernameSubmittable(usernameStatus)) {
      failField("username", t.chooseUsername);
      return;
    }
    if (!acceptTerms) {
      setTermsError(true);
      return;
    }
    if (planStep && !selectedPlan) {
      setStep("plan");
      return;
    }

    setSubmitting(true);
    try {
      // Straight to the API (what AuthContext.register does), to keep the answer's `emailCode`.
      const created = await apiClient.register({
        fullName,
        username: normalizeUsername(username),
        email,
        phone: phone || undefined,
        password,
        acceptTerms: true,
        locale,
        ...(planStep && selectedPlan ? { planId: selectedPlan.id, billingCycle: choice.billingCycle } : {}),
        // The marketing-site visit this sign-up came from (`?sv=`), when there is one.
        ...siteVisitForSignup(),
      });
      const next = "verificationRequired" in created ? created : null;
      // Confirm-by-code: the account goes straight in, and the code dialog opens on the code already sent.
      rememberSignupEmailCode(accountSignupEmailCode(created));
      if (next) {
        setChallenge(next);
        setStep("code");
        return;
      }
      // Without sign-up codes the account is signed in with the same
      // credentials, straight into the store setup (or told to confirm the
      // emailed link, as before).
      await login({ email, password });
      navigate(takeAfterAuth() ?? "/workspaces", { replace: true });
    } catch (err) {
      if (isApiErrorCode(err, "PLAN_NOT_AVAILABLE") || isApiErrorCode(err, "PLAN_REQUIRED")) setStep(planStep ? "plan" : "account");
      // A name or an email someone else has is said under its own field; the rest over the form.
      if (isApiErrorCode(err, "USERNAME_TAKEN")) failField("username", describe(err));
      else if (isApiErrorCode(err, "EMAIL_TAKEN")) failField("email", describe(err));
      else if (apiFieldProblems(err).some((problem) => problem.field === "phone")) failField("phone", t.phoneInvalid);
      else setError(describe(err));
    } finally {
      setSubmitting(false);
    }
  }

  const totalSteps = (planStep ? 1 : 0) + 1 + (options?.verificationRequired ? 1 : 0);
  const stepNumber = step === "plan" ? 1 : step === "account" ? (planStep ? 2 : 1) : totalSteps;
  const stepLine = totalSteps > 1 ? fmt(t.stepOf, { n: stepNumber, total: totalSteps }) : undefined;

  return (
    <AuthShell size={!loadingOptions && step === "plan" ? "md" : "sm"}>
      {loadingOptions ? (
        <AuthBusy>{t.loading}</AuthBusy>
      ) : step === "code" && challenge ? (
        <>
          {stepLine && <p className="mb-2 text-xs font-medium text-ink-soft tabular-nums">{stepLine}</p>}
          <VerifyCodePanel
            challenge={challenge}
            onVerified={async () => {
              await refreshUser();
              navigate(takeAfterAuth() ?? "/workspaces", { replace: true });
            }}
          />
        </>
      ) : step === "plan" ? (
        <div>
          <AuthHeading id={planHeadingId} title={t.planStepTitle} step={stepLine}>
            {t.planStepSubtitle}
          </AuthHeading>
          {error && (
            <Alert variant="danger" className="mt-4">
              {error}
            </Alert>
          )}
          <div className="mt-5">
            <PlanCards plans={plans} value={choice} onChange={setChoice} labelledBy={planHeadingId} />
          </div>
          <Button
            type="button"
            className={`mt-5 ${AUTH_SUBMIT}`}
            disabled={!selectedPlan}
            onClick={() => {
              setError(null);
              setStep("account");
            }}
          >
            {t.continue}
          </Button>
          <AuthFooter>
            {t.haveAccount}
            <AuthLink to="/login">{t.signIn}</AuthLink>
          </AuthFooter>
        </div>
      ) : (
        accountForm()
      )}
    </AuthShell>
  );

  // A plain function, not a component: rendered as <AccountForm /> it would be
  // a new component on every render and its inputs would lose focus.
  function accountForm() {
    return (
      <>
        <AuthHeading title={t.title} step={stepLine}>
          {t.subtitle}
        </AuthHeading>

        {planStep && selectedPlan && (
          <div data-slot="auth-well" className="mt-5 rounded-[1.25rem] border border-line bg-paper-raised px-4 pt-1.5 pb-4">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm text-ink-soft">
                {t.yourPlan}: <span className="font-medium text-ink">{selectedPlan.name}</span>
              </p>
              <AuthLinkButton className="shrink-0" onClick={() => setStep("plan")}>
                {t.change}
              </AuthLinkButton>
            </div>
            <PlanSummary plan={selectedPlan} billingCycle={choice.billingCycle as BillingCycle} compact />
          </div>
        )}

        <div className="mt-6">
          <Button type="button" variant="outline" className="min-h-12 w-full text-base" onClick={handleGoogleLogin}>
            <GoogleMark />
            {t.google}
          </Button>
          <AuthDivider>{t.or}</AuthDivider>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <AuthField
            label={t.fullName}
            fieldId="fullName"
            name="name"
            required
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t.fullNamePlaceholder}
          />

          <div id={FIELD_ID.username} className="space-y-1.5">
            <UsernameField
              value={username}
              onChange={(value) => {
                setUsername(value);
                clearField("username");
              }}
              onStatus={setUsernameStatus}
            />
            {fieldErrors.username && (
              <p role="alert" className="text-[13px] leading-5 font-medium text-danger">
                {fieldErrors.username}
              </p>
            )}
          </div>

          <AuthField
            label={t.email}
            fieldId={FIELD_ID.email}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            required
            dir="ltr"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearField("email");
            }}
            placeholder="you@example.com"
            error={fieldErrors.email}
          />

          <AuthField
            label={switches.phoneRequired ? t.phoneRequired : t.phone}
            required={switches.phoneRequired}
            error={fieldErrors.phone}
            fieldId={FIELD_ID.phone}
            name="tel"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            dir="ltr"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              clearField("phone");
            }}
            placeholder="01XXXXXXXXX"
          />

          <AuthPasswordField
            label={t.password}
            fieldId={FIELD_ID.password}
            name="new-password"
            autoComplete="new-password"
            enterKeyHint="next"
            required
            minLength={8}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearField("password");
            }}
            aria-describedby={unmetRules.length > 0 ? "password-rules" : undefined}
            error={fieldErrors.password}
          >
            {/* What is still missing, from the first look at the field: nobody should learn the rules by failing them. */}
            <AuthRules id="password-rules" rules={unmetRules.map((rule) => (locale === "ar" ? rule.label : rule.labelEn))} />
          </AuthPasswordField>

          <AuthPasswordField
            label={t.confirm}
            fieldId={FIELD_ID.confirm}
            name="confirm-password"
            autoComplete="new-password"
            enterKeyHint="done"
            required
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              clearField("confirm");
            }}
            error={fieldErrors.confirm ?? (confirm.length > 0 && password !== confirm ? t.mismatch : undefined)}
          />

          <TermsConsent
            checked={acceptTerms}
            onChange={(next) => {
              setAcceptTerms(next);
              if (next) setTermsError(false);
            }}
            showError={termsError}
            disabled={submitting}
          />

          <Button type="submit" className={AUTH_SUBMIT} disabled={submitting}>
            {submitting ? t.creating : t.create}
          </Button>
        </form>

        <AuthFooter>
          {t.haveAccount}
          <AuthLink to="/login">{t.signIn}</AuthLink>
        </AuthFooter>
      </>
    );
  }
}
