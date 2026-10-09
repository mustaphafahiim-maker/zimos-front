import { useState } from "react";
import { Button, Input, cn } from "@store-builder/ui";
import {
  apiFieldProblems,
  isApiErrorCode,
  manualPaymentMethodCreate,
  manualPaymentMethodDelete,
  manualPaymentMethodUpdate,
  manualPaymentMethodsList,
  manualPaymentMethodsReorder,
  type ManualPaymentKind,
  type ManualPaymentMethod,
  type ManualPaymentMethodPayload,
} from "@store-builder/api-client";
import { IconArrowDown, IconArrowUp, IconDelete, IconEdit, IconPlus, IconWallet } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, isPermissionError } from "@/lib/errors";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/Textarea";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { FIELD, GROUP_ROW, PaneSkeleton, ToggleSwitch, useDiscardGuard } from "./sections/paneParts";

const STRINGS = {
  en: {
    title: "InstaPay & wallets",
    description: "Numbers the shopper pays to at checkout, then sends a screenshot of the transfer. You approve it from the order.",
    rulesNote: "A bank-transfer fee or discount in Payment rules applies to these too.",
    kind_instapay: "InstaPay",
    kind_wallet: "Wallet",
    kindWalletLong: "Wallet (Vodafone Cash, Etisalat Cash…)",
    hasLink: "Has a payment link",
    shown: "Shown at checkout",
    showSwitch: "Show {name} at checkout",
    edit: "Edit",
    editNamed: "Edit {name}",
    delete: "Delete",
    deleteTitle: "Delete {name}?",
    deleteBody: "Orders placed with it keep its number",
    deleted: "{name} deleted.",
    add: "Add a method",
    addTitle: "New payment method",
    editTitle: "Edit {name}",
    moveUp: "Move {name} up",
    moveDown: "Move {name} down",
    type: "Type",
    label: "Name the shopper sees",
    labelPlaceholderInstapay: "InstaPay",
    labelPlaceholderWallet: "Vodafone Cash",
    walletNumber: "Wallet number",
    instapayAccount: "InstaPay account or number",
    link: "Payment link (optional)",
    instructions: "Instructions for the shopper (optional)",
    save: "Save",
    saved: "Saved.",
    errLabel: "Write the name the shopper will see.",
    errWallet: "Enter a valid wallet number",
    errInstapay: "Enter a valid InstaPay account or number",
    errLink: "The link must start with https://",
    errTooMany: "You've reached the most methods (50)",
    emptyTitle: "No payment numbers yet",
    emptyHint: "No payment numbers yet — add an InstaPay or wallet number the shopper pays to and then sends a screenshot",
  },
  ar: {
    title: "إنستا باي والمحافظ",
    description: "أرقام العميل يدفع عليها في الفورم وبعدها يبعت صورة التحويل، وإنت بتقبلها من صفحة الطلب.",
    rulesNote: "رسوم أو خصم التحويل البنكي في قواعد الدفع بتتطبق على دول كمان.",
    kind_instapay: "إنستا باي",
    kind_wallet: "محفظة",
    kindWalletLong: "محفظة (فودافون كاش، اتصالات كاش…)",
    hasLink: "فيه لينك دفع",
    shown: "ظاهرة في الدفع",
    showSwitch: "اظهر {name} في الدفع",
    edit: "تعديل",
    editNamed: "تعديل {name}",
    delete: "حذف",
    deleteTitle: "تحذف {name}؟",
    deleteBody: "الطلبات اللي اتعملت بيها هتفضل محتفظة بالرقم",
    deleted: "اتحذفت {name}.",
    add: "إضافة طريقة",
    addTitle: "طريقة دفع جديدة",
    editTitle: "تعديل {name}",
    moveUp: "طلّع {name} لفوق",
    moveDown: "نزّل {name} لتحت",
    type: "النوع",
    label: "الاسم اللي يظهر للعميل",
    labelPlaceholderInstapay: "إنستا باي",
    labelPlaceholderWallet: "فودافون كاش",
    walletNumber: "رقم المحفظة",
    instapayAccount: "حساب إنستا باي أو الرقم",
    link: "لينك الدفع (اختياري)",
    instructions: "تعليمات للعميل (اختياري)",
    save: "حفظ",
    saved: "اتحفظ.",
    errLabel: "اكتب الاسم اللي العميل هيشوفه.",
    errWallet: "اكتب رقم محفظة صحيح",
    errInstapay: "اكتب حساب إنستا باي أو رقم صحيح",
    errLink: "اللينك لازم يبدأ بـ https://",
    errTooMany: "وصلت لأقصى عدد طرق (50)",
    emptyTitle: "مفيش أرقام دفع",
    emptyHint: "مفيش أرقام دفع — ضيف رقم إنستا باي أو محفظة يدفع عليه العميل وبعدها يبعت صورة التحويل",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

interface Draft {
  kind: ManualPaymentKind;
  label: string;
  accountNumber: string;
  paymentLink: string;
  instructions: string;
  active: boolean;
}

const NEW_DRAFT: Draft = { kind: "instapay", label: "", accountNumber: "", paymentLink: "", instructions: "", active: true };
const MAX_METHODS = 50;

// The server's own rules (handoff 340), checked before the request so the field says it at once.
const WALLET = /^\+?[\d\s-]+$/;
const INSTAPAY = /^[A-Za-z0-9@._+\- ]{3,80}$/;

function accountProblem(t: Strings, draft: Draft): string | null {
  const value = draft.accountNumber.trim();
  if (draft.kind === "wallet") {
    const digits = value.replace(/\D/g, "").length;
    return WALLET.test(value) && digits >= 8 && digits <= 15 ? null : t.errWallet;
  }
  return INSTAPAY.test(value) ? null : t.errInstapay;
}

function toDraft(method: ManualPaymentMethod): Draft {
  return {
    kind: method.kind,
    label: method.label,
    accountNumber: method.accountNumber,
    paymentLink: method.paymentLink ?? "",
    instructions: method.instructions ?? "",
    active: method.active,
  };
}

interface OpenSheet {
  method: ManualPaymentMethod | null;
  turn: number;
  shown: boolean;
}

/**
 * Payments → «إنستا باي والمحافظ» (handoff 340, workspace.manage): the InstaPay
 * accounts and wallet numbers shoppers pay to, in the order they see them. A
 * row moves up or down, switches on or off at checkout, and opens in a sheet
 * to edit or delete. A store opts in by adding its first method.
 */
export function StoreMethodsSettings({ workspaceId, canManage, onForbidden }: { workspaceId: string; canManage: boolean; onForbidden?: () => void }) {
  const t = useT(STRINGS);
  const toast = useToast();
  // Null = this role may not read the methods (workspace.manage): the block is left out, the pane above already says why.
  const methods = useAsync(
    () => manualPaymentMethodsList(apiClient, workspaceId).catch((err) => (isPermissionError(err) ? null : Promise.reject(err))),
    [workspaceId]
  );
  const [sheet, setSheet] = useState<OpenSheet | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = methods.data;
  const open = (method: ManualPaymentMethod | null) => setSheet((prev) => ({ method, turn: (prev?.turn ?? 0) + 1, shown: true }));
  const close = () => setSheet((prev) => (prev ? { ...prev, shown: false } : prev));

  function fail(err: unknown) {
    if (isPermissionError(err)) onForbidden?.();
    toast.error(getErrorMessage(err));
  }

  async function toggle(method: ManualPaymentMethod, active: boolean) {
    setBusyId(method.id);
    // The switch moves at once; a refusal puts it back.
    methods.setData((prev) => (prev ?? []).map((m) => (m.id === method.id ? { ...m, active } : m)));
    try {
      const saved = await manualPaymentMethodUpdate(apiClient, workspaceId, method.id, { active });
      methods.setData((prev) => (prev ?? []).map((m) => (m.id === saved.id ? saved : m)));
    } catch (err) {
      methods.setData((prev) => (prev ?? []).map((m) => (m.id === method.id ? { ...m, active: method.active } : m)));
      fail(err);
    } finally {
      setBusyId(null);
    }
  }

  async function move(index: number, step: -1 | 1) {
    if (!list) return;
    const target = index + step;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    setBusyId(list[index].id);
    methods.setData(next);
    try {
      methods.setData(await manualPaymentMethodsReorder(apiClient, workspaceId, next.map((m) => m.id)));
    } catch (err) {
      methods.setData(list);
      fail(err);
    } finally {
      setBusyId(null);
    }
  }

  if (methods.data === null && !methods.loading && !methods.error) return null;

  const full = (list?.length ?? 0) >= MAX_METHODS;

  return (
    <>
      <DataState loading={methods.loading} error={methods.error} onRetry={() => void methods.refresh()} skeleton={<PaneSkeleton rows={2} />}>
        {list && (
          <SettingsGroup title={t.title} description={t.description} footer={t.rulesNote}>
            {list.length === 0 ? (
              <div className="px-4 py-2">
                <EmptyState
                  icon={<IconWallet aria-hidden />}
                  title={t.emptyTitle}
                  description={t.emptyHint}
                  action={
                    canManage ? (
                      <Button className="rounded-full px-5" onClick={() => open(null)}>
                        <IconPlus className="size-4" weight="bold" aria-hidden />
                        {t.add}
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <>
                {list.map((m, index) => (
                  <div key={m.id} data-slot="store-method-row" className={cn(GROUP_ROW, "min-h-16 flex-wrap gap-y-1 before:start-4")}>
                    {canManage && list.length > 1 && (
                      <span className="-ms-2 flex shrink-0 flex-col">
                        <button
                          type="button"
                          aria-label={fmt(t.moveUp, { name: m.label })}
                          disabled={index === 0 || busyId !== null}
                          onClick={() => void move(index, -1)}
                          className="flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:bg-ink/4 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-35 pointer-fine:h-7 pointer-fine:w-9"
                        >
                          <IconArrowUp className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label={fmt(t.moveDown, { name: m.label })}
                          disabled={index === list.length - 1 || busyId !== null}
                          onClick={() => void move(index, 1)}
                          className="flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:bg-ink/4 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-35 pointer-fine:h-7 pointer-fine:w-9"
                        >
                          <IconArrowDown className="size-4" aria-hidden />
                        </button>
                      </span>
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate text-[15px] leading-5 font-medium text-ink" dir="auto">
                          {m.label}
                        </span>
                        <StatusBadge value={m.kind} tone="info" text={t[`kind_${m.kind}`]} />
                        {m.paymentLink && <StatusBadge value="link" tone="neutral" text={t.hasLink} />}
                      </span>
                      <bdi dir="ltr" className="truncate text-start text-[13px] leading-5 text-ink-soft tabular-nums">
                        {m.accountNumber}
                      </bdi>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="text-xs text-ink-soft max-sm:sr-only">{t.shown}</span>
                      <ToggleSwitch
                        checked={m.active}
                        disabled={!canManage || busyId !== null}
                        label={fmt(t.showSwitch, { name: m.label })}
                        onChange={(next) => void toggle(m, next)}
                      />
                      {canManage && (
                        <Button
                          type="button"
                          variant="outline"
                          aria-label={fmt(t.editNamed, { name: m.label })}
                          className="min-h-11 gap-1.5 rounded-full px-3 pointer-fine:min-h-9"
                          onClick={() => open(m)}
                        >
                          <IconEdit className="size-4" aria-hidden />
                          {t.edit}
                        </Button>
                      )}
                    </span>
                  </div>
                ))}
                {canManage && !full && (
                  <button
                    type="button"
                    onClick={() => open(null)}
                    className={cn(
                      GROUP_ROW,
                      "cursor-pointer text-start text-primary before:start-4 hover:bg-ink/4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-primary-soft">
                      <IconPlus className="size-4" weight="bold" aria-hidden />
                    </span>
                    <span className="text-[15px] leading-5 font-medium">{t.add}</span>
                  </button>
                )}
              </>
            )}
          </SettingsGroup>
        )}
      </DataState>

      {sheet && (
        <MethodSheet
          key={sheet.turn}
          workspaceId={workspaceId}
          method={sheet.method}
          open={sheet.shown}
          onClose={close}
          onForbidden={onForbidden}
          onSaved={(saved, created) => {
            methods.setData((prev) => (created ? [...(prev ?? []), saved] : (prev ?? []).map((m) => (m.id === saved.id ? saved : m))));
            toast.success(t.saved);
          }}
          onDeleted={(gone) => {
            methods.setData((prev) => (prev ?? []).filter((m) => m.id !== gone.id));
            toast.success(fmt(t.deleted, { name: gone.label }));
          }}
        />
      )}
    </>
  );
}

function MethodSheet({
  workspaceId,
  method,
  open,
  onClose,
  onForbidden,
  onSaved,
  onDeleted,
}: {
  workspaceId: string;
  method: ManualPaymentMethod | null;
  open: boolean;
  onClose: () => void;
  onForbidden?: () => void;
  onSaved: (method: ManualPaymentMethod, created: boolean) => void;
  onDeleted: (method: ManualPaymentMethod) => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const [start] = useState<Draft>(method ? toDraft(method) : NEW_DRAFT);
  const [draft, setDraft] = useState<Draft>(start);
  const [errors, setErrors] = useState<Partial<Record<"label" | "accountNumber" | "paymentLink" | "form", string>>>({});
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(start);
  useReportDirty(open && dirty);
  const guard = useDiscardGuard(dirty && !busy, onClose);

  function patch(change: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...change }));
    setErrors({});
  }

  async function save() {
    const found: typeof errors = {};
    if (!draft.label.trim()) found.label = t.errLabel;
    const account = accountProblem(t, draft);
    if (account) found.accountNumber = account;
    const link = draft.paymentLink.trim();
    if (link && !/^https:\/\/\S+$/i.test(link)) found.paymentLink = t.errLink;
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    const payload: ManualPaymentMethodPayload = {
      kind: draft.kind,
      label: draft.label.trim(),
      accountNumber: draft.accountNumber.trim(),
      paymentLink: link || null,
      instructions: draft.instructions.trim() || null,
      active: draft.active,
    };
    setBusy(true);
    try {
      const saved = method
        ? await manualPaymentMethodUpdate(apiClient, workspaceId, method.id, payload)
        : await manualPaymentMethodCreate(apiClient, workspaceId, payload);
      onSaved(saved, !method);
      onClose();
    } catch (err) {
      const fields = apiFieldProblems(err);
      if (fields.length > 0) {
        const mapped: typeof errors = {};
        for (const problem of fields) {
          if (problem.field === "accountNumber") mapped.accountNumber = draft.kind === "wallet" ? t.errWallet : t.errInstapay;
          else if (problem.field === "paymentLink") mapped.paymentLink = t.errLink;
          else if (problem.field === "label") mapped.label = t.errLabel;
        }
        setErrors(Object.keys(mapped).length > 0 ? mapped : { form: getErrorMessage(err) });
      } else if (isApiErrorCode(err, "TOO_MANY_PAYMENT_METHODS")) {
        setErrors({ form: t.errTooMany });
      } else {
        if (isPermissionError(err)) onForbidden?.();
        setErrors({ form: getErrorMessage(err) });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) guard.requestClose();
      }}
      title={method ? fmt(t.editTitle, { name: start.label }) : t.addTitle}
      size="md"
      footer={
        <>
          {method && (
            <Button
              type="button"
              variant="ghost"
              className="me-auto min-h-11 rounded-full px-4 text-danger hover:bg-danger-soft"
              disabled={busy}
              onClick={() => setRemoving(true)}
            >
              <IconDelete className="size-4" aria-hidden />
              {t.delete}
            </Button>
          )}
          <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" disabled={busy} onClick={guard.requestClose}>
            {common.cancel}
          </Button>
          <Button type="button" className="min-h-11 rounded-full px-5" disabled={busy || (Boolean(method) && !dirty)} onClick={() => void save()}>
            {busy ? common.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t.type}>
          {({ id }) => (
            <Select id={id} value={draft.kind} disabled={busy} onChange={(e) => patch({ kind: e.target.value as ManualPaymentKind })} className={FIELD}>
              <option value="instapay">{t.kind_instapay}</option>
              <option value="wallet">{t.kindWalletLong}</option>
            </Select>
          )}
        </Field>
        <Field label={t.label} error={errors.label}>
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              dir="auto"
              className={FIELD}
              placeholder={draft.kind === "wallet" ? t.labelPlaceholderWallet : t.labelPlaceholderInstapay}
              value={draft.label}
              maxLength={80}
              disabled={busy}
              onChange={(e) => patch({ label: e.target.value })}
            />
          )}
        </Field>
        <Field label={draft.kind === "wallet" ? t.walletNumber : t.instapayAccount} error={errors.accountNumber}>
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              dir="ltr"
              inputMode={draft.kind === "wallet" ? "tel" : "text"}
              autoComplete="off"
              spellCheck={false}
              className={cn(FIELD, "tabular-nums")}
              placeholder={draft.kind === "wallet" ? "0101 234 5678" : "name@instapay"}
              value={draft.accountNumber}
              maxLength={80}
              disabled={busy}
              onChange={(e) => patch({ accountNumber: e.target.value })}
            />
          )}
        </Field>
        <Field label={t.link} error={errors.paymentLink}>
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              dir="ltr"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              className={FIELD}
              placeholder="https://ipn.eg/S/…"
              value={draft.paymentLink}
              maxLength={500}
              disabled={busy}
              onChange={(e) => patch({ paymentLink: e.target.value })}
            />
          )}
        </Field>
        <Field label={t.instructions}>
          {({ id }) => (
            <Textarea
              id={id}
              rows={3}
              dir="auto"
              className="text-base md:text-sm"
              value={draft.instructions}
              maxLength={1000}
              disabled={busy}
              onChange={(e) => patch({ instructions: e.target.value })}
            />
          )}
        </Field>
        <SettingsGroup>
          <SettingsSwitch label={t.shown} checked={draft.active} disabled={busy} onChange={(active) => patch({ active })} />
        </SettingsGroup>
        {errors.form && (
          <p role="alert" className="text-sm font-medium text-danger">
            {errors.form}
          </p>
        )}
      </div>

      {guard.dialog}
      {method && (
        <ConfirmDialog
          open={removing}
          title={fmt(t.deleteTitle, { name: start.label })}
          description={t.deleteBody}
          confirmLabel={t.delete}
          cancelLabel={common.cancel}
          busyLabel={common.loading}
          destructive
          onCancel={() => setRemoving(false)}
          onConfirm={async () => {
            try {
              await manualPaymentMethodDelete(apiClient, workspaceId, method.id);
            } catch (err) {
              if (isPermissionError(err)) onForbidden?.();
              throw new Error(getErrorMessage(err));
            }
            setRemoving(false);
            onDeleted(method);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
