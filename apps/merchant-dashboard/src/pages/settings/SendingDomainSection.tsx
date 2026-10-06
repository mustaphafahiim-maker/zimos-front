import { useState, type FormEvent } from "react";
import { CheckCircle2, CircleAlert, CircleDashed, Globe, RefreshCw, Trash2 } from "lucide-react";
import { Alert, Button, Input, Label, Spinner, cn } from "@store-builder/ui";
import {
  apiFieldProblems,
  sendingDomainAdd,
  sendingDomainGet,
  sendingDomainRemove,
  sendingDomainSetLocalPart,
  sendingDomainVerify,
  type SendingDomain,
  type SendingDomainRecord,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { TextField } from "@/components/Field";
import { StatusBadge } from "@/components/StatusBadge";
import { DataTable, type Column } from "@/components/DataTable";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

/**
 * Settings → Messages → Order emails → "Sending domain" (handoff item 173):
 * the store's customer emails leave from its own domain (orders@mystore.com)
 * once the DNS records are added and verified. Until then — and again if a
 * later check fails — they leave from the platform's address under the
 * store's sender name (OrderEmailSender.tsx).
 */

const STRINGS = {
  en: {
    title: "Sending domain",
    description: "Send customer emails from your own domain",
    loading: "Loading…",
    loadFailed: "We couldn't load your sending domain.",
    retry: "Try again",
    domain: "Your domain",
    domainPlaceholder: "mystore.com",
    domainHint: "The domain your store's website uses, without https:// or www.",
    domainInvalid: "Enter a domain like mystore.com",
    domainTaken: "Another store already sends from this domain",
    address: "Email address",
    addressHint: "Letters, digits, dots, dashes or underscores before the @.",
    addressInvalid: "Use English letters, digits, “.”, “_” or “-”, starting with a letter or digit.",
    addressPreview: "Customers will see emails from {address}",
    add: "Add domain",
    adding: "Adding…",
    untilVerified: "Until it's verified, emails keep going out from Zimos's address under your store's name.",
    pending: "Pending",
    verified: "Verified",
    failed: "Failed",
    sentFrom: "Customer emails are sent from {address}",
    failedNote: "The last check couldn't find all the records, so emails are going out from Zimos's address again. Check the records at your domain provider, then verify.",
    records: "Add these records at your domain provider",
    showRecords: "Show DNS records",
    hideRecords: "Hide DNS records",
    type: "Type",
    host: "Name / Host",
    value: "Value",
    check: "Check",
    copy: "Copy",
    found: "Found",
    notFound: "Not found yet",
    notChecked: "Not checked yet",
    advised: "Advised",
    purpose_spf: "SPF",
    purpose_dkim: "DKIM",
    purpose_return_path: "Return path",
    purpose_dmarc: "DMARC",
    verify: "Verify",
    verifying: "Checking…",
    checkAgain: "Check again",
    lastChecked: "Last checked {time}",
    neverChecked: "Not checked yet",
    dnsDelay: "DNS changes can take up to 48 hours",
    verifiedToast: "Your domain is verified. Customer emails now go out from {address}.",
    notYetToast: "Some records aren't found yet. DNS changes can take up to 48 hours — try again later.",
    failedToast: "The check failed: emails are going out from Zimos's address until the records are found again.",
    changeAddress: "Change address",
    saveAddress: "Save address",
    saving: "Saving…",
    cancel: "Cancel",
    addressSaved: "Address saved.",
    remove: "Remove domain",
    removeTitle: "Remove {domain}?",
    removeBody: "Customer emails will go out from Zimos's address again, under your store's name. You can add the domain again later.",
    removeConfirm: "Remove domain",
    removing: "Removing…",
    removed: "Domain removed.",
  },
  ar: {
    title: "دومين الإرسال",
    description: "ابعت إيميلات العملاء من الدومين بتاعك",
    loading: "بيحمّل…",
    loadFailed: "معرفناش نحمّل دومين الإرسال.",
    retry: "جرّب تاني",
    domain: "الدومين بتاعك",
    domainPlaceholder: "mystore.com",
    domainHint: "الدومين اللي موقع متجرك عليه، من غير https:// ولا www.",
    domainInvalid: "اكتب دومين زي mystore.com",
    domainTaken: "متجر تاني بيبعت من الدومين ده",
    address: "عنوان الإيميل",
    addressHint: "حروف أو أرقام أو نقط أو شرط قبل الـ @.",
    addressInvalid: "استخدم حروف إنجليزي أو أرقام أو «.» أو «_» أو «-»، ويبدأ بحرف أو رقم.",
    addressPreview: "العملاء هيشوفوا الإيميلات جاية من {address}",
    add: "ضيف الدومين",
    adding: "بيضيف…",
    untilVerified: "لحد ما يتأكد، الإيميلات هتفضل تتبعت من عنوان زيموس باسم متجرك.",
    pending: "في الانتظار",
    verified: "متأكد",
    failed: "فشل",
    sentFrom: "إيميلات العملاء بتتبعت من {address}",
    failedNote: "آخر فحص ملقاش كل السجلات، فالإيميلات رجعت تتبعت من عنوان زيموس. راجع السجلات عند مزوّد الدومين ودوس تحقق.",
    records: "ضيف السجلات دي عند مزوّد الدومين",
    showRecords: "اعرض سجلات الـ DNS",
    hideRecords: "اخفي سجلات الـ DNS",
    type: "النوع",
    host: "الاسم / Host",
    value: "القيمة",
    check: "الفحص",
    copy: "انسخ",
    found: "موجود",
    notFound: "لسه مش موجود",
    notChecked: "لسه متفحصش",
    advised: "مستحسن",
    purpose_spf: "SPF",
    purpose_dkim: "DKIM",
    purpose_return_path: "Return path",
    purpose_dmarc: "DMARC",
    verify: "تحقق",
    verifying: "بيفحص…",
    checkAgain: "افحص تاني",
    lastChecked: "آخر فحص {time}",
    neverChecked: "لسه متفحصش",
    dnsDelay: "تغييرات الـ DNS ممكن تاخد لحد ٤٨ ساعة",
    verifiedToast: "الدومين اتأكد. إيميلات العملاء بقت بتتبعت من {address}.",
    notYetToast: "فيه سجلات لسه مش موجودة. تغييرات الـ DNS ممكن تاخد لحد ٤٨ ساعة — جرّب تاني بعدين.",
    failedToast: "الفحص فشل: الإيميلات هتتبعت من عنوان زيموس لحد ما السجلات ترجع.",
    changeAddress: "غيّر العنوان",
    saveAddress: "احفظ العنوان",
    saving: "بيحفظ…",
    cancel: "إلغاء",
    addressSaved: "العنوان اتحفظ.",
    remove: "شيل الدومين",
    removeTitle: "تشيل {domain}؟",
    removeBody: "إيميلات العملاء هترجع تتبعت من عنوان زيموس باسم متجرك. تقدر تضيف الدومين تاني بعدين.",
    removeConfirm: "شيل الدومين",
    removing: "بيشيل…",
    removed: "الدومين اتشال.",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

// The server's own rules (emailDomains/sendingDomain.js), checked here first so
// the merchant gets the sentence in their language before a round trip.
const DOMAIN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const LOCAL = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** "https://www.MyStore.com/path" → "www.mystore.com"; "orders@x.com" keeps only the domain. */
function cleanDomain(raw: string): string {
  let v = raw.trim().toLowerCase();
  v = v.replace(/^[a-z]+:\/\//, "");
  v = v.split(/[/?#]/)[0] ?? "";
  if (v.includes("@")) v = v.slice(v.lastIndexOf("@") + 1);
  return v.replace(/\.$/, "");
}

const STATUS_TONE = { pending: "warning", verified: "success", failed: "danger" } as const;

export function SendingDomainSection() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const current = useAsync(() => sendingDomainGet(apiClient, workspaceId), [workspaceId]);

  // The templates list below already explains a missing permission.
  if (current.error && isPermissionError(current.error)) return null;

  const domain = current.data;
  return (
    <section aria-labelledby="sending-domain-title" className="mt-4 space-y-3 rounded-[var(--radius-card)] bg-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id="sending-domain-title" className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Globe className="size-4 text-ink-soft" aria-hidden />
            {t.title}
          </h3>
          <p className="mt-0.5 text-xs text-ink-soft">{t.description}</p>
        </div>
        {domain && <StatusBadge value={domain.status} tone={STATUS_TONE[domain.status] ?? "neutral"} text={t[domain.status] ?? domain.status} />}
      </div>

      {current.loading ? (
        <p role="status" className="flex items-center gap-2 text-sm text-ink-soft">
          <Spinner className="size-4" aria-hidden />
          {t.loading}
        </p>
      ) : current.error ? (
        <Alert variant="danger" className="flex flex-wrap items-center justify-between gap-2">
          <span>{t.loadFailed}</span>
          <Button size="sm" variant="outline" className="min-h-11 sm:min-h-8" onClick={() => void current.refresh()}>
            {t.retry}
          </Button>
        </Alert>
      ) : domain ? (
        <DomainDetails t={t} domain={domain} onChange={(next) => current.setData(next)} />
      ) : (
        <AddDomainForm t={t} onAdded={(next) => current.setData(next)} />
      )}
    </section>
  );
}

function AddDomainForm({ t, onAdded }: { t: T; onAdded: (domain: SendingDomain) => void }) {
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [domain, setDomain] = useState("");
  const [localPart, setLocalPart] = useState("orders");
  const [errors, setErrors] = useState<{ domain?: string; localPart?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const cleaned = cleanDomain(domain);
  const local = localPart.trim().toLowerCase();
  const [previewBefore, previewAfter] = t.addressPreview.split("{address}");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!DOMAIN.test(cleaned)) next.domain = t.domainInvalid;
    if (!LOCAL.test(local)) next.localPart = t.addressInvalid;
    setErrors(next);
    if (next.domain || next.localPart) return;
    setBusy(true);
    try {
      const added = await sendingDomainAdd(apiClient, workspaceId, { domain: cleaned, localPart: local });
      onAdded(added);
    } catch (err) {
      const fields = apiFieldProblems(err);
      if (fields.some((f) => f.field === "domain")) setErrors({ domain: t.domainInvalid });
      else if (fields.some((f) => f.field === "localPart")) setErrors({ localPart: t.addressInvalid });
      else setErrors({ form: errorMessage(err, { EMAIL_DOMAIN_TAKEN: t.domainTaken }) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      {errors.form && <Alert variant="danger">{errors.form}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={t.domain}
          hint={t.domainHint}
          error={errors.domain}
          dir="ltr"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t.domainPlaceholder}
          value={domain}
          maxLength={253}
          onChange={(e) => setDomain(e.target.value)}
        />
        <LocalPartField t={t} value={localPart} onChange={setLocalPart} domain={cleaned || t.domainPlaceholder} error={errors.localPart} />
      </div>
      <p className="text-xs text-ink-soft">
        {previewBefore}
        <bdi dir="ltr" className="font-medium text-ink">{`${local || "orders"}@${cleaned || t.domainPlaceholder}`}</bdi>
        {previewAfter}
      </p>
      <p className="text-xs text-ink-soft">{t.untilVerified}</p>
      <Button type="submit" disabled={busy || !domain.trim()} className="min-h-11 sm:min-h-9">
        {busy && <Spinner className="size-4" aria-hidden />}
        {busy ? t.adding : t.add}
      </Button>
    </form>
  );
}

/** The part before the @, with the domain drawn after it — always left to right, as an address reads. */
function LocalPartField({ t, value, onChange, domain, error }: { t: T; value: string; onChange: (v: string) => void; domain: string; error?: string }) {
  const id = "sending-domain-local";
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{t.address}</Label>
      <div dir="ltr" className="flex min-w-0 items-center gap-1.5">
        <Input
          id={id}
          dir="ltr"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint`}
          value={value}
          maxLength={64}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          className={cn("w-36 min-w-0 shrink", error && "border-danger focus-visible:ring-danger/30")}
        />
        <span className="min-w-0 truncate text-sm text-ink-soft">@{domain}</span>
      </div>
      <p id={`${id}-hint`} className={cn("text-xs", error ? "font-medium text-danger" : "text-ink-soft")}>
        {error ?? t.addressHint}
      </p>
    </div>
  );
}

function DomainDetails({ t, domain, onChange }: { t: T; domain: SendingDomain; onChange: (domain: SendingDomain | null) => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [verifying, setVerifying] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [localPart, setLocalPart] = useState(domain.localPart);
  const [addressError, setAddressError] = useState<string | undefined>();
  const [savingAddress, setSavingAddress] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const verified = domain.status === "verified";
  const [showRecords, setShowRecords] = useState(!verified);
  const checked = domain.lastCheckedAt !== null;

  async function verify() {
    setVerifying(true);
    try {
      const next = await sendingDomainVerify(apiClient, workspaceId);
      onChange(next);
      if (next.status === "verified") toast.success(fmt(t.verifiedToast, { address: next.fromAddress }));
      else {
        setShowRecords(true);
        toast.error(next.status === "failed" ? t.failedToast : t.notYetToast);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setVerifying(false);
    }
  }

  async function saveAddress(e: FormEvent) {
    e.preventDefault();
    const local = localPart.trim().toLowerCase();
    if (!LOCAL.test(local)) {
      setAddressError(t.addressInvalid);
      return;
    }
    setAddressError(undefined);
    setSavingAddress(true);
    try {
      onChange(await sendingDomainSetLocalPart(apiClient, workspaceId, local));
      setEditingAddress(false);
      toast.success(t.addressSaved);
    } catch (err) {
      if (apiFieldProblems(err).some((f) => f.field === "localPart")) setAddressError(t.addressInvalid);
      else toast.error(errorMessage(err));
    } finally {
      setSavingAddress(false);
    }
  }

  const address = <bdi dir="ltr" className="font-medium">{domain.fromAddress}</bdi>;
  const [sentBefore, sentAfter] = t.sentFrom.split("{address}");

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink">
        <bdi dir="ltr" className="font-medium">{domain.domain}</bdi>
      </p>

      {verified ? (
        <p className="flex items-start gap-2 rounded-[var(--radius)] bg-success-soft px-3 py-2 text-sm text-success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {sentBefore}
            {address}
            {sentAfter}
          </span>
        </p>
      ) : domain.status === "failed" ? (
        <Alert variant="danger">{t.failedNote}</Alert>
      ) : (
        <p className="text-xs text-ink-soft">{t.untilVerified}</p>
      )}

      {/* The address before the @ can change at any time without new records. */}
      {editingAddress ? (
        <form onSubmit={saveAddress} noValidate className="space-y-2">
          <LocalPartField t={t} value={localPart} onChange={setLocalPart} domain={domain.domain} error={addressError} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={savingAddress} className="min-h-11 sm:min-h-8">
              {savingAddress ? t.saving : t.saveAddress}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 sm:min-h-8"
              disabled={savingAddress}
              onClick={() => {
                setEditingAddress(false);
                setLocalPart(domain.localPart);
                setAddressError(undefined);
              }}
            >
              {t.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 text-sm">
            <span className="text-ink-soft">{t.address}: </span>
            <bdi dir="ltr" className="font-medium text-ink">{domain.fromAddress}</bdi>
          </p>
          <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-8" onClick={() => setEditingAddress(true)}>
            {t.changeAddress}
          </Button>
        </div>
      )}

      {verified && (
        <button
          type="button"
          aria-expanded={showRecords}
          onClick={() => setShowRecords((v) => !v)}
          className="min-h-11 cursor-pointer text-sm font-medium text-primary hover:underline sm:min-h-0"
        >
          {showRecords ? t.hideRecords : t.showRecords}
        </button>
      )}

      {showRecords && (
        <div className="space-y-2">
          {!verified && <p className="text-sm font-medium text-ink">{t.records}</p>}
          <RecordsTable t={t} records={domain.records} checked={checked} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
        <Button onClick={() => void verify()} disabled={verifying} variant={verified ? "outline" : "default"} className="min-h-11 sm:min-h-9">
          {verifying ? <Spinner className="size-4" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
          {verifying ? t.verifying : verified ? t.checkAgain : t.verify}
        </Button>
        <div className="min-w-0 text-xs text-ink-soft">
          <p>{checked ? fmt(t.lastChecked, { time: formatDateTime(domain.lastCheckedAt) }) : t.neverChecked}</p>
          {!verified && <p>{t.dnsDelay}</p>}
        </div>
        <Button
          variant="ghost"
          className="ms-auto min-h-11 text-danger hover:bg-danger-soft hover:text-danger sm:min-h-9"
          onClick={() => setConfirmRemove(true)}
        >
          <Trash2 className="size-4" aria-hidden />
          {t.remove}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title={fmt(t.removeTitle, { domain: domain.domain })}
        description={t.removeBody}
        confirmLabel={t.removeConfirm}
        cancelLabel={t.cancel}
        busyLabel={t.removing}
        destructive
        onCancel={() => setConfirmRemove(false)}
        onConfirm={async () => {
          await sendingDomainRemove(apiClient, workspaceId);
          setConfirmRemove(false);
          onChange(null);
          toast.success(t.removed);
        }}
      />
    </div>
  );
}

function RecordsTable({ t, records, checked }: { t: T; records: SendingDomainRecord[]; checked: boolean }) {
  const purpose = (r: SendingDomainRecord) => (t as Record<string, string>)[`purpose_${r.purpose}`] ?? r.purpose;
  const columns: Column<SendingDomainRecord>[] = [
    {
      key: "type",
      header: t.type,
      cell: (r) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-paper-sunken px-2 py-0.5 font-mono text-xs text-ink">{r.type}</span>
          <span className="text-xs text-ink-soft">{purpose(r)}</span>
          {r.purpose === "dmarc" && <span className="text-xs text-ink-soft">· {t.advised}</span>}
        </span>
      ),
    },
    {
      key: "host",
      header: t.host,
      cell: (r) => (
        <span className="flex items-start gap-1">
          <code dir="ltr" className="min-w-0 break-all text-xs text-ink">
            {r.name}
          </code>
          <CopyButton value={r.name} label={`${t.copy} ${t.host}`} labelClassName="sr-only" className="-my-1 min-h-9 min-w-9 shrink-0 justify-center" />
        </span>
      ),
    },
    {
      key: "value",
      header: t.value,
      className: "max-w-[24rem]",
      cell: (r) => (
        <span className="flex items-start gap-1">
          <code dir="ltr" className="min-w-0 break-all text-xs text-ink">
            {r.value}
          </code>
          <CopyButton value={r.value} label={`${t.copy} ${t.value}`} labelClassName="sr-only" className="-my-1 min-h-9 min-w-9 shrink-0 justify-center" />
        </span>
      ),
    },
    {
      key: "check",
      header: t.check,
      cell: (r) =>
        !checked || r.ok === undefined ? (
          <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
            <CircleDashed className="size-4" aria-hidden />
            {t.notChecked}
          </span>
        ) : r.ok ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <CheckCircle2 className="size-4" aria-hidden />
            {t.found}
          </span>
        ) : (
          <span className={cn("inline-flex items-center gap-1 text-xs font-medium", r.purpose === "dmarc" ? "text-ink-soft" : "text-danger")}>
            <CircleAlert className="size-4" aria-hidden />
            {t.notFound}
          </span>
        ),
    },
  ];
  return (
    <div className="overflow-hidden rounded-[var(--radius)] bg-paper-raised ring-1 ring-line">
      <DataTable columns={columns} rows={records} rowKey={(r) => `${r.purpose}-${r.name}`} minWidth="40rem" />
    </div>
  );
}
