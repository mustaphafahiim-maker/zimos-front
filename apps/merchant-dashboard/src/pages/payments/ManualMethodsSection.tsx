import { useId, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { Alert, Button, Input, Label, Textarea } from "@store-builder/ui";
import {
  ApiError,
  createManualPaymentMethod,
  deleteManualPaymentMethod,
  listManualPaymentMethods,
  reorderManualPaymentMethods,
  updateManualPaymentMethod,
  type ManualMethodKind,
  type StoreManualPaymentMethod,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "InstaPay and wallets",
    hint: "Shoppers pay you directly by InstaPay or a mobile wallet, then send the number they paid from and a screenshot. You approve the payment on the order before it can be confirmed for shipping.",
    empty: "No manual payment methods yet.",
    add: "Add a method",
    edit: "Edit",
    remove: "Delete",
    disable: "Disable",
    enable: "Enable",
    active: "Active",
    inactive: "Disabled",
    moveUp: "Move up",
    moveDown: "Move down",
    kind: "Type",
    kindInstapay: "InstaPay",
    kindWallet: "Mobile wallet",
    label: "Name shown to shoppers",
    accountInstapay: "InstaPay account or number",
    accountWallet: "Wallet number",
    link: "Payment link",
    optional: "Optional",
    linkHint: "Only https links. Leave it empty if you don't have one: shoppers then see the number only.",
    instructions: "Instructions for shoppers",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    saved: "Payment method saved.",
    deleted: "Payment method deleted.",
    deleteTitle: "Delete this payment method?",
    deleteBody: "Shoppers stop seeing it. Orders already placed with it keep their details.",
    numberRequired: "Enter the number.",
    labelRequired: "Enter a name.",
    linkHttps: "The link must start with https://",
  },
  ar: {
    title: "إنستاباي والمحافظ الإلكترونية",
    hint: "يدفع العميل لك مباشرة عبر إنستاباي أو محفظة إلكترونية، ثم يرسل الرقم الذي دفع منه وصورة للتحويل. توافق على الدفع من صفحة الطلب قبل أن يمكن تأكيده للشحن.",
    empty: "لا توجد طرق دفع يدوية بعد.",
    add: "إضافة طريقة",
    edit: "تعديل",
    remove: "حذف",
    disable: "إيقاف",
    enable: "تفعيل",
    active: "مفعّلة",
    inactive: "متوقفة",
    moveUp: "تحريك لأعلى",
    moveDown: "تحريك لأسفل",
    kind: "النوع",
    kindInstapay: "إنستاباي",
    kindWallet: "محفظة إلكترونية",
    label: "الاسم الذي يراه العميل",
    accountInstapay: "حساب أو رقم إنستاباي",
    accountWallet: "رقم المحفظة",
    link: "رابط الدفع",
    optional: "اختياري",
    linkHint: "روابط https فقط. اتركه فارغًا إن لم يكن لديك رابط، وسيرى العميل الرقم فقط.",
    instructions: "تعليمات للعميل",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    cancel: "إلغاء",
    saved: "تم حفظ طريقة الدفع.",
    deleted: "تم حذف طريقة الدفع.",
    deleteTitle: "حذف طريقة الدفع هذه؟",
    deleteBody: "لن يراها العملاء بعد الآن. الطلبات التي تمت بها تحتفظ ببياناتها.",
    numberRequired: "أدخل الرقم.",
    labelRequired: "أدخل اسمًا.",
    linkHttps: "يجب أن يبدأ الرابط بـ https://",
  },
} satisfies Messages;

interface Draft {
  kind: ManualMethodKind;
  label: string;
  accountNumber: string;
  paymentLink: string;
  instructions: string;
}

const EMPTY: Draft = { kind: "instapay", label: "", accountNumber: "", paymentLink: "", instructions: "" };

/** The store's own InstaPay / wallet methods, on the Payments page (workspace.manage). */
export function ManualMethodsSection({ workspaceId }: { workspaceId: string }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const methods = useAsync(() => listManualPaymentMethods(apiClient, workspaceId), [workspaceId]);
  const [editing, setEditing] = useState<StoreManualPaymentMethod | "new" | null>(null);
  const [deleting, setDeleting] = useState<StoreManualPaymentMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const list = methods.data ?? [];

  async function run(action: () => Promise<unknown>, message?: string) {
    setBusy(true);
    try {
      await action();
      if (message) toast.success(message);
      await methods.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, by: -1 | 1) {
    const ids = list.map((m) => m.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + by, 0, id);
    void run(() => reorderManualPaymentMethods(apiClient, workspaceId, ids));
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t.hint}</p>
      </div>
      <DataState loading={methods.loading} error={methods.error} onRetry={() => methods.refresh()}>
        {list.length === 0 && editing === null && <p className="text-sm text-ink-soft">{t.empty}</p>}
        <ul className="space-y-3">
          {list.map((m, index) =>
            editing !== "new" && editing?.id === m.id ? (
              <li key={m.id}>
                <MethodForm
                  initial={{
                    kind: m.kind,
                    label: m.label,
                    accountNumber: m.accountNumber,
                    paymentLink: m.paymentLink ?? "",
                    instructions: m.instructions ?? "",
                  }}
                  onCancel={() => setEditing(null)}
                  onSave={async (draft) => {
                    await updateManualPaymentMethod(apiClient, workspaceId, m.id, toBody(draft));
                    setEditing(null);
                    toast.success(t.saved);
                    await methods.refresh({ silent: true });
                  }}
                />
              </li>
            ) : (
              <li key={m.id} className="rounded-[0.5rem] border border-line bg-paper-raised px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                      {m.label}
                      <span className="text-xs text-ink-soft">{m.kind === "wallet" ? t.kindWallet : t.kindInstapay}</span>
                      <StatusBadge value={m.active ? "active" : "draft"} text={m.active ? t.active : t.inactive} />
                    </p>
                    <p className="font-mono text-sm text-ink" dir="ltr">
                      {m.accountNumber}
                    </p>
                    {m.paymentLink && (
                      <a
                        href={m.paymentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary underline"
                        dir="ltr"
                      >
                        {m.paymentLink}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    )}
                    {m.instructions && <p className="whitespace-pre-line text-xs text-ink-soft">{m.instructions}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button type="button" size="sm" variant="ghost" aria-label={t.moveUp} disabled={busy || index === 0} onClick={() => move(index, -1)}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={t.moveDown}
                      disabled={busy || index === list.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void run(() => updateManualPaymentMethod(apiClient, workspaceId, m.id, { active: !m.active }), t.saved)}
                    >
                      {m.active ? t.disable : t.enable}
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setEditing(m)}>
                      {t.edit}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setDeleting(m)}>
                      {t.remove}
                    </Button>
                  </div>
                </div>
              </li>
            )
          )}
        </ul>
        {editing === "new" ? (
          <MethodForm
            initial={EMPTY}
            onCancel={() => setEditing(null)}
            onSave={async (draft) => {
              await createManualPaymentMethod(apiClient, workspaceId, toBody(draft));
              setEditing(null);
              toast.success(t.saved);
              await methods.refresh({ silent: true });
            }}
          />
        ) : (
          <Button type="button" variant="outline" onClick={() => setEditing("new")} disabled={busy}>
            {t.add}
          </Button>
        )}
      </DataState>
      <ConfirmDialog
        open={deleting !== null}
        title={t.deleteTitle}
        description={t.deleteBody}
        confirmLabel={t.remove}
        cancelLabel={t.cancel}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteManualPaymentMethod(apiClient, workspaceId, deleting.id);
          setDeleting(null);
          toast.success(t.deleted);
          await methods.refresh({ silent: true });
        }}
      />
    </section>
  );
}

function toBody(draft: Draft) {
  return {
    kind: draft.kind,
    label: draft.label.trim(),
    accountNumber: draft.accountNumber.trim(),
    // Empty is a valid answer: no link.
    paymentLink: draft.paymentLink.trim() || null,
    instructions: draft.instructions.trim() || null,
  };
}

function MethodForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Draft;
  onSave: (draft: Draft) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const id = useId();
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.label.trim()) return setError(t.labelRequired);
    if (!draft.accountNumber.trim()) return setError(t.numberRequired);
    const link = draft.paymentLink.trim();
    if (link && !/^https:\/\//i.test(link)) return setError(t.linkHttps);
    setError(null);
    setSaving(true);
    try {
      await onSave(draft);
    } catch (err) {
      setError(err instanceof ApiError ? errorMessage(err) : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[0.5rem] border border-line bg-paper-raised px-4 py-4">
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-ink">{t.kind}</legend>
        <div className="flex flex-wrap gap-4">
          {(["instapay", "wallet"] as const).map((kind) => (
            <label key={kind} className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name={`${id}-kind`} value={kind} checked={draft.kind === kind} onChange={() => set({ kind })} />
              {kind === "wallet" ? t.kindWallet : t.kindInstapay}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-label`}>{t.label}</Label>
        <Input id={`${id}-label`} value={draft.label} maxLength={80} onChange={(e) => set({ label: e.target.value })} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-number`}>{draft.kind === "wallet" ? t.accountWallet : t.accountInstapay}</Label>
        <Input
          id={`${id}-number`}
          dir="ltr"
          value={draft.accountNumber}
          maxLength={80}
          inputMode={draft.kind === "wallet" ? "tel" : undefined}
          onChange={(e) => set({ accountNumber: e.target.value })}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-link`}>
          {t.link} <span className="text-xs font-normal text-ink-soft">({t.optional})</span>
        </Label>
        <Input
          id={`${id}-link`}
          dir="ltr"
          type="url"
          placeholder="https://"
          value={draft.paymentLink}
          maxLength={500}
          onChange={(e) => set({ paymentLink: e.target.value })}
        />
        <p className="text-xs text-ink-soft">{t.linkHint}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-instructions`}>
          {t.instructions} <span className="text-xs font-normal text-ink-soft">({t.optional})</span>
        </Label>
        <Textarea
          id={`${id}-instructions`}
          value={draft.instructions}
          maxLength={1000}
          rows={3}
          onChange={(e) => set({ instructions: e.target.value })}
        />
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? t.saving : t.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}
