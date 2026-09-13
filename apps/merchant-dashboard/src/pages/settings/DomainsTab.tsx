import { useState, type FormEvent } from "react";
import { Copy, Globe } from "lucide-react";
import { Alert, Button, Spinner, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { DomainRecord } from "@/mock/types";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";

const CNAME_TARGET = "stores.zimos.app";

type Tone = "success" | "warning" | "danger" | "info";

const STATUS_TONE: Record<DomainRecord["status"], Tone> = {
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

const STATUS_LABEL: Record<Locale, Record<DomainRecord["status"], string>> = {
  en: { active: "Active", verified: "Verified", pending_verification: "Pending verification", failed: "Failed" },
  ar: { active: "نشط", verified: "تم التحقق", pending_verification: "بانتظار التحقق", failed: "فشل التحقق" },
};

const STRINGS = {
  en: {
    title: "Domains",
    hint: "Point your own domain at the store or at a single funnel.",
    addDomain: "Add domain",
    verified: "{host} verified.",
    removed: "{host} removed.",
    emptyTitle: "No custom domains",
    emptyHint: "Your store is reachable on its zimos.app subdomain until you add one.",
    colHostname: "Hostname",
    colTarget: "Target",
    primary: "Primary",
    targetStore: "Store",
    targetFunnel: "Funnel",
    verifying: "Verifying…",
    verify: "Verify",
    remove: "Remove",
    addDescription: "You will need access to the domain's DNS settings.",
    removeTitle: "Remove {host}?",
    removeDescription: "Visitors to this domain will see an error until you point it elsewhere.",
    removeDomain: "Remove domain",
    copied: "Copied.",
    copyFailed: "Could not copy — select the text manually.",
    copyLabel: "Copy {label}",
    finishTitle: "Finish setting up",
    finishHint: "Add these two records at your DNS provider, then click Verify. Propagation can take up to an hour.",
    dismiss: "Dismiss",
    invalidHost: "Enter a valid hostname, e.g. shop.example.com",
    hostname: "Hostname",
    pointsTo: "Points to",
    adding: "Adding…",
  },
  ar: {
    title: "النطاقات (الدومين)",
    hint: "اربط نطاقك الخاص بالمتجر أو بمسار مبيعات (Funnel) واحد.",
    addDomain: "إضافة نطاق",
    verified: "تم التحقق من {host}.",
    removed: "تمت إزالة {host}.",
    emptyTitle: "لا توجد نطاقات مخصصة",
    emptyHint: "يمكن الوصول إلى متجرك عبر نطاقه الفرعي على zimos.app حتى تضيف نطاقًا خاصًا.",
    colHostname: "النطاق",
    colTarget: "يشير إلى",
    primary: "أساسي",
    targetStore: "المتجر",
    targetFunnel: "مسار مبيعات",
    verifying: "جارٍ التحقق…",
    verify: "تحقق",
    remove: "إزالة",
    addDescription: "ستحتاج إلى صلاحية الوصول إلى إعدادات DNS الخاصة بالنطاق.",
    removeTitle: "إزالة {host}؟",
    removeDescription: "سيرى زوار هذا النطاق رسالة خطأ حتى توجّهه إلى مكان آخر.",
    removeDomain: "إزالة النطاق",
    copied: "تم النسخ.",
    copyFailed: "تعذّر النسخ — حدّد النص وانسخه يدويًا.",
    copyLabel: "نسخ {label}",
    finishTitle: "أكمل إعداد",
    finishHint: "أضف هذين السجلين لدى مزوّد DNS الخاص بك، ثم اضغط «تحقق». قد يستغرق التفعيل حتى ساعة.",
    dismiss: "إخفاء",
    invalidHost: "أدخل نطاقًا صحيحًا، مثل shop.example.com",
    hostname: "النطاق",
    pointsTo: "يشير إلى",
    adding: "جارٍ الإضافة…",
  },
} satisfies Messages;

function DomainStatus({ status }: { status: DomainRecord["status"] }) {
  const { locale } = useLocale();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[STATUS_TONE[status]]
      )}
    >
      {STATUS_LABEL[locale][status]}
    </span>
  );
}

export function DomainsTab() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const c = useCommon();
  const domains = useAsync(() => mockApi.listDomains(workspaceId), [workspaceId]);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<DomainRecord | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<DomainRecord | null>(null);

  const list = domains.data ?? [];
  const reload = () => domains.refresh({ silent: true });

  async function verify(d: DomainRecord) {
    setVerifyingId(d.id);
    try {
      await mockApi.verifyDomain(workspaceId, d.id);
      toast.success(fmt(t.verified, { host: d.hostname }));
      reload();
    } finally {
      setVerifyingId(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    await mockApi.removeDomain(workspaceId, removing.id);
    toast.success(fmt(t.removed, { host: removing.hostname }));
    if (justAdded?.id === removing.id) setJustAdded(null);
    setRemoving(null);
    reload();
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
                  <th className="px-4 py-3 text-start font-medium">{t.colTarget}</th>
                  <th className="px-4 py-3 text-start font-medium">{c.status}</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <bdi dir="ltr" className="font-medium text-ink">
                          {d.hostname}
                        </bdi>
                        {d.isPrimary && (
                          <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                            {t.primary}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      <span className="text-xs uppercase tracking-wide">
                        {d.target === "funnel" ? t.targetFunnel : t.targetStore}
                      </span>{" "}
                      · <bdi>{d.target === "store" ? t.targetStore : d.targetLabel}</bdi>
                    </td>
                    <td className="px-4 py-3">
                      <DomainStatus status={d.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-end">
                      {(d.status === "pending_verification" || d.status === "failed") && (
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
                      {!d.isPrimary && (
                        <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setRemoving(d)}>
                          {t.remove}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataState>

      {justAdded && <DnsInstructions domain={justAdded} onDismiss={() => setJustAdded(null)} />}

      <Modal open={adding} onClose={() => setAdding(false)} title={t.addDomain} description={t.addDescription}>
        {adding && (
          <AddDomainForm
            onCancel={() => setAdding(false)}
            onDone={(rec) => {
              setAdding(false);
              setJustAdded(rec);
              reload();
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
      <span className="w-16 shrink-0 text-xs uppercase tracking-wide text-ink-soft" dir="ltr">
        {label}
      </span>
      <code dir="ltr" className="min-w-0 flex-1 truncate rounded-lg bg-paper px-2 py-1 text-start text-xs text-ink">
        {value}
      </code>
      <Button size="sm" variant="ghost" onClick={copy} aria-label={fmt(t.copyLabel, { label })}>
        <Copy />
      </Button>
    </div>
  );
}

function DnsInstructions({ domain, onDismiss }: { domain: DomainRecord; onDismiss: () => void }) {
  const t = useT(STRINGS);
  const [host, token] = [domain.hostname, domain.verificationToken];
  return (
    <Alert variant="info" className="space-y-3 rounded-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {t.finishTitle}{" "}
            <bdi dir="ltr">{host}</bdi>
          </p>
          <p className="text-xs text-ink-soft">{t.finishHint}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          {t.dismiss}
        </Button>
      </div>
      <div className="space-y-2 rounded-xl border border-line bg-paper-raised p-3">
        <CopyRow label="TXT" value={`_zimos.${host}  →  ${token}`} />
        <CopyRow label="CNAME" value={`${host}  →  ${CNAME_TARGET}`} />
      </div>
    </Alert>
  );
}

function AddDomainForm({ onCancel, onDone }: { onCancel: () => void; onDone: (rec: DomainRecord) => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const c = useCommon();
  const funnels = useAsync(() => mockApi.listFunnels(workspaceId), [workspaceId]);
  const [hostname, setHostname] = useState("");
  const [target, setTarget] = useState<string>("store");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const host = hostname.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
      setError(t.invalidHost);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const funnel = (funnels.data ?? []).find((f) => f.id === target);
      const rec = await mockApi.addDomain(workspaceId, {
        hostname: host,
        isPrimary: false,
        target: funnel ? "funnel" : "store",
        targetLabel: funnel ? funnel.name : "Store",
      });
      onDone(rec);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
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
      <Field label={t.pointsTo} required>
        {({ id }) => (
          <Select id={id} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="store">{t.targetStore}</option>
            {(funnels.data ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {t.targetFunnel} · {f.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
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
