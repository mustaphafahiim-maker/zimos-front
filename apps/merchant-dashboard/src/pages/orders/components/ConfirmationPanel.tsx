import { useImperativeHandle, useState, type ElementType, type Ref } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card } from "@store-builder/ui";
import {
  apiErrorDetails,
  isApiErrorCode,
  type ConfirmationChannel,
  type ConfirmationLockDetails,
  type ConfirmationOutcome,
  type Order,
  type OrderConfirmationAttempt,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { countOf } from "@/lib/plural";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useToast } from "@/components/Toast";
import { CONFIRM_ROLES, MANAGE_ROLES, minutesUntil, useNow } from "@/pages/confirmation/confirmationRoles";
import { ChannelPicker, WhatsAppButton, useChannelLabels } from "@/pages/confirmation/confirmationChannel";
import { CustomizationList } from "./CustomizationList";
import { attemptAgentName, isCustomerLinkAttempt } from "@/pages/confirmation/customerLink";

const STRINGS = {
  en: {
    title: "Confirmation",
    needsConfirmation: "This cash-on-delivery order must be confirmed with the customer before it can ship.",
    attemptsOne: "1 call attempt so far.",
    attemptsOther: "{tries} so far.",
    callback: "Callback scheduled for {time}.",
    waiting:
      "Waiting for the offers window: the customer is still on the sales funnel's offers and may add to this order. It can be confirmed in {left} (at {time}).",
    waitingSoon: "Waiting for the offers window: it can be confirmed in a moment.",
    heldBy: "{name} is calling the customer now ({left} left). Confirming here is blocked until they finish or release it.",
    someone: "Another agent",
    confirm: "Confirm order",
    confirming: "Confirming…",
    rejectHint: "To reject it, use Cancel order.",
    openQueue: "Open confirmation queue",
    confirmedToast: "Order confirmed. It's ready to ship.",
    lockedBy: "{name} is already on this call ({left} left).",
    assignedTo: "Assigned to {name}.",
    assignedToYou: "Assigned to you.",
    assignedToOther: "Assigned to {name}. Only they or a manager can confirm it.",
    history: "Confirmation history",
    customerDetails: "Confirm these details with the customer",
    outcome_confirmed: "Confirmed",
    outcome_rejected: "Rejected",
    outcome_unreachable: "Unreachable",
    outcome_postponed: "Postponed",
    via: "via {channel}",
    unknownAgent: "Unknown user",
  },
  ar: {
    title: "التأكيد",
    needsConfirmation: "أوردر الدفع عند الاستلام لازم يتأكد مع العميل قبل ما يتشحن.",
    attemptsOne: "اتصلنا مرة واحدة لحد دلوقتي.",
    attemptsOther: "{tries} لحد دلوقتي.",
    callback: "المكالمة التانية معادها {time}.",
    heldBy: "{name} بيكلّم العميل دلوقتي (باقي {left}). التأكيد من هنا واقف لحد ما يخلص أو يرجّعه للقايمة.",
    someone: "حد تاني من الفريق",
    confirm: "أكّد الأوردر",
    confirming: "بنأكّد…",
    rejectHint: "لو العميل رفض، استخدم «إلغاء الأوردر».",
    openQueue: "افتح قايمة التأكيد",
    confirmedToast: "الأوردر اتأكد وبقى جاهز للشحن.",
    lockedBy: "{name} مستلم المكالمة دي (باقي {left}).",
    waiting:
      "مستني العروض تخلص: العميل لسه في عروض مسار البيع وممكن يزوّد على الأوردر ده. هتقدر تأكده بعد {left} (الساعة {time}).",
    waitingSoon: "مستني العروض تخلص: هتقدر تأكده كمان شوية.",
    assignedTo: "متوزع على {name}.",
    assignedToYou: "متوزع عليك.",
    assignedToOther: "متوزع على {name}، ومحدش يأكده غيره إلا المدير.",
    history: "سجل التأكيد",
    customerDetails: "راجع البيانات دي مع العميل",
    outcome_confirmed: "اتأكد",
    outcome_rejected: "اترفض",
    outcome_unreachable: "مردّش",
    outcome_postponed: "اتأجل",
    via: "عن طريق {channel}",
    unknownAgent: "مستخدم مش معروف",
  },
} satisfies Messages;

const OPEN_STATES = new Set(["pending", "unreachable", "postponed"]);

/**
 * Whether the order still waits on its confirmation call, and whether this
 * viewer may confirm it now. Pure, so the panel and the order page's hero
 * (which owns the one confirm button there) read the same answer.
 */
export function confirmationGate(order: Order, viewer: { role: string; userId: string | null | undefined; now: number }) {
  const task = order.confirmationTask ?? null;
  const open = order.paymentMethod === "cod" && !order.cancelledAt && OPEN_STATES.has(order.confirmationState);
  const canConfirm = CONFIRM_ROLES.has(viewer.role);
  const canManage = MANAGE_ROLES.has(viewer.role);
  const heldMinutes = task?.lockedBy ? minutesUntil(task.lockExpiresAt, viewer.now) : 0;
  // The holder themselves may confirm here; the server allows it.
  const heldByOther = Boolean(task?.lockedBy) && task?.lockedBy?.id !== viewer.userId && heldMinutes > 0;
  const assignee = task?.assignedTo ?? null;
  const assignedToOther = Boolean(assignee) && assignee?.id !== viewer.userId && !canManage;
  // A funnel order waits until the shopper is past the offers (the server refuses before).
  const waiting =
    task?.status === "queued" && Boolean(task.availableAt) && new Date(task.availableAt as string).getTime() > viewer.now;
  const waitingMinutes = waiting ? minutesUntil(task?.availableAt ?? null, viewer.now) : 0;
  return { open, canConfirm, heldMinutes, heldByOther, assignee, assignedToOther, waiting, waitingMinutes };
}

/** What the order page's hero may trigger: the same confirm, with the channel picked here. Resolves false when it failed (the reason shows in the panel). */
export interface ConfirmationPanelHandle {
  confirm: () => Promise<boolean>;
}

/**
 * Confirm a COD order that's still waiting on its call, without going through
 * the queue. Same backend rules as a queue call (POST /orders/:id/confirmation):
 * refused while another agent holds a live claim, or while the task is
 * assigned to someone else (unless the viewer manages orders). Rejecting stays
 * with Cancel order, which also closes the task.
 *
 * Once the order is past confirmation, only its attempt history stays.
 *
 * On the order page it sits inside a folding section: `frameless` drops the
 * card and its title, `hideConfirm` drops the confirm button (the page's hero
 * owns it) and `actionRef` lets that hero run the same confirm.
 */
export function ConfirmationPanel({
  order,
  onChanged,
  frameless,
  hideConfirm,
  actionRef,
}: {
  order: Order;
  onChanged: () => void;
  frameless?: boolean;
  hideConfirm?: boolean;
  actionRef?: Ref<ConfirmationPanelHandle>;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<ConfirmationChannel>("call");

  const task = order.confirmationTask ?? null;
  const attempts = task?.attempts ?? [];
  const { open, canConfirm, heldMinutes, heldByOther, assignee, assignedToOther, waiting, waitingMinutes } = confirmationGate(order, {
    role: currentWorkspace?.role ?? "",
    userId: user?.id,
    now,
  });
  useImperativeHandle(actionRef, () => ({ confirm }));

  if (!open) {
    if (attempts.length === 0) return null;
    return frameless ? (
      <AttemptList attempts={attempts} />
    ) : (
      <Card className="space-y-3 p-5">
        <h2 className="font-display text-lg font-medium text-ink">{t.history}</h2>
        <AttemptList attempts={attempts} />
      </Card>
    );
  }

  async function confirm(): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await apiClient.confirmOrder(workspaceId, order.id, undefined, channel);
      toast.success(t.confirmedToast);
      onChanged();
      return true;
    } catch (err) {
      if (isApiErrorCode(err, "TASK_ALREADY_LOCKED")) {
        const lock = apiErrorDetails<ConfirmationLockDetails>(err);
        setError(
          fmt(t.lockedBy, {
            name: lock?.lockedBy?.fullName ?? t.someone,
            left: countOf("minute", minutesUntil(lock?.lockExpiresAt ?? null, Date.now())),
          })
        );
      } else if (isApiErrorCode(err, "TASK_ASSIGNED_TO_OTHER")) {
        const details = apiErrorDetails<{ assignedTo: { fullName: string } | null }>(err);
        setError(fmt(t.assignedToOther, { name: details?.assignedTo?.fullName ?? t.someone }));
      } else {
        setError(errorMessage(err));
      }
      onChanged();
      return false;
    } finally {
      setBusy(false);
    }
  }

  const Frame: ElementType = frameless ? "div" : Card;
  return (
    <Frame className={frameless ? "space-y-3" : "space-y-3 p-5"}>
      {!frameless && <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>}
      <div className="space-y-1 text-sm text-ink-soft">
        <p className="text-ink">{t.needsConfirmation}</p>
        {task && task.attemptCount > 0 && (
          <p>{task.attemptCount === 1 ? t.attemptsOne : fmt(t.attemptsOther, { tries: countOf("call", task.attemptCount) })}</p>
        )}
        {task?.nextRetryAt && task.status === "queued" && (
          <p>{fmt(t.callback, { time: formatDateTime(task.nextRetryAt) })}</p>
        )}
        {assignee && (
          <p className={assignedToOther ? "font-medium text-accent-dark" : undefined}>
            {assignee.id === user?.id
              ? t.assignedToYou
              : assignedToOther
                ? fmt(t.assignedToOther, { name: assignee.fullName })
                : fmt(t.assignedTo, { name: assignee.fullName })}
          </p>
        )}
        {waiting && (
          <p role="status" className="font-medium text-accent-dark">
            {waitingMinutes > 0
              ? fmt(t.waiting, { left: countOf("minute", waitingMinutes), time: formatDateTime(task?.availableAt as string) })
              : t.waitingSoon}
          </p>
        )}
        {heldByOther && (
          <p className="font-medium text-accent-dark">
            {fmt(t.heldBy, { name: task?.lockedBy?.fullName ?? t.someone, left: countOf("minute", heldMinutes) })}
          </p>
        )}
      </div>

      {order.items.some((item) => item.customizations && item.customizations.length > 0) && (
        <section aria-label={t.customerDetails} className="space-y-2">
          <h3 className="text-sm font-medium text-ink">{t.customerDetails}</h3>
          {order.items
            .filter((item) => item.customizations && item.customizations.length > 0)
            .map((item) => (
              <div key={item.id} className="space-y-1">
                <p className="text-xs font-medium text-ink-soft">{item.productNameSnapshot}</p>
                <CustomizationList customizations={item.customizations} compact currency={order.currency} />
              </div>
            ))}
        </section>
      )}

      {canConfirm && !heldByOther && !assignedToOther && !waiting && (
        <div className="space-y-3">
          <WhatsAppButton order={order} onOpen={() => setChannel("whatsapp")} />
          <ChannelPicker value={channel} onChange={setChannel} disabled={busy} />
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        {canConfirm && !hideConfirm && (
          <Button onClick={confirm} disabled={busy || heldByOther || assignedToOther || waiting} className="min-h-11">
            {busy ? t.confirming : t.confirm}
          </Button>
        )}
        <Link to="/confirmation-queue" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
          {t.openQueue}
        </Link>
      </div>
      <p className="text-xs text-ink-soft">{t.rejectHint}</p>

      {attempts.length > 0 && (
        <details className="rounded-[0.5rem] border border-line px-4 py-2 text-sm">
          <summary className="min-h-11 cursor-pointer content-center font-medium text-ink">{t.history}</summary>
          <AttemptList attempts={attempts} />
        </details>
      )}
    </Frame>
  );
}

/** Each attempt: outcome, how the customer was reached, who, when and any note. */
function AttemptList({ attempts }: { attempts: OrderConfirmationAttempt[] }) {
  const t = useT(STRINGS);
  const channelLabel = useChannelLabels();
  const outcome = (o: ConfirmationOutcome) => t[`outcome_${o}`];
  return (
    <ol className="mt-2 space-y-2 text-sm">
      {attempts.map((attempt) => (
        <li key={attempt.id} className="border-b border-line pb-2 last:border-b-0 last:pb-0">
          <p className="text-ink">
            <span className="font-medium">{outcome(attempt.outcome)}</span>
            {attempt.channel && !isCustomerLinkAttempt(attempt) && <> · {fmt(t.via, { channel: channelLabel[attempt.channel] })}</>} ·{" "}
            {attemptAgentName(attempt, t.unknownAgent)}
          </p>
          <p className="text-xs text-ink-soft">{formatDateTime(attempt.createdAt)}</p>
          {attempt.notes && <p className="mt-0.5 whitespace-pre-line text-ink-soft">{attempt.notes}</p>}
        </li>
      ))}
    </ol>
  );
}
