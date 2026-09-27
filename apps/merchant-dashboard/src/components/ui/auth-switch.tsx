import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, Phone, User } from "lucide-react";
import { Alert, Button, cn } from "@store-builder/ui";
import { useAuth, ApiError } from "@/context/AuthContext";
import { apiBaseUrl, apiClient } from "@/lib/apiClient";
import { unmetPasswordRules } from "@/lib/passwordRules";
import { ZimosLogo } from "@/components/ZimosLogo";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    signIn: "Sign in",
    signUp: "Sign up",
    signInTitle: "Welcome back",
    signUpTitle: "Create your account",
    email: "Email",
    password: "Password",
    fullName: "Full name",
    phone: "Phone (optional)",
    confirm: "Confirm password",
    forgot: "Forgot password?",
    signingIn: "Signing in…",
    creating: "Creating account…",
    createAccount: "Create account",
    or: "or",
    google: "Continue with Google",
    showPassword: "Show password",
    hidePassword: "Hide password",
    newHere: "New here?",
    newHereText: "Set up your store in minutes — orders, confirmation calls and delivery, all in one place.",
    oneOfUs: "One of us?",
    oneOfUsText: "Welcome back. Sign in to get to your orders.",
    wrongCredentials: "Incorrect email or password.",
    generic: "Something went wrong. Please try again.",
    unmetRules: "The password is missing a few requirements — see the list below.",
    mismatch: "The password and its confirmation don't match.",
    resendPrompt: "Can't find the verification email?",
    resend: "Send it again",
    resending: "Sending…",
    resent: "If an account exists for this email, a new verification message is on its way.",
    resendFailed: "Couldn't send the message, try again.",
  },
  ar: {
    signIn: "تسجيل الدخول",
    signUp: "حساب جديد",
    signInTitle: "أهلاً بيك تاني",
    signUpTitle: "اعمل حسابك",
    email: "الإيميل",
    password: "الباسورد",
    fullName: "الاسم بالكامل",
    phone: "التليفون (اختياري)",
    confirm: "تأكيد الباسورد",
    forgot: "نسيت الباسورد؟",
    signingIn: "جارٍ الدخول…",
    creating: "جارٍ إنشاء الحساب…",
    createAccount: "اعمل الحساب",
    or: "أو",
    google: "المتابعة بحساب جوجل",
    showPassword: "إظهار الباسورد",
    hidePassword: "إخفاء الباسورد",
    newHere: "جديد هنا؟",
    newHereText: "جهّز متجرك في دقايق — الطلبات ومكالمات التأكيد والتوصيل، كله في مكان واحد.",
    oneOfUs: "معانا قبل كده؟",
    oneOfUsText: "أهلاً بيك تاني. ادخل عشان توصل لطلباتك.",
    wrongCredentials: "الإيميل أو الباسورد غلط.",
    generic: "حصلت مشكلة، حاول تاني.",
    unmetRules: "الباسورد لسه ناقص شوية شروط، بصّ على القايمة اللي تحت.",
    mismatch: "الباسورد وتأكيده مش زي بعض.",
    resendPrompt: "مش لاقي رسالة التأكيد؟",
    resend: "إعادة إرسال الرسالة",
    resending: "جارٍ الإرسال…",
    resent: "لو في حساب مسجّل بالإيميل ده، هنبعتلك رسالة تأكيد جديدة خلال دقايق.",
    resendFailed: "تعذّر إرسال الرسالة، حاول تاني.",
  },
} satisfies Messages;

export type AuthMode = "signin" | "signup";

/** Brand-coloured Google "G" — inline so no icon set is pulled in. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" className="shrink-0" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function Field({
  id,
  icon,
  label,
  children,
}: {
  id: string;
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="auth-field">
      <span className="auth-field-icon" aria-hidden>
        {icon}
      </span>
      <span className="sr-only">{label}</span>
      {children}
    </label>
  );
}

function PasswordToggle({ shown, onToggle, t }: { shown: boolean; onToggle: () => void; t: { showPassword: string; hidePassword: string } }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? t.hidePassword : t.showPassword}
      aria-pressed={shown}
      className="auth-eye"
    >
      {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
    </button>
  );
}

/**
 * Sign-in and sign-up on one screen, with the brand panel sliding across to
 * reveal the other form. Both forms are the real ones: they call the same
 * auth context and API as the previous separate pages did.
 */
export default function AuthSwitch({ initialMode = "signin" }: { initialMode?: AuthMode }) {
  const t = useT(STRINGS);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname ?? "/";

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const switchTo = (next: AuthMode) => {
    setMode(next);
    // Keep the URL truthful so refresh and back land on the same form.
    navigate(next === "signin" ? "/login" : "/register", { replace: true, state: location.state });
  };

  // Sign in
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Sign up
  const [fullName, setFullName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const unmetRules = unmetPasswordRules(newPassword);

  const google = () => {
    window.location.href = `${apiBaseUrl}/auth/google`;
  };

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    setSignInError(null);
    setNeedsVerification(false);
    setResent(false);
    setSigningIn(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setSignInError(err.status === 401 ? t.wrongCredentials : err.message);
        if (err.code === "ACCOUNT_INACTIVE") setNeedsVerification(true);
      } else {
        setSignInError(t.generic);
      }
    } finally {
      setSigningIn(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await apiClient.resendVerification(email);
      setResent(true);
    } catch (err) {
      setSignInError(err instanceof ApiError ? err.message : t.resendFailed);
    } finally {
      setResending(false);
    }
  }

  async function handleSignUp(event: FormEvent) {
    event.preventDefault();
    setSignUpError(null);
    if (unmetRules.length > 0) return setSignUpError(t.unmetRules);
    if (newPassword !== confirm) return setSignUpError(t.mismatch);
    setCreating(true);
    try {
      await register({ fullName, email: signUpEmail, phone: phone || undefined, password: newPassword });
      // Registration returns no tokens; sign in with the same credentials to
      // land straight in the workspace picker.
      await login({ email: signUpEmail, password: newPassword });
      navigate("/workspaces", { replace: true });
    } catch (err) {
      setSignUpError(err instanceof ApiError ? err.message : t.generic);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="auth-switch" dir="ltr">
      <style>{AUTH_SWITCH_CSS}</style>

      <div className={cn("auth-box", mode === "signup" && "sign-up-mode")}>
        <div className="auth-forms">
          <div className="auth-signin-signup">
            <form className="auth-form auth-form-signin" onSubmit={handleSignIn} aria-hidden={mode !== "signin"} dir="auto">
              <ZimosLogo height={26} surface="light" className="auth-logo" />
              <h2 className="auth-title">{t.signInTitle}</h2>

              {signInError && <Alert variant="danger" className="auth-alert">{signInError}</Alert>}
              {needsVerification &&
                (resent ? (
                  <Alert variant="success" className="auth-alert">{t.resent}</Alert>
                ) : (
                  <p className="auth-muted">
                    {t.resendPrompt}{" "}
                    <button type="button" className="auth-link" onClick={handleResend} disabled={resending || !email}>
                      {resending ? t.resending : t.resend}
                    </button>
                  </p>
                ))}

              <Field id="signin-email" icon={<Mail className="size-4" />} label={t.email}>
                <input id="signin-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.email} />
              </Field>
              <Field id="signin-password" icon={<Lock className="size-4" />} label={t.password}>
                <input id="signin-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.password} />
                <PasswordToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} t={t} />
              </Field>
              <Link to="/forgot-password" className="auth-link auth-forgot">
                {t.forgot}
              </Link>

              <button type="submit" className="auth-btn" disabled={signingIn}>
                {signingIn ? t.signingIn : t.signIn}
              </button>

              <p className="auth-muted">{t.or}</p>
              <Button type="button" variant="outline" className="auth-google" onClick={google}>
                <GoogleIcon /> {t.google}
              </Button>
            </form>

            <form className="auth-form auth-form-signup" onSubmit={handleSignUp} aria-hidden={mode !== "signup"} dir="auto">
              <h2 className="auth-title">{t.signUpTitle}</h2>

              {signUpError && <Alert variant="danger" className="auth-alert">{signUpError}</Alert>}

              <Field id="signup-name" icon={<User className="size-4" />} label={t.fullName}>
                <input id="signup-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t.fullName} />
              </Field>
              <Field id="signup-email" icon={<Mail className="size-4" />} label={t.email}>
                <input id="signup-email" type="email" autoComplete="email" required value={signUpEmail} onChange={(e) => setSignUpEmail(e.target.value)} placeholder={t.email} />
              </Field>
              <Field id="signup-phone" icon={<Phone className="size-4" />} label={t.phone}>
                <input id="signup-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phone} />
              </Field>
              <Field id="signup-password" icon={<Lock className="size-4" />} label={t.password}>
                <input id="signup-password" type={showNewPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t.password} aria-describedby="signup-password-rules" />
                <PasswordToggle shown={showNewPassword} onToggle={() => setShowNewPassword((v) => !v)} t={t} />
              </Field>
              {newPassword.length > 0 && unmetRules.length > 0 && (
                <ul id="signup-password-rules" className="auth-rules">
                  {unmetRules.map((rule) => (
                    <li key={rule.id}>• {rule.label}</li>
                  ))}
                </ul>
              )}
              <Field id="signup-confirm" icon={<Lock className="size-4" />} label={t.confirm}>
                <input id="signup-confirm" type={showNewPassword ? "text" : "password"} autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t.confirm} />
              </Field>
              {confirm.length > 0 && newPassword !== confirm && <p className="auth-error">{t.mismatch}</p>}

              <button type="submit" className="auth-btn" disabled={creating}>
                {creating ? t.creating : t.createAccount}
              </button>

              <p className="auth-muted">{t.or}</p>
              <Button type="button" variant="outline" className="auth-google" onClick={google}>
                <GoogleIcon /> {t.google}
              </Button>
            </form>
          </div>
        </div>

        <div className="auth-panels">
          <div className="auth-panel auth-panel-left">
            <div className="auth-panel-content" dir="auto">
              <h3>{t.newHere}</h3>
              <p>{t.newHereText}</p>
              <button type="button" className="auth-btn auth-btn-ghost" onClick={() => switchTo("signup")}>
                {t.signUp}
              </button>
            </div>
          </div>
          <div className="auth-panel auth-panel-right">
            <div className="auth-panel-content" dir="auto">
              <h3>{t.oneOfUs}</h3>
              <p>{t.oneOfUsText}</p>
              <button type="button" className="auth-btn auth-btn-ghost" onClick={() => switchTo("signin")}>
                {t.signIn}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Every selector is scoped under .auth-switch so nothing leaks into the app.
const AUTH_SWITCH_CSS = `
.auth-switch, .auth-switch * { box-sizing: border-box; }
.auth-switch {
  font-family: var(--font-sans);
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  min-height: 100vh; width: 100%;
  display: flex; justify-content: center; align-items: center; padding: 20px;
}
.auth-switch .auth-box {
  position: relative; width: 100%; max-width: 900px; height: 600px;
  background: var(--color-paper-raised); border-radius: 20px;
  box-shadow: 0 25px 50px rgba(0,0,0,.2); overflow: hidden;
}
.auth-switch .auth-forms { position: absolute; inset: 0; }
.auth-switch .auth-signin-signup {
  position: absolute; top: 50%; left: 75%; width: 50%;
  transform: translate(-50%, -50%);
  transition: 1s .7s ease-in-out; display: grid; grid-template-columns: 1fr; z-index: 5;
}
.auth-switch .auth-form {
  display: flex; align-items: center; justify-content: center; flex-direction: column;
  padding: 0 4rem; transition: all .2s .7s; overflow: hidden; grid-column: 1 / 2; grid-row: 1 / 2;
}
.auth-switch .auth-form-signup { opacity: 0; z-index: 1; pointer-events: none; }
.auth-switch .auth-form-signin { z-index: 2; }
.auth-switch .auth-logo { margin-bottom: 8px; }
.auth-switch .auth-title { font-size: 1.6rem; color: var(--color-ink); margin: 0 0 10px; font-weight: 700; }
.auth-switch .auth-alert { width: 100%; max-width: 380px; margin: 6px 0; }
.auth-switch .auth-field {
  max-width: 380px; width: 100%; background: var(--color-paper); margin: 7px 0; height: 50px;
  border-radius: 50px; display: grid; grid-template-columns: 44px 1fr auto; align-items: center;
  padding: 0 .4rem 0 0; position: relative; transition: .3s;
}
.auth-switch .auth-field:focus-within { box-shadow: 0 0 0 2px var(--color-primary); }
.auth-switch .auth-field-icon { display: flex; justify-content: center; color: var(--color-ink-soft); }
.auth-switch .auth-field input {
  background: none; outline: none; border: none; font-weight: 500; font-size: .95rem;
  color: var(--color-ink); width: 100%; min-width: 0; padding: 0 .5rem 0 0;
}
.auth-switch .auth-field input::placeholder { color: var(--color-ink-soft); font-weight: 400; }
.auth-switch .auth-eye { background: none; border: 0; cursor: pointer; color: var(--color-ink-soft); padding: 0 .75rem; height: 100%; }
.auth-switch .auth-eye:hover { color: var(--color-ink); }
.auth-switch .auth-forgot { align-self: flex-end; max-width: 380px; margin: 2px 0 4px; }
.auth-switch .auth-link { background: none; border: 0; padding: 0; cursor: pointer; color: var(--color-primary); font-size: .8rem; font-weight: 500; text-decoration: none; }
.auth-switch .auth-link:hover { text-decoration: underline; }
.auth-switch .auth-link:disabled { opacity: .6; cursor: default; }
.auth-switch .auth-btn {
  width: 160px; background: var(--color-primary); border: none; outline: none; height: 46px;
  border-radius: 46px; color: #fff; font-weight: 600; margin: 8px 0; cursor: pointer;
  transition: .3s; font-size: .9rem;
}
.auth-switch .auth-btn:hover { background: var(--color-primary-dark); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(37,99,235,.35); }
.auth-switch .auth-btn:disabled { opacity: .7; cursor: default; transform: none; box-shadow: none; }
.auth-switch .auth-muted { font-size: .8rem; color: var(--color-ink-soft); margin: 4px 0; text-align: center; }
.auth-switch .auth-error { font-size: .75rem; color: var(--color-danger); margin: 0; max-width: 380px; width: 100%; }
.auth-switch .auth-rules { font-size: .75rem; color: var(--color-ink-soft); max-width: 380px; width: 100%; margin: 0 0 4px; padding: 0 .75rem; list-style: none; }
.auth-switch .auth-google { max-width: 380px; width: 100%; border-radius: 46px; height: 42px; }
.auth-switch .auth-panels { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(2, 1fr); }
.auth-switch .auth-panel { display: flex; flex-direction: column; align-items: flex-end; justify-content: space-around; text-align: center; z-index: 6; }
.auth-switch .auth-panel-left { pointer-events: all; padding: 3rem 17% 2rem 12%; }
.auth-switch .auth-panel-right { pointer-events: none; padding: 3rem 12% 2rem 17%; }
.auth-switch .auth-panel-content { color: #fff; transition: transform .9s ease-in-out; transition-delay: .6s; }
.auth-switch .auth-panel h3 { font-weight: 600; line-height: 1.2; font-size: 1.5rem; margin: 0 0 10px; }
.auth-switch .auth-panel p { font-size: .95rem; padding: .7rem 0; margin: 0; }
.auth-switch .auth-btn-ghost { margin: 0; background: none; border: 2px solid #fff; width: 140px; height: 41px; font-size: .8rem; }
.auth-switch .auth-btn-ghost:hover { background: rgba(255,255,255,.12); box-shadow: none; }
.auth-switch .auth-panel-right .auth-panel-content { transform: translateX(800px); }
.auth-switch .auth-box:before {
  content: ""; position: absolute; height: 2000px; width: 2000px; top: -10%; right: 48%;
  transform: translateY(-50%);
  background: linear-gradient(-45deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  transition: 1.8s ease-in-out; border-radius: 50%; z-index: 6;
}
.auth-switch .sign-up-mode:before { transform: translate(100%, -50%); right: 52%; }
.auth-switch .sign-up-mode .auth-panel-left .auth-panel-content { transform: translateX(-800px); }
.auth-switch .sign-up-mode .auth-signin-signup { left: 25%; }
.auth-switch .sign-up-mode .auth-form-signup { opacity: 1; z-index: 2; pointer-events: all; }
.auth-switch .sign-up-mode .auth-form-signin { opacity: 0; z-index: 1; pointer-events: none; }
.auth-switch .sign-up-mode .auth-panel-right .auth-panel-content { transform: translateX(0); }
.auth-switch .sign-up-mode .auth-panel-left { pointer-events: none; }
.auth-switch .sign-up-mode .auth-panel-right { pointer-events: all; }

@media (max-width: 870px) {
  .auth-switch .auth-box { min-height: 820px; height: 100vh; }
  .auth-switch .auth-signin-signup { width: 100%; top: 95%; transform: translate(-50%, -100%); transition: 1s .8s ease-in-out; }
  .auth-switch .auth-signin-signup, .auth-switch .sign-up-mode .auth-signin-signup { left: 50%; }
  .auth-switch .auth-panels { grid-template-columns: 1fr; grid-template-rows: 1fr 2fr 1fr; }
  .auth-switch .auth-panel { flex-direction: row; justify-content: space-around; align-items: center; padding: 2.5rem 8%; grid-column: 1 / 2; }
  .auth-switch .auth-panel-right { grid-row: 3 / 4; }
  .auth-switch .auth-panel-left { grid-row: 1 / 2; }
  .auth-switch .auth-panel-content { padding-right: 15%; transition: transform .9s ease-in-out; transition-delay: .8s; }
  .auth-switch .auth-panel h3 { font-size: 1.2rem; }
  .auth-switch .auth-panel p { font-size: .7rem; padding: .5rem 0; }
  .auth-switch .auth-btn-ghost { width: 110px; height: 35px; font-size: .7rem; }
  .auth-switch .auth-box:before { width: 1500px; height: 1500px; transform: translateX(-50%); left: 30%; bottom: 68%; right: initial; top: initial; transition: 2s ease-in-out; }
  .auth-switch .sign-up-mode:before { transform: translate(-50%, 100%); bottom: 32%; right: initial; }
  .auth-switch .sign-up-mode .auth-panel-left .auth-panel-content { transform: translateY(-300px); }
  .auth-switch .sign-up-mode .auth-panel-right .auth-panel-content { transform: translateY(0); }
  .auth-switch .auth-panel-right .auth-panel-content { transform: translateY(300px); }
  .auth-switch .sign-up-mode .auth-signin-signup { top: 5%; transform: translate(-50%, 0); }
}
@media (max-width: 570px) {
  .auth-switch .auth-form { padding: 0 1.25rem; }
  .auth-switch .auth-panel-content { padding: .5rem 1rem; }
}
@media (prefers-reduced-motion: reduce) {
  .auth-switch * { transition: none !important; }
}
`;
