import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card } from "@store-builder/ui";
import type {
  ConfirmationOutcome,
  ConfirmationTask,
  RecordConfirmationOutcomePayload,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { getErrorMessage } from "@/lib/errors";
import { formatAddress, formatMoney } from "@/lib/format";
import { useT, useCommon, useLocale, fmt, type Locale, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { TextField, Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Confirmation queue",
    description: "Call each customer to confirm their order before it moves to fulfilment.",
    empty: "No orders waiting for confirmation right now 🎉",
    itemsOne: "1 item",
    itemsTwo: "{n} items",
    itemsFew: "{n} items",
    itemsMany: "{n} items",
    attemptsOne: "1 previous attempt",
    attemptsTwo: "{n} previous attempts",
    attemptsFew: "{n} previous attempts",
    attemptsMany: "{n} previous attempts",
    unnamed: "Unnamed customer",
    noPhone: "No phone number",
    claiming: "Claiming…",
    claim: "Claim & call",
    rejectionReason: "Rejection reason",
    rejectionPlaceholder: "Customer changed their mind",
    notes: "Notes",
    notesPlaceholder: "Anything worth recording from the call (optional).",
    saveOutcome: "Save outcome",
    toastMarked: "{order} marked {outcome}.",
  },
  ar: {
    title: "قائمة تأكيد الطلبات",
    description: "اتصل بكل عميل لتأكيد طلبه قبل انتقاله إلى التجهيز والشحن.",
    empty: "لا توجد طلبات بانتظار التأكيد الآن 🎉",
    itemsOne: "منتج واحد",
    itemsTwo: "منتجان",
    itemsFew: "{n} منتجات",
    itemsMany: "{n} منتج",
    attemptsOne: "محاولة سابقة واحدة",
    attemptsTwo: "محاولتان سابقتان",
    attemptsFew: "{n} محاولات سابقة",
    attemptsMany: "{n} محاولة سابقة",
    unnamed: "عميل بدون اسم",
    noPhone: "لا يوجد رقم هاتف",
    claiming: "جارٍ الاستلام…",
    claim: "استلام والاتصال",
    rejectionReason: "سبب الرفض",
    rejectionPlaceholder: "العميل غيّر رأيه",
    notes: "ملاحظات",
    notesPlaceholder: "أي تفاصيل مهمة من المكالمة (اختياري).",
    saveOutcome: "حفظ النتيجة",
    toastMarked: "{order}: {outcome}.",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

const OUTCOMES: ConfirmationOutcome[] = ["confirmed", "rejected", "unreachable", "postponed"];

const OUTCOME_LABEL: Record<Locale, Record<ConfirmationOutcome, string>> = {
  en: {
    confirmed: "Confirmed",
    rejected: "Rejected",
    unreachable: "Unreachable",
    postponed: "Postponed",
  },
  ar: {
    confirmed: "تم التأكيد",
    rejected: "مرفوض",
    unreachable: "تعذّر الوصول",
    postponed: "مؤجل",
  },
};

/** Picks the right plural form (Arabic has one / two / few (3–10) / many). */
function plural(n: number, t: Strings, base: "items" | "attempts"): string {
  const form = n === 1 ? "One" : n === 2 ? "Two" : n >= 3 && n <= 10 ? "Few" : "Many";
  return fmt(t[`${base}${form}` as const], { n });
}

export function ConfirmationQueuePage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const queue = useAsync(
    () => apiClient.listConfirmationQueue(workspaceId, { status: "queued", limit: 200 }),
    [workspaceId]
  );
  const tasks = queue.data ?? [];

  function patchTask(updated: ConfirmationTask) {
    queue.setData((prev) => (prev ?? []).map((x) => (x.id === updated.id ? updated : x)));
  }

  function removeTask(taskId: string) {
    queue.setData((prev) => (prev ?? []).filter((x) => x.id !== taskId));
  }

  return (
    <div className="min-w-0 max-w-3xl">
      <PageHeader title={t.title} description={t.description} />

      <DataState
        loading={queue.loading}
        error={queue.error}
        empty={tasks.length === 0}
        emptyMessage={t.empty}
        onRetry={() => queue.refresh()}
      >
        <div className="space-y-4">
          {tasks.map((task) => (
            <ConfirmationCard
              key={task.id}
              task={task}
              onClaimed={patchTask}
              onResolved={removeTask}
            />
          ))}
        </div>
      </DataState>
    </div>
  );
}

function ConfirmationCard({
  task,
  onClaimed,
  onResolved,
}: {
  task: ConfirmationTask;
  onClaimed: (task: ConfirmationTask) => void;
  onResolved: (taskId: string) => void;
}) {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const { order } = task;
  const contact = order.contactSnapshot;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ConfirmationOutcome | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [notes, setNotes] = useState("");

  const rejectionMissing = outcome === "rejected" && rejectionReason.trim() === "";

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.claimConfirmationTask(workspaceId, task.id);
      onClaimed(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      // The card stays mounted after a claim (its task just flips to
      // in_progress), so it's safe to drop the busy flag here.
      setBusy(false);
    }
  }

  async function save() {
    if (!outcome || rejectionMissing) return;
    setBusy(true);
    setError(null);
    try {
      const payload: RecordConfirmationOutcomePayload = { outcome };
      if (notes.trim()) payload.notes = notes.trim();
      if (outcome === "rejected") payload.rejectionReason = rejectionReason.trim();
      await apiClient.recordConfirmationOutcome(workspaceId, task.id, payload);
      const label = OUTCOME_LABEL[locale][outcome];
      toast.success(fmt(t.toastMarked, { order: order.orderNumber, outcome: locale === "en" ? label.toLowerCase() : label }));
      onResolved(task.id);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Card className="min-w-0 space-y-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/orders/${order.id}`}
            className="font-display text-lg font-semibold text-ink hover:text-primary"
          >
            <bdi>{order.orderNumber}</bdi>
          </Link>
          <p className="mt-0.5 text-sm text-ink-soft">
            {plural(order.items.length, t, "items")} ·{" "}
            <bdi>{formatMoney(order.totalAmount, order.currency)}</bdi>
          </p>
        </div>
        {task.attemptCount > 0 && (
          <span className="rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
            {plural(task.attemptCount, t, "attempts")}
          </span>
        )}
      </div>

      <div className="rounded-lg bg-paper px-4 py-3">
        <p className="text-sm font-medium text-ink" dir="auto">
          {contact.fullName || t.unnamed}
        </p>
        <p className="mt-0.5 font-display text-xl font-semibold text-ink">
          {contact.phone ? (
            <a href={`tel:${contact.phone}`} className="hover:text-primary" dir="ltr">
              {contact.phone}
            </a>
          ) : (
            <span className="text-ink-soft">{t.noPhone}</span>
          )}
        </p>
        <p className="mt-1 text-sm text-ink-soft" dir="auto">
          {formatAddress(order.shippingAddressSnapshot)}
        </p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {task.status === "queued" ? (
        <Button onClick={claim} disabled={busy}>
          {busy ? t.claiming : t.claim}
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {OUTCOMES.map((o) => (
              <Button
                key={o}
                type="button"
                size="lg"
                variant={outcome === o ? "primary" : "outline"}
                onClick={() => setOutcome(o)}
                disabled={busy}
              >
                {OUTCOME_LABEL[locale][o]}
              </Button>
            ))}
          </div>

          {outcome === "rejected" && (
            <TextField
              label={t.rejectionReason}
              required
              dir="auto"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t.rejectionPlaceholder}
            />
          )}

          <Field label={t.notes}>
            {({ id }) => (
              <Textarea
                id={id}
                dir="auto"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.notesPlaceholder}
              />
            )}
          </Field>

          <Button onClick={save} disabled={busy || !outcome || rejectionMissing}>
            {busy ? c.saving : t.saveOutcome}
          </Button>
        </div>
      )}
    </Card>
  );
}
