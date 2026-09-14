import { useState, type FormEvent } from "react";
import { Copy, Globe } from "lucide-react";
import { Alert, Button, Spinner, cn } from "@store-builder/ui";
import {
  domainsAdd,
  domainsList,
  domainsRemove,
  domainsVerify,
  type DomainDTO,
  type DomainStatus,
  type DomainVerificationRecord,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { ApiError, getErrorMessage, getFieldErrors } from "@/lib/errors";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField } from "@/components/Field";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";

const CNAME_TARGET = "stores.zimos.app";

type Tone = "success" | "warning" | "danger" | "info";

const STATUS_TONE: Record<DomainStatus, Tone> = {
  active: "success",
  verified: "info",
  pending_verification: "warning",
  failed: "danger",
};

const TONE_CLASS: Record<Tone, string> = {
  info: "bg-info-soft text-info border-info/25",
  success: "bg-success-soft text-success border-success/25",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/25",
};

const STATUS_LABEL: Record<Locale, Record<DomainStatus, string>> = {
  en: { active: "Active", verified: "Verified", pending_verification: "Pending verification", failed: "Failed" },
  ar: { active: "نشط", verified: "تم التحقق", pending_verification: "بانتظار التحقق", failed: "فشل التحقق" },
};

const STRINGS = {
  en: {
    title: "Domains",
    hint: "Connect your own domain. Domains point to your store.",
    addDomain: "Add domain",
    verified: "{host} verified.",
    removed: "{host} removed.",
    emptyTitle: "No custom domains",
    emptyHint: "Your store is reachable on its zimos.app subdomain until you add one.",
    colHostname: "Hostname",
    colRecord: "Verification record",
    verifying: "Verifying…",
    verify: "Verify",
    remove: "Remove",
    showRecords: "DNS records",
    addDescription: "You will need access to the domain's DNS settings. Domains point to your store.",
    removeTitle: "Remove {host}?",
    removeDescription: "Visitors to this domain will see an error until you point it elsewhere.",
    removeDomain: "Remove domain",
    copied: "Copied.",
    copyFailed: "Could not copy — select the text manually.",
    copyLabel: "Copy {label}",
    finishTitle: "Finish setting up",
    finishHint: "Add the TXT record below at your DNS provider to prove you own the domain, and point the domain at ZIMOS with the CNAME record. Then click Verify. DNS changes can take up to an hour.",
    txtName: "Name / host",
    txtValue: "Value",
    dismiss: "Dismiss",
    invalidHost: "Enter a valid hostname, e.g. shop.example.com",
    hostname: "Hostname",
    adding: "Adding…",
    permission: "You don't have permission to manage domains.",
    subscription: "This workspace needs an active subscription to make changes.",
    storeNotSetUp: "Set up your store first (add a product) before connecting a domain.",
    domainTaken: "That domain is already connected to a store.",
  },
  ar: {
    title: "النطاقات (الدومين)",
    hint: "اربط نطاقك الخاص. النطاقات تشير إلى متجرك.",
    addDomain: "إضافة نطاق",
    verified: "تم التحقق من {host}.",
    removed: "تمت إزالة {host}.",
    emptyTitle: "لا توجد نطاقات مخصصة",
    emptyHint: "يمكن الوصول إلى متجرك عبر نطاقه الفرعي على zimos.app حتى تضيف نطاقًا خاصًا.",
    colHostname: "النطاق",
    colRecord: "سجل التحقق",
    verifying: "جارٍ التحقق…",
    verify: "تحقق",
    remove: "إزالة",
    showRecords: "سجلات DNS",
    addDescription: "ستحتاج إلى صلاحية الوصول إلى إعدادات DNS الخاصة بالنطاق. النطاقات تشير إلى متجرك.",
    removeTitle: "إزالة {host}؟",
    removeDescription: "سيرى زوار هذا النطاق رسالة خطأ حتى توجّهه إلى مكان آخر.",
    removeDomain: "إزالة النطاق",
    copied: "تم النسخ.",
    copyFailed: "تعذّر النسخ — حدّد النص وانسخه يدويًا.",
    copyLabel: "نسخ {label}",
    finishTitle: "أكمل إعداد",
    finishHint: "أضف سجل TXT التالي لدى مزوّد DNS لإثبات ملكيتك للنطاق، ووجّه النطاق إلى ZIMOS بسجل CNAME. ثم اضغط «تحقق». قد تستغرق تغييرات DNS حتى ساعة.",
    txtName: "الاسم / المضيف",
    txtValue: "القيمة",
    dismiss: "إخفاء",
    invalidHost: "أدخل نطاقًا صحيحًا، مثل shop.example.com",
    hostname: "النطاق",
    adding: "جارٍ الإضافة…",
    permission: "ليست لديك صلاحية لإدارة النطاقات.",
    subscription: "تحتاج مساحة العمل إلى اشتراك نشط لإجراء التغييرات.",
    storeNotSetUp: "جهّز متجرك أولًا (أضف منتجًا) قبل ربط نطاق.",
    domainTaken: "هذا النطاق مربوط بالفعل بمتجر.",
  },
} satisfies Messages;

function DomainStatusBadge({ status }: { status: DomainStatus }) {
  const { locale } = useLocale();
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE_CLASS[STATUS_TONE[status] ?? "warning"]
      )}
    >
      {STATUS_LABEL[locale][status] ?? status}
    </span>
  );
}

function useDomainErrorText() {
  const t = useT(STRINGS);
  return (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.status === 403) return t.permission;
      if (err.status === 402 || err.code === "SUBSCRIPTION_REQUIRED") return t.subscription;
      if (err.code === "STORE_NOT_SET_UP") return t.storeNotSetUp;
      if (err.code === "DOMAIN_TAKEN") return t.domainTaken;
    }
    return getErrorMessage(err);
  };
}

export function DomainsTab() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const c = useCommon();
  const errorText = useDomainErrorText();
  const domains = useAsync(() => domainsList(apiClient, workspaceId), [workspaceId]);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<DomainDTO | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [shown, setShown] = useState<DomainDTO | null>(null);

  const list = domains.data ?? [];
  const reload = () => domains.refresh({ silent: true });

  async function verify(d: DomainDTO) {
    setVerifyingId(d.id);
    try {
      const updated = await domainsVerify(apiClient, workspaceId, d.id);
      toast.success(fmt(t.verified, { host: updated.hostname }));
      if (shown?.id === d.id) setShown(null);
      void reload();
    } catch (err) {
      // DOMAIN_NOT_VERIFIED carries the exact TXT record the API looked for.
      toast.error(errorText(err));
    } finally {
      setVerifyingId(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    const target = removing;
    try {
      await domainsRemove(apiClient, workspaceId, target.id);
      toast.success(fmt(t.removed, { host: target.hostname }));
      if (shown?.id === target.id) setShown(null);
      void reload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{t.title}</h2>
          <p className="mt-1 text-sm text-ink-soft">{t.hint}</p>
        </div>
        <Button onClick={() => setAdding(true)}>{t.addDomain}</Button>
      </div>

      <DataState loading={domains.loading} error={domains.error} onRetry={() => domains.refresh()}>
        {list.length === 0 ? (
          <EmptyState
            icon={<Globe />}
            title={t.emptyTitle}
            description={t.emptyHint}
            action={<Button onClick={() => setAdding(true)}>{t.addDomain}</Button>}
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper text-start text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 text-start font-medium">{t.colHostname}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.colRecord}</th>
                  <th className="px-4 py-3 text-start font-medium">{c.status}</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {list.map((d) => {
                  const pending = d.status === "pending_verification" || d.status === "failed";
                  return (
                    <tr key={d.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <bdi dir="ltr" className="font-medium text-ink">
                          {d.hostname}
                        </bdi>
                      </td>
                      <td className="max-w-[260px] px-4 py-3 text-ink-soft">
                        {d.record ? (
                          <code dir="ltr" className="block truncate text-xs" title={d.record.value}>
                            TXT {d.record.value}
                          </code>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <DomainStatusBadge status={d.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-end">
                        {pending && d.record && (
                          <Button size="sm" variant="ghost" onClick={() => setShown(d)}>
                            {t.showRecords}
                          </Button>
                        )}
                        {pending && (
                          <Button size="sm" variant="ghost" onClick={() => verify(d)} disabled={verifyingId === d.id}>
                            {verifyingId === d.id ? (
                              <>
                                <Spinner className="size-3" /> {t.verifying}
                              </>
                            ) : (
                              t.verify
                            )}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setRemoving(d)}>
                          {t.remove}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DataState>

      {shown?.record && <DnsInstructions hostname={shown.hostname} record={shown.record} onDismiss={() => setShown(null)} />}

      <Modal open={adding} onClose={() => setAdding(false)} title={t.addDomain} description={t.addDescription}>
        {adding && (
          <AddDomainForm
            onCancel={() => setAdding(false)}
            onDone={(rec) => {
              setAdding(false);
              setShown(rec);
              void reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title={fmt(t.removeTitle, { host: removing?.hostname ?? "" })}
        description={t.removeDescription}
        confirmLabel={t.removeDomain}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  const t = useT(STRINGS);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t.copied);
    } catch {
      toast.error(t.copyFailed);
    }
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-ink-soft">{label}</span>
      <code dir="ltr" className="min-w-0 flex-1 truncate rounded-lg bg-paper px-2 py-1 text-start text-xs text-ink">
        {value}
      </code>
      <Button size="sm" variant="ghost" onClick={copy} aria-label={fmt(t.copyLabel, { label })}>
        <Copy />
      </Button>
    </div>
  );
}

function DnsInstructions({ hostname, record, onDismiss }: { hostname: string; record: DomainVerificationRecord; onDismiss: () => void }) {
  const t = useT(STRINGS);
  return (
    <Alert variant="info" className="space-y-3 rounded-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {t.finishTitle} <bdi dir="ltr">{hostname}</bdi>
          </p>
          <p className="text-xs text-ink-soft">{t.finishHint}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          {t.dismiss}
        </Button>
      </div>
      <div className="space-y-2 rounded-xl border border-line bg-paper-raised p-3">
        <p className="text-xs font-semibold text-ink" dir="ltr">
          {record.type}
        </p>
        <CopyRow label={t.txtName} value={record.name} />
        <CopyRow label={t.txtValue} value={record.value} />
      </div>
      <div className="space-y-2 rounded-xl border border-line bg-paper-raised p-3">
        <CopyRow label="CNAME" value={`${hostname}  →  ${CNAME_TARGET}`} />
      </div>
    </Alert>
  );
}

function AddDomainForm({ onCancel, onDone }: { onCancel: () => void; onDone: (rec: DomainDTO) => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const c = useCommon();
  const errorText = useDomainErrorText();
  const [hostname, setHostname] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const host = hostname.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
      setError(t.invalidHost);
      return;
    }
    setError(null);
    setFormError(null);
    setSaving(true);
    try {
      const res = await domainsAdd(apiClient, workspaceId, host);
      onDone({ ...res.domain, record: res.record });
    } catch (err) {
      const fields = getFieldErrors(err);
      if (fields.hostname) setError(fields.hostname);
      else setFormError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}
      <TextField
        label={t.hostname}
        required
        value={hostname}
        onChange={(e) => setHostname(e.target.value)}
        error={error ?? undefined}
        placeholder="shop.example.com"
        dir="ltr"
        autoFocus
      />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button type="submit" disabled={saving || hostname.trim() === ""}>
          {saving ? t.adding : t.addDomain}
        </Button>
      </div>
    </form>
  );
}
