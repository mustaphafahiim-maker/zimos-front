import { useState, type FormEvent } from "react";
import { Check, Copy, ExternalLink, Rocket } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import { ApiError } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { fmt, useT } from "@/i18n/LocaleContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { formatMoney, formatNumber } from "@/lib/format";
import { GOVERNORATES, storefrontUrl, type StepId } from "./data";
import type { StepProps } from "./state";
import { STRINGS } from "./strings";

export function StepLaunch({ state, update, goTo, setSaving, saving, formId, onFinish }: StepProps & { onFinish: () => void }) {
  const t = useT(STRINGS);
  const { workspaces } = useWorkspace();
  const workspaceId = state.workspaceId!;
  const workspace = workspaces.find((w) => w.id === workspaceId);
  const currency = state.basics?.currency ?? workspace?.defaultCurrency ?? "EGP";
  const url = storefrontUrl(workspaceId);

  const [problems, setProblems] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function publish() {
    if (!state.website || saving) return;
    setError(null);
    setProblems(null);
    setSaving(true);
    try {
      await apiClient.publishWebsite(workspaceId, state.website.id, "Onboarding launch");
      update({ published: { at: new Date().toISOString() } });
    } catch (err) {
      const details = err instanceof ApiError ? (err.details as { error?: { details?: unknown } })?.error?.details : null;
      if (Array.isArray(details) && details.length) {
        setProblems(
          details.map((d: { path?: string; message?: string }) => (d.path ? `${d.path}: ${d.message}` : String(d.message)))
        );
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the URL is visible and selectable */
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onFinish();
  }

  const skipped = (s: StepId) => state.skipped.includes(s);
  const delivery = state.delivery?.rateId ? state.delivery : null;
  const rows: Array<{ step: StepId; label: string; value: string; missing: boolean }> = [
    {
      step: "basics",
      label: t.sumStore,
      value: [state.basics?.name ?? workspace?.name, workspace?.slug ?? state.basics?.slug].filter(Boolean).join(" · "),
      missing: false,
    },
    { step: "look", label: t.sumLook, value: state.website?.ready ? state.website.label : skipped("look") ? t.skippedTag : t.notSet, missing: !state.website?.ready },
    {
      step: "product",
      label: t.sumProduct,
      value: state.product?.variantId
        ? `${state.product.name}${state.product.priceMinor !== undefined ? ` · ${formatMoney(state.product.priceMinor, currency)}` : ""}`
        : skipped("product") ? t.skippedTag : t.notSet,
      missing: !state.product?.variantId,
    },
    {
      step: "delivery",
      label: t.sumDelivery,
      value: delivery
        ? delivery.regionCodes.length === GOVERNORATES.length
          ? fmt(t.allEgypt, { fee: formatMoney(delivery.feeMinor, currency) })
          : fmt(t.deliverySummary, { n: formatNumber(delivery.regionCodes.length), fee: formatMoney(delivery.feeMinor, currency) })
        : skipped("delivery") ? t.skippedTag : t.notSet,
      missing: !delivery,
    },
  ];

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-5">
      <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-raised">
        {rows.map((r) => (
          <div key={r.step} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
            <dt className="w-28 shrink-0 text-sm text-ink-muted">{r.label}</dt>
            <dd className={r.missing ? "min-w-0 flex-1 text-sm text-ink-muted" : "min-w-0 flex-1 truncate text-sm font-medium text-ink"}>
              {r.value}
            </dd>
            <button type="button" onClick={() => goTo(r.step)} className="cursor-pointer text-xs font-medium text-primary hover:underline">
              {t.edit}
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
          <dt className="w-28 shrink-0 text-sm text-ink-muted">{t.sumPayment}</dt>
          <dd className="min-w-0 flex-1 text-sm font-medium text-ink">{t.codOn}</dd>
        </div>
      </dl>

      {error && <Alert variant="danger">{error}</Alert>}
      {problems && (
        <Alert variant="danger">
          <p className="font-medium">{t.publishError}</p>
          <ul className="mt-1 list-disc space-y-0.5 ps-5 text-sm">
            {problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </Alert>
      )}

      {state.published ? (
        <Alert>
          <span className="inline-flex items-center gap-2 font-medium">
            <Check className="size-4 text-success" aria-hidden />
            {t.published}
          </span>
        </Alert>
      ) : state.website?.ready ? (
        <Button type="button" size="lg" onClick={publish} disabled={saving} className="w-full sm:w-auto">
          <Rocket className="size-4" aria-hidden />
          {saving ? t.publishing : t.publish}
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-line-strong p-4">
          <p className="min-w-0 flex-1 text-sm text-ink-soft">{t.needWebsite}</p>
          <Button type="button" variant="outline" onClick={() => goTo("look")}>
            {t.chooseLook}
          </Button>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-ink">{t.storeUrl}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <code dir="ltr" className="min-w-0 flex-1 truncate rounded-[10px] border border-line bg-paper px-3 py-2 text-sm text-ink select-all">
            {url}
          </code>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={copy} className="flex-1 sm:flex-none" aria-live="polite">
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? t.copied : t.copy}
            </Button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-line-strong bg-paper-raised px-3 text-sm font-medium text-ink transition-colors hover:border-primary/40 sm:flex-none"
            >
              <ExternalLink className="size-4 rtl:-scale-x-100" aria-hidden />
              {t.open}
            </a>
          </div>
        </div>
      </div>
    </form>
  );
}
