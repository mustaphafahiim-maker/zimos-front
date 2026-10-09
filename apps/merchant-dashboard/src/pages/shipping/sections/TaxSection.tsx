import { useState, type FormEvent } from "react";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import type { TaxRate } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { basisPointsToPercentInput, formatPercent, percentToBasisPoints } from "@/lib/format";
import { IconDelete, IconEdit, IconPercent, IconPlus } from "@/components/icons";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/list";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { fmt, useT } from "@/i18n/LocaleContext";
import { LIST_CARD, RowIconButton } from "./RowControls";
import { STRINGS } from "./strings";

/**
 * Tax at checkout: the storewide switch, then the rates it uses.
 *
 * The switch is kept in `workspace.settings` and saved through the same
 * `PATCH /workspaces/:id {settings: {tax_enabled}}` as before — now at the
 * press, with Undo, instead of behind a Save button, so it can never be left
 * changed and unsaved. While tax is off the rates are dimmed and say why.
 */
export function TaxSection({ onSaved }: { onSaved: () => Promise<void> | void }) {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const toast = useToast();
  const tr = useT(STRINGS);
  const taxRates = useAsync(() => apiClient.listTaxRates(workspaceId), [workspaceId]);

  // Seeded from the workspace; a save persists exactly this value, so it stays consistent without re-syncing.
  const [taxEnabled, setTaxEnabled] = useState(Boolean(currentWorkspace?.settings?.tax_enabled));
  const [savingSwitch, setSavingSwitch] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [taxForm, setTaxForm] = useState<TaxRate | "new" | null>(null);
  const [deletingTax, setDeletingTax] = useState<TaxRate | null>(null);

  const reloadTax = () => taxRates.refresh({ silent: true });
  const taxList = taxRates.data ?? [];

  /** Throws when the save fails, after putting the switch back — so an Undo that fails says so. */
  async function persistTaxEnabled(next: boolean) {
    setSwitchError(null);
    setSavingSwitch(true);
    setTaxEnabled(next);
    try {
      await apiClient.updateWorkspace(workspaceId, { settings: { tax_enabled: next } });
      await onSaved();
    } catch (err) {
      setTaxEnabled(!next);
      throw err;
    } finally {
      setSavingSwitch(false);
    }
  }

  async function changeTaxEnabled(next: boolean) {
    try {
      await persistTaxEnabled(next);
      toast.undo(next ? tr.taxOn : tr.taxOff, () => persistTaxEnabled(!next));
    } catch (err) {
      setSwitchError(getErrorMessage(err));
    }
  }

  async function confirmDeleteTax() {
    if (!deletingTax) return;
    await apiClient.deleteTaxRate(workspaceId, deletingTax.id);
    toast.success(fmt(tr.deleted, { name: deletingTax.name }));
    setDeletingTax(null);
    void reloadTax();
  }

  return (
    <div className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
      {switchError && <Alert variant="danger">{switchError}</Alert>}

      <SettingsGroup>
        <SettingsSwitch
          checked={taxEnabled}
          onChange={(next) => void changeTaxEnabled(next)}
          label={tr.chargeTax}
          hint={tr.taxSettingDescription}
          busy={savingSwitch}
        />
      </SettingsGroup>

      <div className="min-w-0 pt-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 ps-4 pe-1">
          <div className="min-w-0 flex-[1_1_12rem]">
            <h3 className="text-[13px] leading-5 font-semibold text-ink-soft">{tr.taxHeading}</h3>
            {!taxEnabled && <p className="mt-0.5 text-[13px] leading-5 text-ink-soft">{tr.taxOffNote}</p>}
          </div>
          {taxList.length > 0 && (
            <Button className="min-h-11 rounded-full px-4" onClick={() => setTaxForm("new")}>
              <IconPlus weight="bold" aria-hidden />
              {tr.addTax}
            </Button>
          )}
        </div>

        <DataState
          loading={taxRates.loading}
          error={taxRates.error}
          onRetry={() => taxRates.refresh()}
          skeleton={<ListSkeleton rows={3} variant="card" />}
        >
          {taxList.length === 0 ? (
            <EmptyState
              icon={<IconPercent aria-hidden />}
              title={tr.taxEmptyTitle}
              description={tr.taxEmpty}
              action={
                <Button className="min-h-11 rounded-full px-5" onClick={() => setTaxForm("new")}>
                  <IconPlus weight="bold" aria-hidden />
                  {tr.addTax}
                </Button>
              }
            />
          ) : (
            <ul
              role="list"
              data-slot="card"
              className={cn(LIST_CARD, "transition-opacity duration-[var(--dur-fade)] motion-reduce:transition-none", !taxEnabled && "opacity-60")}
            >
              {taxList.map((t) => {
                const where = [t.country, t.region].filter(Boolean).join(" · ");
                return (
                  <li key={t.id} className="flex min-h-13 flex-wrap items-center gap-x-2 border-t border-line py-1.5 ps-4 pe-2 first:border-t-0">
                    <div className="min-w-0 flex-[1_1_10rem]">
                      <p className="flex items-baseline gap-2 text-sm leading-5 font-medium text-ink">
                        <span className="min-w-0 truncate">{t.name}</span>
                        <span className="shrink-0 font-semibold tabular-nums">{formatPercent(t.rateBasisPoints)}</span>
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] leading-5 text-ink-soft">
                        {where && <span dir="auto">{where}</span>}
                        {t.appliesToShipping && <StatusBadge value="applies_to_shipping" tone="info" text={tr.appliesToShipping} />}
                        {t.pricesIncludeTax && <StatusBadge value="prices_include_tax" tone="neutral" text={tr.colPricesIncludeTax} />}
                      </div>
                    </div>
                    <div className="ms-auto flex shrink-0 items-center">
                      <RowIconButton label={fmt(tr.editNamed, { name: t.name })} onClick={() => setTaxForm(t)}>
                        <IconEdit aria-hidden />
                      </RowIconButton>
                      <RowIconButton label={fmt(tr.deleteNamed, { name: t.name })} onClick={() => setDeletingTax(t)} danger>
                        <IconDelete aria-hidden />
                      </RowIconButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </DataState>
      </div>

      <Modal open={taxForm !== null} onClose={() => setTaxForm(null)} title={taxForm === "new" ? tr.addTax : tr.editTax}>
        {taxForm !== null && (
          <TaxRateForm
            key={taxForm === "new" ? "new" : taxForm.id}
            taxRate={taxForm === "new" ? undefined : taxForm}
            onCancel={() => setTaxForm(null)}
            onDone={() => {
              setTaxForm(null);
              void reloadTax();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deletingTax !== null}
        title={fmt(tr.deleteTitle, { name: deletingTax?.name ?? "" })}
        description={tr.deleteTaxBody}
        confirmLabel={tr.deleteTaxConfirm}
        cancelLabel={tr.cancel}
        busyLabel={tr.working}
        destructive
        onCancel={() => setDeletingTax(null)}
        onConfirm={confirmDeleteTax}
      />
    </div>
  );
}

function TaxRateForm({
  taxRate,
  onDone,
  onCancel,
}: {
  taxRate?: TaxRate;
  onDone: () => void;
  onCancel: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const tr = useT(STRINGS);
  const [name, setName] = useState(taxRate?.name ?? "");
  const [country, setCountry] = useState(taxRate?.country ?? "");
  const [region, setRegion] = useState(taxRate?.region ?? "");
  const [rate, setRate] = useState(
    taxRate ? basisPointsToPercentInput(taxRate.rateBasisPoints) : ""
  );
  const [appliesToShipping, setAppliesToShipping] = useState(taxRate?.appliesToShipping ?? false);
  const [pricesIncludeTax, setPricesIncludeTax] = useState(taxRate?.pricesIncludeTax ?? false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const bp = percentToBasisPoints(rate);
    if (!Number.isFinite(bp) || bp < 0) {
      setFieldErrors({ rateBasisPoints: tr.errPercent });
      return;
    }
    const countryValue = country.trim().toUpperCase();
    if (countryValue && countryValue.length !== 2) {
      setFieldErrors({ country: tr.errCountry });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        country: countryValue || null,
        region: region.trim() || null,
        rateBasisPoints: bp,
        appliesToShipping,
        pricesIncludeTax,
      };
      if (taxRate) {
        await apiClient.updateTaxRate(workspaceId, taxRate.id, payload);
        toast.success(tr.taxSaved);
      } else {
        await apiClient.createTaxRate(workspaceId, payload);
        toast.success(fmt(tr.added, { name: payload.name }));
      }
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <TextField
        label={tr.name}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        placeholder={tr.taxNamePlaceholder}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={tr.country}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          error={fieldErrors.country}
          hint={tr.countryHint}
          placeholder="EG"
        />
        <TextField
          label={tr.region}
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          error={fieldErrors.region}
          hint={tr.optional}
        />
      </div>

      <Field
        label={tr.taxRate}
        required
        error={fieldErrors.rateBasisPoints}
        hint={tr.taxRateHint}
      >
        {({ id, ...aria }) => (
          <div className="relative">
            <Input
              id={id}
              {...aria}
              type="number"
              min={0}
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="pe-8"
            />
            <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-sm text-ink-soft">
              %
            </span>
          </div>
        )}
      </Field>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={appliesToShipping}
          onChange={(e) => setAppliesToShipping(e.target.checked)}
        />
        {tr.appliesToShipping}
      </label>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={pricesIncludeTax}
          onChange={(e) => setPricesIncludeTax(e.target.checked)}
        />
        {tr.pricesAlreadyIncludeTax}
      </label>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {tr.cancel}
        </Button>
        <Button type="submit" disabled={saving || name.trim() === ""}>
          {saving ? tr.saving : taxRate ? tr.saveTax : tr.addTax}
        </Button>
      </div>
    </form>
  );
}
