import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import { ApiError, aiApplyPolicies } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";

const STRINGS = {
  en: {
    use: "Use as my store policies",
    using: "Saving…",
    replaceNote: "This replaces the {list} you already have. Your terms of service are not touched.",
    confirm: "Replace and save",
    cancel: "Cancel",
    saved: "Saved to your store policies. Review them before you publish ads.",
    open: "Open store policies",
    forbidden: "Only teammates who edit the website can change the store policies.",
    shipping_policy: "shipping policy",
    refund_policy: "refund policy",
    privacy_policy: "privacy policy",
    and: " and ",
  },
  ar: {
    use: "استخدمها كسياسات متجري",
    using: "جارٍ الحفظ…",
    replaceNote: "ده هيستبدل {list} الموجودة عندك. شروط الخدمة مش هتتغير.",
    confirm: "استبدل واحفظ",
    cancel: "إلغاء",
    saved: "اتحفظت في سياسات متجرك. راجعها قبل ما تشغّل إعلانات.",
    open: "افتح سياسات المتجر",
    forbidden: "اللي بيعدّل الموقع بس هو اللي يقدر يغيّر سياسات المتجر.",
    shipping_policy: "سياسة الشحن",
    refund_policy: "سياسة الاسترجاع",
    privacy_policy: "سياسة الخصوصية",
    and: " و",
  },
} satisfies Messages;

const KEYS = ["shipping_policy", "refund_policy", "privacy_policy"] as const;

/**
 * Writes an AI result's shipping, returns and privacy policies into the
 * store's own policies (backend ai/applyPolicies.js). When the store already
 * has some of them, it names them and asks once before replacing.
 */
export function ApplyPoliciesButton({ jobId }: { jobId: string }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace, refresh } = useWorkspace();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const legal = ((currentWorkspace?.settings as { legal?: Record<string, unknown> } | undefined)?.legal ?? {}) as Record<string, unknown>;
  const existing = KEYS.filter((k) => typeof legal[k] === "string" && (legal[k] as string).trim() !== "");

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      await aiApplyPolicies(apiClient, workspaceId, jobId);
      setDone(true);
      setAsking(false);
      toast.success(t.saved);
      void refresh({ silent: true });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? t.forbidden : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Link to="/store-settings" className="inline-block text-sm font-medium text-primary hover:underline">
        {t.open} →
      </Link>
    );
  }

  return (
    <div className="space-y-2">
      {error && <Alert variant="danger">{error}</Alert>}
      {asking ? (
        <>
          <Alert>{t.replaceNote.replace("{list}", existing.map((k) => t[k]).join(t.and))}</Alert>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="min-h-11" disabled={busy} onClick={() => void apply()}>
              {busy ? t.using : t.confirm}
            </Button>
            <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => setAsking(false)}>
              {t.cancel}
            </Button>
          </div>
        </>
      ) : (
        <Button type="button" className="min-h-11" disabled={busy} onClick={() => (existing.length ? setAsking(true) : void apply())}>
          {busy ? t.using : t.use}
        </Button>
      )}
    </div>
  );
}
