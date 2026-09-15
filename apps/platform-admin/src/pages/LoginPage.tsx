import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button, Input, Label, Alert, ZimosLogo, ThemeToggle } from "@store-builder/ui";
import { useAuth, ApiError } from "@/context/AuthContext";
import { BrandPanel } from "@/components/BrandPanel";
import { LocaleToggle } from "@/components/AdminLayout";
import { useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Admin sign in",
    subtitle: "Restricted to ZIMOS team accounts with platform admin access.",
    email: "Email",
    password: "Password",
    show: "Show password",
    hide: "Hide password",
    submit: "Sign in",
    submitting: "Signing in…",
    wrong: "Incorrect email or password.",
    notAdmin: "This account isn't a platform admin. Ask a ZIMOS super admin to grant access.",
    unreachable: "Can't reach the server. Check that the backend is running and try again.",
  },
  ar: {
    title: "دخول الأدمن",
    subtitle: "مخصص لحسابات فريق ZIMOS اللي عندها صلاحية أدمن المنصة.",
    email: "الإيميل",
    password: "كلمة السر",
    show: "اظهر كلمة السر",
    hide: "اخفي كلمة السر",
    submit: "دخول",
    submitting: "جاري الدخول…",
    wrong: "الإيميل أو كلمة السر غلط.",
    notAdmin: "الحساب ده مش أدمن للمنصة. اطلب الصلاحية من سوبر أدمن في ZIMOS.",
    unreachable: "مش قادرين نوصل للسيرفر. اتأكد إن الباك إند شغال وجرّب تاني.",
  },
};

export function LoginPage() {
  const { login } = useAuth();
  const t = useT(STRINGS);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? t.wrong : err.status === 403 ? t.notAdmin : err.message);
      } else {
        setError(t.unreachable);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <BrandPanel />
      <div className="relative flex flex-1 items-center justify-center px-6 py-16">
        <div className="absolute end-6 top-6 flex items-center gap-2">
          <LocaleToggle />
          <ThemeToggle variant="outline" />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <ZimosLogo height={32} />
          </div>
          <h2 className="text-3xl font-semibold text-ink">{t.title}</h2>
          <p className="mt-2 text-sm text-ink-soft">{t.subtitle}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && <Alert variant="danger">{error}</Alert>}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-ink">{t.email}</Label>
              <Input id="email" type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-ink">{t.password}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t.hide : t.show}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 end-0 flex cursor-pointer items-center px-3 text-ink-soft transition-colors hover:text-ink"
                >
                  {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? t.submitting : t.submit}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
