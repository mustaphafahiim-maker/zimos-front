import { useState } from "react";
import { Alert, Button, cn } from "@store-builder/ui";
import { ApiError, type PaymentGatewayInfo, type PaymentMethodEntry } from "@store-builder/api-client";
import { IconArrowDown, IconArrowUp } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { SaveBar } from "@/components/SaveBar";
import { StatusBadge } from "@/components/StatusBadge";
import { SettingsGroup } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { ExpressWalletBadges, useMethodLabel } from "../ExpressPayments";
import { GROUP_ROW, ToggleSwitch } from "./paneParts";

const STRINGS = {
  en: {
    methodListHint:
      "One gateway per method: turning one on turns the other gateway's same method off. At least one must stay on.",
    methodCod: "Cash on delivery",
    methodUnavailable: "Not connected",
    modeTest: "Test mode",
    moveUp: "Move {name} up",
    moveDown: "Move {name} down",
    showMethod: "Show {name} at checkout",
    position: "{n}",
    saveMethods: "Save methods",
    methodsSaved: "Payment methods saved.",
    viewOnly: "Only the store owner or a workspace manager can change these.",
  },
  ar: {
    methodListHint:
      "بوابة واحدة لكل طريقة: لما تشغّل طريقة من بوابة، نفس الطريقة بتقف من البوابة التانية. لازم طريقة واحدة على الأقل تفضل شغّالة.",
    methodCod: "الدفع عند الاستلام",
    methodUnavailable: "مش مربوطة",
    modeTest: "وضع التجربة",
    moveUp: "طلّع {name} لفوق",
    moveDown: "نزّل {name} لتحت",
    showMethod: "اعرض {name} في الفورم",
    position: "{n}",
    saveMethods: "احفظ طرق الدفع",
    methodsSaved: "اتحفظت طرق الدفع.",
    viewOnly: "صاحب المتجر أو مدير مساحة العمل بس اللي يقدر يغيّر دول.",
  },
} satisfies Messages;

/**
 * Payments → Checkout methods: what a shopper is offered, in the order they
 * see it. Each row has its switch and its place (up / down); the whole
 * ordered list is saved together, from the save bar.
 *
 * Remounted (key) whenever the saved list changes, so the draft starts from it.
 */
export function CheckoutMethodsSection({
  methods,
  gateways,
  canManage,
  onForbidden,
  onSaved,
}: {
  methods: PaymentMethodEntry[];
  gateways: PaymentGatewayInfo[];
  canManage: boolean;
  onForbidden: () => void;
  onSaved: (next: PaymentMethodEntry[]) => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [draft, setDraft] = useState(methods);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOf = (provider: string | null) => gateways.find((g) => g.code === provider)?.name ?? provider ?? "";
  const methodLabel = useMethodLabel();
  const labelOf = (m: PaymentMethodEntry) => (m.method === "cod" ? t.methodCod : methodLabel(m.method, nameOf(m.provider)));

  const dirty = JSON.stringify(draft.map((m) => [m.id, m.enabled])) !== JSON.stringify(methods.map((m) => [m.id, m.enabled]));
  useReportDirty(dirty);

  function move(index: number, delta: number) {
    setDraft((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });
  }

  function toggle(m: PaymentMethodEntry, on: boolean) {
    // One gateway per method: switching this on switches off the same method on any other gateway.
    setDraft((list) =>
      list.map((x) =>
        x.id === m.id ? { ...x, enabled: on } : on && m.method !== "cod" && x.method === m.method ? { ...x, enabled: false } : x
      )
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const result = await apiClient.updatePaymentMethods(
        workspaceId,
        draft.map((m) => ({ id: m.id, enabled: m.enabled }))
      );
      toast.success(t.methodsSaved);
      onSaved(result.methods);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) onForbidden();
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SettingsGroup footer={canManage ? t.methodListHint : t.viewOnly}>
        {draft.map((m, index) => {
          const name = labelOf(m);
          return (
            <div key={m.id} className={cn(GROUP_ROW, "gap-2 py-2 pe-2")}>
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center max-sm:hidden justify-center rounded-full bg-ink/6 text-[13px] font-semibold text-ink-soft tabular-nums"
              >
                {fmt(t.position, { n: index + 1 })}
              </span>
              <span className={cn("flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 ps-1", !m.available && "opacity-60")}>
                <span className="text-sm leading-5 font-medium text-ink">{name}</span>
                <ExpressWalletBadges method={m} />
                {m.mode === "test" && m.method !== "cod" && <StatusBadge value="test" tone="warning" text={t.modeTest} />}
                {!m.available && <StatusBadge value="unavailable" tone="neutral" text={t.methodUnavailable} />}
              </span>
              {canManage && (
                <span className="flex shrink-0">
                  <Button
                    variant="ghost"
                    className="size-11 rounded-full p-0"
                    aria-label={fmt(t.moveUp, { name })}
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <IconArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    className="size-11 rounded-full p-0"
                    aria-label={fmt(t.moveDown, { name })}
                    disabled={busy || index === draft.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <IconArrowDown className="size-4" aria-hidden />
                  </Button>
                </span>
              )}
              <ToggleSwitch
                checked={m.enabled}
                disabled={!canManage || busy}
                label={fmt(t.showMethod, { name })}
                onChange={(on) => toggle(m, on)}
              />
            </div>
          );
        })}
      </SettingsGroup>
      {error && <Alert variant="danger">{error}</Alert>}
      {canManage && (
        <SaveBar
          dirty={dirty}
          saving={busy}
          onSave={() => void save()}
          onDiscard={() => {
            setDraft(methods);
            setError(null);
          }}
          saveLabel={t.saveMethods}
        />
      )}
    </>
  );
}
