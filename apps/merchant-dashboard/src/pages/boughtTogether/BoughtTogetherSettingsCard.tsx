import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import {
  BOUGHT_TOGETHER_LIMITS,
  apiFieldProblems,
  boughtTogetherGet,
  boughtTogetherRecompute,
  boughtTogetherSave,
  type BoughtTogetherState,
  type Product,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { canManageProducts } from "@/lib/productAccess";
import { formatDateTime } from "@/lib/format";
import { parseWholeNumber } from "@/lib/wholeNumber";
import { pluralOf } from "@/lib/plural";
import { useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { TextField } from "@/components/Field";
import { Section } from "@/components/Section";
import { useToast } from "@/components/Toast";
import { ProductChecklist } from "@/pages/offers/OfferRuleParts";
import { BOUGHT_TOGETHER_STRINGS } from "./boughtTogetherStrings";

/**
 * The product a "Pin products" link on a product page asks a new cross-sell
 * rule for: /offers/cross-sell?pin=<productId>. Null without one.
 */
export function usePinRequest(): string | null {
  const [params] = useSearchParams();
  const id = params.get("pin");
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

/**
 * Offers → Cross-sell → «بيتشروا مع بعض» (handoff 223): the worked-out
 * suggestions' settings — on or off, how far back orders are read, how many
 * shared orders make a pair, and the products never to suggest — with when the
 * pairs were last worked out and «حدّث دلوقتي». Saving works them out again.
 */
export function BoughtTogetherSettingsCard({ products }: { products: Product[] }) {
  const t = useT(BOUGHT_TOGETHER_STRINGS);
  const workspaceId = useWorkspaceId();
  const state = useAsync(() => boughtTogetherGet(apiClient, workspaceId), [workspaceId]);

  return (
    <Section title={t.title} description={t.description} className="mt-6">
      <DataState loading={state.loading} error={state.error} onRetry={() => void state.refresh()}>
        {state.data && (
          <SettingsForm
            // A fresh read (after a save or an update) starts the form from what the server holds.
            key={JSON.stringify([state.data.enabled, state.data.windowDays, state.data.minOrders, state.data.excludedProductIds, state.data.computedAt])}
            initial={state.data}
            products={products}
            onChanged={() => state.refresh({ silent: true })}
          />
        )}
      </DataState>
    </Section>
  );
}

function SettingsForm({ initial, products, onChanged }: { initial: BoughtTogetherState; products: Product[]; onChanged: () => Promise<void> }) {
  const t = useT(BOUGHT_TOGETHER_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageProducts(currentWorkspace?.role);
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const [enabled, setEnabled] = useState(initial.enabled);
  const [windowDays, setWindowDays] = useState(String(initial.windowDays));
  const [minOrders, setMinOrders] = useState(String(initial.minOrders));
  const [excluded, setExcluded] = useState<string[]>(initial.excludedProductIds);
  const [errors, setErrors] = useState<{ windowDays?: string; minOrders?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "update" | null>(null);

  const dirty =
    enabled !== initial.enabled ||
    windowDays.trim() !== String(initial.windowDays) ||
    minOrders.trim() !== String(initial.minOrders) ||
    [...excluded].sort().join(",") !== [...initial.excludedProductIds].sort().join(",");

  function discard() {
    setEnabled(initial.enabled);
    setWindowDays(String(initial.windowDays));
    setMinOrders(String(initial.minOrders));
    setExcluded(initial.excludedProductIds);
    setErrors({});
    setFailure(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const days = parseWholeNumber(windowDays, BOUGHT_TOGETHER_LIMITS.windowDaysMin, BOUGHT_TOGETHER_LIMITS.windowDaysMax);
    const orders = parseWholeNumber(minOrders, BOUGHT_TOGETHER_LIMITS.minOrdersMin, BOUGHT_TOGETHER_LIMITS.minOrdersMax);
    const found = {
      ...(days === null || Number.isNaN(days) ? { windowDays: t.windowDaysError } : {}),
      ...(orders === null || Number.isNaN(orders) ? { minOrders: t.minOrdersError } : {}),
    };
    setErrors(found);
    if (days === null || Number.isNaN(days) || orders === null || Number.isNaN(orders)) return;
    setBusy("save");
    setFailure(null);
    try {
      await boughtTogetherSave(apiClient, workspaceId, { enabled, windowDays: days, minOrders: orders, excludedProductIds: excluded });
      toast.success(t.savedToast);
      await onChanged();
    } catch (err) {
      if (apiFieldProblems(err).some((p) => p.field.startsWith("excludedProductIds"))) {
        // A product deleted meanwhile: back to the list the store has saved.
        setExcluded(initial.excludedProductIds);
        setFailure(t.excludedGone);
      } else {
        setFailure(errorMessage(err));
      }
    } finally {
      setBusy(null);
    }
  }

  async function updateNow() {
    if (busy) return;
    setBusy("update");
    setFailure(null);
    try {
      await boughtTogetherRecompute(apiClient, workspaceId);
      toast.success(t.updatedToast);
      await onChanged();
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const locked = busy !== null || !canManage;

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink has-[:disabled]:cursor-default">
          <input
            type="checkbox"
            className="size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-default"
            checked={enabled}
            disabled={locked}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          {t.enabled}
        </label>
        <p className="text-xs text-ink-soft">{t.enabledHint}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t.windowDays}
          hint={t.windowDaysHint}
          error={errors.windowDays}
          inputMode="numeric"
          dir="ltr"
          autoComplete="off"
          maxLength={4}
          value={windowDays}
          disabled={locked}
          onChange={(e) => {
            setWindowDays(e.target.value);
            setErrors((prev) => ({ ...prev, windowDays: undefined }));
          }}
        />
        <TextField
          label={t.minOrders}
          hint={t.minOrdersHint}
          error={errors.minOrders}
          inputMode="numeric"
          dir="ltr"
          autoComplete="off"
          maxLength={3}
          value={minOrders}
          disabled={locked}
          onChange={(e) => {
            setMinOrders(e.target.value);
            setErrors((prev) => ({ ...prev, minOrders: undefined }));
          }}
        />
      </div>

      <ProductChecklist
        label={t.excluded}
        hint={t.excludedHint}
        products={products}
        value={excluded}
        onChange={setExcluded}
        disabled={locked}
        max={BOUGHT_TOGETHER_LIMITS.excluded}
      />

      {failure && <Alert variant="danger">{failure}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <p className="min-w-0 text-sm text-ink-soft">
          <span className="font-medium text-ink">{pluralOf(t, "pairs", initial.pairs)}</span>
          {" · "}
          {t.lastUpdated}: {initial.computedAt ? formatDateTime(initial.computedAt) : t.never}
        </p>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            {dirty ? (
              <>
                <Button type="button" variant="outline" className="min-h-11" disabled={busy !== null} onClick={discard}>
                  {t.discard}
                </Button>
                <Button type="submit" className="min-h-11" disabled={busy !== null}>
                  {busy === "save" ? t.saving : t.save}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" className="min-h-11" disabled={busy !== null} onClick={() => void updateNow()}>
                {busy === "update" ? t.updating : t.updateNow}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-ink-soft">{t.viewOnly}</p>
        )}
      </div>
    </form>
  );
}
