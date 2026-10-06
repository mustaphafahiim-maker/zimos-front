import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import { isApiErrorCode } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { AuthBackdrop } from "@/components/AuthBackdrop";
import { UsernameField } from "@/components/UsernameField";
import { useErrorMessage } from "@/lib/errorMessages";
import { normalizeUsername, usernameSubmittable, type UsernameStatus } from "@/lib/username";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Choose your username",
    body: "Your account needs a username before you continue. We suggested one — keep it or pick your own.",
    save: "Continue",
    saving: "Saving…",
    chooseAvailable: "Choose an available username first.",
    taken: "Someone just took this username. Choose another one.",
  },
  ar: {
    title: "اختر اسم المستخدم",
    body: "يحتاج حسابك إلى اسم مستخدم قبل المتابعة. اقترحنا اسمًا — احتفظ به أو اختر اسمك.",
    save: "متابعة",
    saving: "بنحفظ…",
    chooseAvailable: "اختر اسم مستخدم متاحًا أولًا.",
    taken: "استخدم شخص آخر هذا الاسم للتو. اختر اسمًا آخر.",
  },
} satisfies Messages;

/**
 * The step an account made through Google goes through before the dashboard:
 * it has no username yet (ProtectedRoute sends it here). The field starts
 * with the server's suggestion, made from the email.
 */
export function ChooseUsernamePage() {
  const t = useT(STRINGS);
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const errorMessage = useErrorMessage();
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<UsernameStatus>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/workspaces";

  // Already has one (another tab chose it): nothing to do here.
  useEffect(() => {
    if (user?.username) navigate(from, { replace: true });
  }, [user?.username, from, navigate]);

  useEffect(() => {
    let cancelled = false;
    apiClient.getUsernameSuggestion().then(
      (suggestion) => {
        if (!cancelled && suggestion) setUsername((current) => current || suggestion);
      },
      () => undefined
    );
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!usernameSubmittable(status)) {
      setError(t.chooseAvailable);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.changeUsername(normalizeUsername(username));
      await refreshUser();
      navigate(from, { replace: true });
    } catch (err) {
      setError(isApiErrorCode(err, "USERNAME_TAKEN") ? t.taken : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="auth-glass">
      <AuthBackdrop />
      <div className="auth-glass-stage">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5" noValidate>
          <div>
            <h1 className="font-display text-3xl font-medium text-ink">{t.title}</h1>
            <p className="mt-2 text-sm text-ink-soft">{t.body}</p>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          <UsernameField value={username} onChange={setUsername} onStatus={setStatus} autoFocus disabled={saving} />
          <Button type="submit" className="min-h-11 w-full" disabled={saving}>
            {saving ? t.saving : t.save}
          </Button>
        </form>
      </div>
    </div>
  );
}
