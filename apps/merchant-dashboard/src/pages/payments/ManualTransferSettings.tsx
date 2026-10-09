import { useEffect, useRef, useState } from "react";
import { Button, Input, cn } from "@store-builder/ui";
import {
  manualTransferGetSettings,
  manualTransferListPending,
  manualTransferSaveSettings,
  type ManualTransferMethod,
} from "@store-builder/api-client";
import { IconBank, IconCaretRight, IconDelete, IconPlus, IconReceipt } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, isPermissionError } from "@/lib/errors";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/Textarea";
import { SettingsGroup, SettingsIconTile, SettingsLinkRow, SettingsRow, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { FIELD, GROUP_ROW, GROUP_ROW_PRESS, NoAccess, PaneSkeleton, useDiscardGuard } from "./sections/paneParts";

const STRINGS = {
  en: {
    title: "Manual transfer",
    description:
      "Let customers pay by InstaPay, Vodafone Cash or bank transfer: they see your instructions at checkout and upload a photo of the receipt. You confirm each transfer from the order.",
    methodsTitle: "Transfer methods",
    add: "Add a transfer method",
    addTitle: "New transfer method",
    editTitle: "Edit {name}",
    empty: "No transfer methods yet",
    emptyHint: "Add your InstaPay address, wallet number or bank account, and shoppers can pay you directly.",
    maxReached: "You've reached the most transfer methods a store can have ({n}).",
    name: "Name shown to the customer",
    namePlaceholder: "InstaPay",
    instructions: "Payment instructions",
    instructionsPlaceholder: "Send the amount to the InstaPay address store@instapay, then upload the receipt.",
    requireReceipt: "Receipt photo is required",
    requireSender: "Ask for the sender's number or account",
    enabled: "Show at checkout",
    shown: "At checkout",
    hidden: "Hidden",
    remove: "Remove",
    removeTitle: "Remove {name}?",
    removeBody: "Shoppers will no longer be able to pay with it. Transfers already sent stay on their orders.",
    removed: "{name} removed.",
    restored: "{name} is back.",
    pending: "Transfers waiting for your review",
    pendingHint: "You confirm or reject each transfer from its order.",
    pendingCap: "{n}+",
    pendingNone: "None",
    deposit: "Deposit before cash on delivery",
    depositHint: "Set with the cash-on-delivery settings.",
    open: "Open",
    save: "Save",
    saved: "Transfer settings saved.",
    invalid: "Fill in the name and instructions of every method.",
    nameMissing: "Write the name shoppers will see.",
    instructionsMissing: "Write where and how to send the money.",
    needMethod: "Add a transfer method before asking for a deposit.",
  },
  ar: {
    title: "التحويل اليدوي",
    description:
      "خلّي العملاء يدفعوا بإنستاباي أو فودافون كاش أو تحويل بنكي: بيشوفوا تعليماتك في الفورم ويرفعوا صورة الإيصال، وإنت بتأكّد كل تحويل من صفحة الأوردر.",
    methodsTitle: "طرق التحويل",
    add: "ضيف طريقة تحويل",
    addTitle: "طريقة تحويل جديدة",
    editTitle: "تعديل {name}",
    empty: "مفيش طرق تحويل لسه",
    emptyHint: "ضيف عنوان إنستاباي أو رقم المحفظة أو الحساب البنكي، والعملاء يدفعولك على طول.",
    maxReached: "وصلت لأكتر عدد طرق تحويل للمتجر ({n}).",
    name: "الاسم اللي العميل بيشوفه",
    namePlaceholder: "إنستاباي",
    instructions: "تعليمات الدفع",
    instructionsPlaceholder: "حوّل المبلغ على عنوان إنستاباي store@instapay وبعدين ارفع صورة الإيصال.",
    requireReceipt: "صورة الإيصال مطلوبة",
    requireSender: "اطلب رقم أو حساب اللي حوّل",
    enabled: "اعرضها في الفورم",
    shown: "ظاهرة في الفورم",
    hidden: "مخفية",
    remove: "امسح",
    removeTitle: "تمسح {name}؟",
    removeBody: "العملاء مش هيقدروا يدفعوا بيها تاني. التحويلات اللي اتبعتت هتفضل على أوردراتها.",
    removed: "اتمسحت {name}.",
    restored: "{name} رجعت.",
    pending: "تحويلات مستنية مراجعتك",
    pendingHint: "بتأكّد أو ترفض كل تحويل من صفحة الأوردر بتاعه.",
    pendingCap: "{n}+",
    pendingNone: "مفيش",
    deposit: "عربون قبل الدفع عند الاستلام",
    depositHint: "بيتظبط مع إعدادات الدفع عند الاستلام.",
    open: "افتح",
    save: "حفظ",
    saved: "اتحفظت إعدادات التحويل.",
    invalid: "اكتب اسم وتعليمات كل طريقة.",
    nameMissing: "اكتب الاسم اللي العميل هيشوفه.",
    instructionsMissing: "اكتب الفلوس تتحوّل فين وإزاي.",
    needMethod: "ضيف طريقة تحويل قبل ما تطلب عربون.",
  },
} satisfies Messages;

/** A method as the save sends it: a new one has no id yet. */
type MethodDraft = Omit<ManualTransferMethod, "id"> & { id?: string };

const NEW_METHOD: MethodDraft = { name: "", instructions: "", requireReceipt: true, requireSender: true, enabled: true };

/** `GET /manual-transfers/pending` answers at most this many (pages/home/today/workQueueData.ts). */
const PENDING_CAP = 50;

/** Which method's sheet is up; `index` null = a new one. `turn` makes every opening a fresh form. */
interface OpenSheet {
  index: number | null;
  turn: number;
  shown: boolean;
}

/**
 * Payments → Bank transfer and wallets (SPEC §11.3): the transfer methods as
 * a list, each opening in a sheet (add, edit, remove). A sheet's Save sends
 * the whole list with the deposit rule as it is saved, the same call the page
 * always made. The deposit rule itself is edited in the Cash-on-delivery
 * section; the transfers waiting for review are reached from here.
 */
export function ManualTransferSettings({
  workspaceId,
  canManage,
  onForbidden,
  onGoto,
}: {
  workspaceId: string;
  canManage: boolean;
  onForbidden?: () => void;
  /** Opens the Cash-on-delivery section (where the deposit is set). */
  onGoto?: (section: "cod") => void;
}) {
  const t = useT(STRINGS);
  const toast = useToast();
  // Null = this role may not read the transfer settings.
  const settings = useAsync(
    () => manualTransferGetSettings(apiClient, workspaceId).catch((err) => (isPermissionError(err) ? null : Promise.reject(err))),
    [workspaceId]
  );
  // Only for the count on the review row: a failure just leaves the row without one.
  const pending = useAsync(() => manualTransferListPending(apiClient, workspaceId).catch(() => null), [workspaceId]);
  const [sheet, setSheet] = useState<OpenSheet | null>(null);
  const [busy, setBusy] = useState(false);

  const data = settings.data;
  // The list as saved right now, for an Undo that runs after this render is gone.
  const latest = useRef(data);
  useEffect(() => {
    latest.current = data;
  }, [data]);

  /** Saves the whole list (the deposit rule goes with it, unchanged). False when it was refused. */
  async function persist(next: MethodDraft[], message: string): Promise<boolean> {
    const current = latest.current;
    if (!current) return false;
    if (next.some((m) => !m.name.trim() || !m.instructions.trim())) {
      toast.error(t.invalid);
      return false;
    }
    if (current.depositRule.enabled && !next.some((m) => m.enabled)) {
      toast.error(t.needMethod);
      return false;
    }
    setBusy(true);
    try {
      const saved = await manualTransferSaveSettings(apiClient, workspaceId, { methods: next, depositRule: current.depositRule });
      latest.current = saved;
      settings.setData(saved);
      if (message) toast.success(message);
      return true;
    } catch (err) {
      if (isPermissionError(err)) onForbidden?.();
      toast.error(getErrorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveMethod(index: number | null, draft: MethodDraft): Promise<boolean> {
    const list: MethodDraft[] = latest.current?.methods ?? [];
    const next = index === null ? [...list, draft] : list.map((m, i) => (i === index ? draft : m));
    return persist(next, t.saved);
  }

  async function removeMethod(index: number): Promise<boolean> {
    const list = latest.current?.methods ?? [];
    const gone = list[index];
    if (!gone) return false;
    const ok = await persist(
      list.filter((_, i) => i !== index),
      ""
    );
    if (!ok) return false;
    toast.undo(fmt(t.removed, { name: gone.name }), async () => {
      // Put back as a new method: the server gives it a new id.
      const rest: MethodDraft = {
        name: gone.name,
        instructions: gone.instructions,
        requireReceipt: gone.requireReceipt,
        requireSender: gone.requireSender,
        enabled: gone.enabled,
      };
      const back = await persist([...(latest.current?.methods ?? []), rest], fmt(t.restored, { name: gone.name }));
      if (!back) throw new Error("restore failed");
    });
    return true;
  }

  const open = (index: number | null) => setSheet((prev) => ({ index, turn: (prev?.turn ?? 0) + 1, shown: true }));
  const close = () => setSheet((prev) => (prev ? { ...prev, shown: false } : prev));

  const count = pending.data?.length ?? null;
  const oldest = pending.data && pending.data.length > 0 ? [...pending.data].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] : null;

  return (
    <>
      <DataState
        loading={settings.loading}
        error={settings.error}
        onRetry={() => void settings.refresh()}
        skeleton={<PaneSkeleton rows={3} />}
      >
        {!data ? (
          <NoAccess />
        ) : (
          <>
            {data.methods.length === 0 ? (
              <EmptyState
                icon={<IconBank />}
                title={t.empty}
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
            ) : (
              <SettingsGroup
                title={t.methodsTitle}
                footer={canManage && data.methods.length >= data.limits.maxMethods ? fmt(t.maxReached, { n: data.limits.maxMethods }) : undefined}
              >
                {data.methods.map((m, index) => (
                  <button key={m.id} type="button" onClick={() => open(index)} className={cn(GROUP_ROW, GROUP_ROW_PRESS, "min-h-16 before:start-14")}>
                    <SettingsIconTile icon={IconBank} tone="teal" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] leading-5 font-medium text-ink" dir="auto">
                        {m.name}
                      </span>
                      <span className="truncate text-[13px] leading-5 text-ink-soft" dir="auto">
                        {m.instructions}
                      </span>
                    </span>
                    <StatusBadge
                      value={m.enabled ? "shown" : "hidden"}
                      tone={m.enabled ? "success" : "neutral"}
                      text={m.enabled ? t.shown : t.hidden}
                      className="shrink-0"
                    />
                    <IconCaretRight className="size-4 shrink-0 text-ink-soft rtl:-scale-x-100" weight="bold" aria-hidden />
                  </button>
                ))}
                {canManage && data.methods.length < data.limits.maxMethods && (
                  <button type="button" onClick={() => open(null)} className={cn(GROUP_ROW, GROUP_ROW_PRESS, "text-primary before:start-14")}>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-primary-soft">
                      <IconPlus className="size-4" weight="bold" aria-hidden />
                    </span>
                    <span className="text-[15px] leading-5 font-medium">{t.add}</span>
                  </button>
                )}
              </SettingsGroup>
            )}

            <SettingsGroup>
              <SettingsLinkRow
                to={oldest ? `/orders/${oldest.orderId}` : "/orders"}
                icon={IconReceipt}
                tone="orange"
                label={t.pending}
                hint={t.pendingHint}
                value={
                  count === null
                    ? undefined
                    : count === 0
                      ? t.pendingNone
                      : count >= PENDING_CAP
                        ? fmt(t.pendingCap, { n: PENDING_CAP })
                        : fmt("{n}", { n: count })
                }
              />
              {onGoto && (
                <SettingsRow
                  label={t.deposit}
                  hint={t.depositHint}
                  control={
                    <Button variant="outline" className="min-h-11 rounded-full px-4" onClick={() => onGoto("cod")}>
                      {t.open}
                    </Button>
                  }
                />
              )}
            </SettingsGroup>
          </>
        )}
      </DataState>

      {sheet && data && (
        <TransferMethodSheet
          key={sheet.turn}
          initial={sheet.index === null ? NEW_METHOD : (data.methods[sheet.index] ?? NEW_METHOD)}
          isNew={sheet.index === null}
          open={sheet.shown}
          onClose={close}
          canManage={canManage}
          busy={busy}
          onSave={(draft) => saveMethod(sheet.index, draft)}
          onRemove={sheet.index === null ? undefined : () => removeMethod(sheet.index as number)}
        />
      )}
    </>
  );
}

function TransferMethodSheet({
  initial,
  isNew,
  open,
  onClose,
  canManage,
  busy,
  onSave,
  onRemove,
}: {
  initial: MethodDraft;
  isNew: boolean;
  open: boolean;
  onClose: () => void;
  canManage: boolean;
  busy: boolean;
  onSave: (draft: MethodDraft) => Promise<boolean>;
  onRemove?: () => Promise<boolean>;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  // The values the sheet opened with: the list underneath changes after a save, the form's start does not.
  const [start] = useState<MethodDraft>(initial);
  const [draft, setDraft] = useState<MethodDraft>(initial);
  const [tried, setTried] = useState(false);
  const [removing, setRemoving] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(start);
  useReportDirty(open && dirty);
  const guard = useDiscardGuard(dirty && !busy, onClose);
  const nameMissing = tried && !draft.name.trim();
  const instructionsMissing = tried && !draft.instructions.trim();

  async function save() {
    setTried(true);
    if (!draft.name.trim() || !draft.instructions.trim()) return;
    if (await onSave(draft)) onClose();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) guard.requestClose();
      }}
      title={isNew ? t.addTitle : fmt(t.editTitle, { name: start.name })}
      size="md"
      footer={
        canManage ? (
          <>
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                className="me-auto min-h-11 rounded-full px-4 text-danger hover:bg-danger-soft"
                disabled={busy}
                onClick={() => setRemoving(true)}
              >
                <IconDelete className="size-4" aria-hidden />
                {t.remove}
              </Button>
            )}
            <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" disabled={busy} onClick={guard.requestClose}>
              {common.cancel}
            </Button>
            <Button type="button" className="min-h-11 rounded-full px-5" disabled={busy || (!isNew && !dirty)} onClick={() => void save()}>
              {busy ? common.saving : t.save}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t.name} error={nameMissing ? t.nameMissing : undefined}>
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              dir="auto"
              className={FIELD}
              placeholder={t.namePlaceholder}
              value={draft.name}
              maxLength={100}
              disabled={!canManage || busy}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          )}
        </Field>
        <Field label={t.instructions} error={instructionsMissing ? t.instructionsMissing : undefined}>
          {({ id, ...aria }) => (
            <Textarea
              id={id}
              {...aria}
              rows={3}
              dir="auto"
              className="text-base md:text-sm"
              placeholder={t.instructionsPlaceholder}
              value={draft.instructions}
              maxLength={1000}
              disabled={!canManage || busy}
              onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
            />
          )}
        </Field>
        <SettingsGroup>
          <SettingsSwitch
            label={t.enabled}
            checked={draft.enabled}
            disabled={!canManage || busy}
            onChange={(v) => setDraft({ ...draft, enabled: v })}
          />
          <SettingsSwitch
            label={t.requireReceipt}
            checked={draft.requireReceipt}
            disabled={!canManage || busy}
            onChange={(v) => setDraft({ ...draft, requireReceipt: v })}
          />
          <SettingsSwitch
            label={t.requireSender}
            checked={draft.requireSender}
            disabled={!canManage || busy}
            onChange={(v) => setDraft({ ...draft, requireSender: v })}
          />
        </SettingsGroup>
      </div>

      {guard.dialog}
      {onRemove && (
        <ConfirmDialog
          open={removing}
          title={fmt(t.removeTitle, { name: start.name })}
          description={t.removeBody}
          confirmLabel={t.remove}
          cancelLabel={common.cancel}
          busyLabel={common.loading}
          destructive
          onCancel={() => setRemoving(false)}
          onConfirm={async () => {
            const ok = await onRemove();
            setRemoving(false);
            if (ok) onClose();
          }}
        />
      )}
    </Sheet>
  );
}
