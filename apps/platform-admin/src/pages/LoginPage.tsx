import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button, Input, Label, Alert, ZimosLogo } from "@store-builder/ui";
import { useAuth, ApiError } from "@/context/AuthContext";
import { BrandPanel } from "@/components/BrandPanel";
import { ThemeToggle } from "@/components/ThemeToggle";

export function LoginPage() {
  const { login } = useAuth();
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
        setError(err.status === 401 ? "Incorrect email or password." : err.message);
      } else {
        setError("Can't reach the server. Check that the backend is running and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <BrandPanel />
      <div className="relative flex flex-1 items-center justify-center px-6 py-16">
        <ThemeToggle className="absolute end-6 top-6" />
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <ZimosLogo height={32} />
          </div>
          <h2 className="text-3xl font-semibold text-ink">Admin sign in</h2>
          <p className="mt-2 text-sm text-ink-soft">Restricted to ZIMOS team accounts with platform admin access.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && <Alert variant="danger">{error}</Alert>}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-ink">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-ink">Password</Label>
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
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 end-0 flex cursor-pointer items-center px-3 text-ink-soft transition-colors hover:text-ink"
                >
                  {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
