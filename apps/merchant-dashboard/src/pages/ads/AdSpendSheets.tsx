import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  PROFIT_AD_PLATFORMS,
  profitAddAdSpend,
  profitImportAdSpend,
  type ProfitAdPlatform,
  type ProfitAdSpendImport,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { formatMoney, majorToMinor } from "@/lib/format";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";
import { Field, TextField } from "@/components/Field";
import { IconUpload } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { focusFirstInvalid } from "@/pages/marketing/kit/form";
import { ADS_STRINGS } from "./adsStrings";

const today = () => new Date().toISOString().slice(0, 10);

function PlatformSelect({
  id,
  value,
  onChange,
  emptyLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  emptyLabel?: string;
}) {
  const t = useT(ADS_STRINGS);
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {emptyLabel && <option value="">{emptyLabel}</option>}
      {PROFIT_AD_PLATFORMS.map((p) => (
        <option key={p} value={p}>
          {t[p]}
        </option>
      ))}
    </Select>
  );
}

/**
 * One amount for one day and campaign, in a sheet over the list. `campaign`
 * starts the name field — from a campaign that brought orders with no spend
 * recorded, so its name is not typed twice.
 */
export function AddSpendSheet({
  workspaceId,
  currency,
  campaign = "",
  onClose,
  onSaved,
}: {
  workspaceId: string;
  currency: string;
  campaign?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(ADS_STRINGS);
  const common = useCommon();
  const toast = useToast();
  const [day, setDay] = useState(today());
  const [platform, setPlatform] = useState<ProfitAdPlatform>("meta");
  const [campaignName, setCampaignName] = useState(campaign);
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<{ day?: string; campaign?: string; amount?: string }>({});
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const spendAmount = majorToMinor(amount);
    const next = {
      day: day ? undefined : t.dayRequired,
      campaign: campaignName.trim() ? undefined : t.required,
      amount: Number.isFinite(spendAmount) && spendAmount >= 0 ? undefined : t.invalidAmount,
    };
    setErrors(next);
    if (next.campaign || next.amount || next.day) {
      focusFirstInvalid(e.currentTarget);
      return;
    }
    setBusy(true);
    try {
      await profitAddAdSpend(apiClient, workspaceId, { day, platform, campaignName: campaignName.trim(), spendAmount });
      toast.success(t.saved);
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t.addTitle}
      description={t.addDesc}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose} disabled={busy}>
            {common.cancel}
          </Button>
          <Button type="submit" form="ad-spend-form" className="rounded-full px-5" disabled={busy}>
            {busy ? common.saving : common.save}
          </Button>
        </>
      }
    >
      <form id="ad-spend-form" noValidate onSubmit={(e) => void save(e)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label={t.campaignName}
          hint={t.campaignHint}
          required
          dir="ltr"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={campaignName}
          error={errors.campaign}
          onChange={(e) => setCampaignName(e.target.value)}
          className="sm:col-span-2"
        />
        <MoneyInput label={t.amount} required value={amount} onChange={setAmount} currency={currency} error={errors.amount} />
        <TextField label={t.day} type="date" required value={day} max={today()} error={errors.day} onChange={(e) => setDay(e.target.value)} />
        <Field label={t.platform} required className="sm:col-span-2">
          {({ id }) => <PlatformSelect id={id} value={platform} onChange={(v) => setPlatform(v as ProfitAdPlatform)} />}
        </Field>
      </form>
    </Modal>
  );
}

/** The CSV of an ads manager: choose the file, check it (a dry run), then import what is ready. */
export function ImportSpendSheet({ workspaceId, onClose, onImported }: { workspaceId: string; onClose: () => void; onImported: () => void }) {
  const t = useT(ADS_STRINGS);
  const common = useCommon();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [platform, setPlatform] = useState("");
  const [check, setCheck] = useState<ProfitAdSpendImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"check" | "import" | null>(null);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCheck(null);
    setError(null);
    if (file.size > 1_000_000) return setError(t.fileTooBig);
    setFileName(file.name);
    setCsv(await file.text());
  }

  async function run(dryRun: boolean) {
    setBusy(dryRun ? "check" : "import");
    setError(null);
    try {
      const result = await profitImportAdSpend(apiClient, workspaceId, {
        csv,
        defaultPlatform: (platform || undefined) as ProfitAdPlatform | undefined,
        dryRun,
      });
      if (dryRun) setCheck(result);
      else {
        toast.success(fmt(t.imported, { created: result.created, updated: result.updated }));
        onImported();
        return;
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
    setBusy(null);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t.importTitle}
      description={t.importDesc}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose} disabled={busy !== null}>
            {common.cancel}
          </Button>
          {check && check.valid > 0 ? (
            <Button type="button" className="rounded-full px-5" onClick={() => void run(false)} disabled={busy !== null}>
              {busy === "import" ? t.importing : fmt(t.importNow, { n: check.valid })}
            </Button>
          ) : (
            <Button type="button" className="rounded-full px-5" onClick={() => void run(true)} disabled={busy !== null || !csv}>
              {busy === "check" ? t.checking : t.check}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void onFile(e)} />
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={() => input.current?.click()}>
            <IconUpload className="size-4" weight="bold" aria-hidden />
            {fileName ? t.changeFile : t.chooseFile}
          </Button>
          {fileName && (
            <bdi dir="ltr" className="min-w-0 truncate text-sm text-ink-soft">
              {fileName}
            </bdi>
          )}
        </div>
        <div data-slot="sweep-well" className="rounded-2xl bg-paper-sunken px-4 py-3">
          <p className="text-xs font-medium text-ink-soft">{t.template}</p>
          <code dir="ltr" className="mt-1 block overflow-x-auto text-start text-xs leading-5 whitespace-pre text-ink">
            {"Date,Platform,Campaign name,Amount spent\n2026-10-01,meta,ramadan_sale,1250.50"}
          </code>
        </div>
        <Field label={t.defaultPlatform}>
          {({ id }) => (
            <PlatformSelect
              id={id}
              value={platform}
              emptyLabel={t.fromFile}
              onChange={(v) => {
                setPlatform(v);
                setCheck(null);
              }}
            />
          )}
        </Field>
        {error && <Alert variant="danger">{error}</Alert>}
        {check && (
          <div role="status" data-slot="sweep-well" className="rounded-2xl bg-paper-sunken px-4 py-3 text-sm">
            <p className="font-medium text-ink">
              {fmt(t.checkResult, { valid: check.valid, rows: check.rows, total: formatMoney(check.totalSpendAmount, check.currency) })}
            </p>
            {check.errorCount > 0 && (
              <>
                <p className="mt-2 font-medium text-danger">{fmt(t.rejected, { n: check.errorCount })}</p>
                <ul className="mt-1 max-h-32 overflow-y-auto text-xs leading-5 text-ink-soft">
                  {check.errors.map((e) => (
                    <li key={e.line} dir="ltr" className="text-start">
                      {fmt(t.line, { n: e.line, problems: e.problems.join(", ") })}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
