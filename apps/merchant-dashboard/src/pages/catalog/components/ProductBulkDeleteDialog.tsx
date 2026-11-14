import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Button, Input, Label } from "@store-builder/ui";
import {
  catalogBulkDeleteProducts,
  type CatalogBulkDeleteMode,
  type CatalogBulkDeleteSkip,
  type CatalogBulkDeleteSkipReason,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { RequestTimeout, withTimeout } from "./importFollow";
import { BulkProgress } from "./BulkProgress";
import {
  addResult,
  advance,
  CHUNK_TIMEOUT_MS,
  CONFIRM_WORD_FROM,
  confirmWordMatches,
  firstPosition,
  nextRequest,
  pause,
  rateLimitWait,
  targetCount,
  type BulkDeletePosition,
  type BulkDeleteTarget,
  type BulkDeleteTotals,
} from "./bulkDelete";

/**
 * Deletes many products at once, by the single delete's rules
 * (ProductRemoveDialog): archive them, or delete them for good — a product
 * with orders, or sold in a funnel, is skipped and listed with the reason.
 * The server takes a chunk per request (bulkDelete.ts); this dialog sends
 * them one after another, shows how far it got, and can stop or go on.
 */

const STRINGS = {
  en: {
    title: "Delete {count} products?",
    titleOne: "Delete 1 product?",
    description: "Choose whether to archive them or delete them for good.",
    archiveHeading: "Archive",
    archiveBody:
      "Hidden from your store, and no new orders. Orders and history are kept, and you can restore them from the Archived tab.",
    deleteHeading: "Delete permanently",
    deleteBody:
      "Removes the products with their variants and offers. Products that have orders or are sold in a funnel are skipped, and you'll see which.",
    deleteWarning: "This can't be undone.",
    word: "DELETE",
    typeToConfirm: "Type {word} to confirm",
    confirmArchive: "Archive {count} products",
    confirmDelete: "Delete {count} products permanently",
    archiving: "Archiving… {done} of {count}",
    deleting: "Deleting… {done} of {count}",
    waiting: "Too many requests at once: going on in {seconds} seconds…",
    stop: "Stop",
    archived: "{count} archived.",
    deleted: "{count} deleted permanently.",
    stopped: "Stopped. Products already done stay as they are.",
    skippedTitle: "{count} skipped:",
    reason_has_orders: "Has orders, so it can only be archived",
    reason_in_funnel: "Sold in a funnel: remove it from the funnel first",
    reason_not_found: "Not found: it may have been deleted already",
    reason_already_archived: "Already archived",
    unnamed: "A product",
    more: "…and {count} more",
    archiveInstead: "Archive the {count} with orders instead",
    failed: "The delete stopped: {error}",
    soFar: "So far: {deleted} done, {skipped} skipped.",
    timeout: "the server took too long to answer. Some of the last products may have been done anyway.",
    tryAgain: "Try again",
    cancel: "Cancel",
    close: "Close",
  },
  ar: {
    title: "حذف {count} منتج؟",
    titleOne: "حذف منتج واحد؟",
    description: "اختر أرشفة المنتجات أو حذفها نهائيًا.",
    archiveHeading: "أرشفة",
    archiveBody:
      "تختفي من متجرك ويتوقف استقبال أوردرات جديدة عليها. تبقى الأوردرات والسجل كما هي، ويمكنك استعادتها من تبويب المؤرشف.",
    deleteHeading: "حذف نهائي",
    deleteBody:
      "يحذف المنتجات مع متغيراتها وعروضها. المنتجات التي عليها أوردرات أو المستخدمة في مسار بيع يتم تخطيها، وستعرف أيها.",
    deleteWarning: "لا يمكن التراجع عن ذلك.",
    word: "حذف",
    typeToConfirm: "اكتب «{word}» للتأكيد",
    confirmArchive: "أرشفة {count} منتج",
    confirmDelete: "حذف {count} منتج نهائيًا",
    archiving: "جارٍ الأرشفة… {done} من {count}",
    deleting: "جارٍ الحذف… {done} من {count}",
    waiting: "طلبات كثيرة في وقت واحد: سنكمل بعد {seconds} ثانية…",
    stop: "إيقاف",
    archived: "تمت أرشفة {count}.",
    deleted: "تم حذف {count} نهائيًا.",
    stopped: "تم الإيقاف. المنتجات التي تمت معالجتها تبقى كما هي.",
    skippedTitle: "تم تخطي {count}:",
    reason_has_orders: "عليه أوردرات، لذلك يمكن أرشفته فقط",
    reason_in_funnel: "مستخدم في مسار بيع: احذفه من المسار أولًا",
    reason_not_found: "غير موجود: ربما تم حذفه بالفعل",
    reason_already_archived: "مؤرشف بالفعل",
    unnamed: "منتج",
    more: "…و{count} أخرى",
    archiveInstead: "أرشفة الـ {count} التي عليها أوردرات بدلًا من ذلك",
    failed: "توقف الحذف: {error}",
    soFar: "حتى الآن: تمت معالجة {deleted}، وتخطي {skipped}.",
    timeout: "استغرق الخادم وقتًا طويلًا في الرد. ربما تمت معالجة بعض المنتجات الأخيرة بالفعل.",
    tryAgain: "حاول مرة أخرى",
    cancel: "إلغاء",
    close: "إغلاق",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];
type Phase = "confirm" | "running" | "finished" | "error";

/** The skipped products listed by name; the rest are counted. */
const LISTED_SKIPS = 50;

const EMPTY: BulkDeleteTotals = { deleted: 0, skipped: [], processed: 0 };

interface Props {
  target: BulkDeleteTarget;
  /** The Archived tab: only the permanent delete, as for one archived product. */
  archivedOnly: boolean;
  onClose: () => void;
  /** Products were archived or deleted: refresh the list and clear the selection. */
  onDone: () => void;
}

export function ProductBulkDeleteDialog({ target: initialTarget, archivedOnly, onClose, onDone }: Props) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [target, setTarget] = useState(initialTarget);
  const [mode, setMode] = useState<CatalogBulkDeleteMode>(archivedOnly ? "permanent" : "archive");
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<Phase>("confirm");
  const [totals, setTotals] = useState<BulkDeleteTotals>(EMPTY);
  const [waitSeconds, setWaitSeconds] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const position = useRef<BulkDeletePosition>(firstPosition(initialTarget));
  const run = useRef<AbortController | null>(null);
  // A run was started: even one stopped midway may have changed products
  // (the server finishes the chunk it was given), so closing refreshes the list.
  const started = useRef(false);

  const count = targetCount(target);
  const needsWord = count >= CONFIRM_WORD_FROM;
  const confirmed = !needsWord || confirmWordMatches(typed, t.word);

  useEffect(() => () => run.current?.abort(), []);

  async function go(runMode: CatalogBulkDeleteMode, runTarget: BulkDeleteTarget, from: BulkDeletePosition, startTotals: BulkDeleteTotals) {
    const controller = new AbortController();
    run.current = controller;
    started.current = true;
    position.current = from;
    let sum = startTotals;
    setPhase("running");
    setError(null);
    setStopped(false);
    setTotals(sum);

    for (;;) {
      const request = nextRequest(runMode, runTarget, position.current);
      if (!request) break;
      try {
        const result = await withTimeout(CHUNK_TIMEOUT_MS, controller.signal, (signal) =>
          catalogBulkDeleteProducts(apiClient, workspaceId, request, { signal })
        );
        position.current = advance(position.current, request, result);
        sum = addResult(sum, result);
        setTotals(sum);
      } catch (err) {
        if (controller.signal.aborted) return;
        const wait = rateLimitWait(err);
        if (wait !== null) {
          setWaitSeconds(Math.ceil(wait / 1000));
          try {
            await pause(wait, controller.signal);
          } catch {
            return;
          }
          setWaitSeconds(null);
          continue;
        }
        setError(err instanceof RequestTimeout ? t.timeout : errorMessage(err));
        setPhase("error");
        run.current = null;
        return;
      }
      if (controller.signal.aborted) return;
    }
    run.current = null;
    setPhase("finished");
  }

  function stop() {
    run.current?.abort();
    run.current = null;
    setWaitSeconds(null);
    setStopped(true);
    setPhase("finished");
  }

  function close() {
    run.current?.abort();
    if (started.current) onDone();
    else onClose();
  }

  function archiveInstead(ids: string[]) {
    const next: BulkDeleteTarget = { kind: "ids", ids };
    setTarget(next);
    setMode("archive");
    void go("archive", next, firstPosition(next), EMPTY);
  }

  const title = count === 1 ? t.titleOne : fmt(t.title, { count });

  if (phase === "confirm") {
    return (
      <Modal
        open
        onClose={close}
        title={title}
        description={archivedOnly ? undefined : t.description}
        footer={
          <>
            <Button variant="outline" onClick={close}>
              {t.cancel}
            </Button>
            <Button
              variant={mode === "permanent" ? "danger" : "primary"}
              disabled={!confirmed}
              onClick={() => void go(mode, target, firstPosition(target), EMPTY)}
            >
              {fmt(mode === "permanent" ? t.confirmDelete : t.confirmArchive, { count })}
            </Button>
          </>
        }
      >
        <div className="space-y-3" role="radiogroup">
          {!archivedOnly && (
            <ModeOption
              checked={mode === "archive"}
              onSelect={() => setMode("archive")}
              heading={t.archiveHeading}
              body={t.archiveBody}
            />
          )}
          <ModeOption
            checked={mode === "permanent"}
            onSelect={() => setMode("permanent")}
            heading={t.deleteHeading}
            body={
              <>
                {t.deleteBody} <strong className="font-medium text-danger">{t.deleteWarning}</strong>
              </>
            }
            danger
          />
          {needsWord && (
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="bulk-delete-word">{fmt(t.typeToConfirm, { word: t.word })}</Label>
              <Input
                id="bulk-delete-word"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            </div>
          )}
        </div>
      </Modal>
    );
  }

  if (phase === "running") {
    const done = Math.min(totals.processed, count);
    return (
      <Modal
        open
        onClose={stop}
        title={title}
        footer={
          <Button variant="outline" onClick={stop}>
            {t.stop}
          </Button>
        }
      >
        <div className="space-y-3">
          <BulkProgress label={fmt(mode === "permanent" ? t.deleting : t.archiving, { done, count })} done={done} total={count} />
          {waitSeconds !== null && <p className="text-sm text-ink-soft">{fmt(t.waiting, { seconds: waitSeconds })}</p>}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={close}
      title={title}
      footer={
        <>
          {phase === "error" && (
            <Button variant="outline" onClick={() => void go(mode, target, position.current, totals)}>
              {t.tryAgain}
            </Button>
          )}
          <Button variant="outline" onClick={close}>
            {t.close}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {phase === "error" ? (
          <Alert variant="danger">
            {fmt(t.failed, { error: error ?? "" })} {fmt(t.soFar, { deleted: totals.deleted, skipped: totals.skipped.length })}
          </Alert>
        ) : (
          <Alert variant={totals.skipped.length > 0 || stopped ? "info" : "success"}>
            {fmt(mode === "permanent" ? t.deleted : t.archived, { count: totals.deleted })}
            {stopped ? ` ${t.stopped}` : ""}
          </Alert>
        )}
        <SkippedList skipped={totals.skipped} t={t} />
        {phase === "finished" && mode === "permanent" && <ArchiveInstead skipped={totals.skipped} t={t} onArchive={archiveInstead} />}
      </div>
    </Modal>
  );
}

function ModeOption({
  checked,
  onSelect,
  heading,
  body,
  danger = false,
}: {
  checked: boolean;
  onSelect: () => void;
  heading: string;
  body: ReactNode;
  danger?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-[0.5rem] border p-4 ${
        checked ? (danger ? "border-danger" : "border-primary") : danger ? "border-danger/30" : "border-line"
      }`}
    >
      <input type="radio" name="bulk-delete-mode" className="mt-1 size-4 accent-primary" checked={checked} onChange={onSelect} />
      <span>
        <span className={`block font-medium ${danger ? "text-danger" : "text-ink"}`}>{heading}</span>
        <span className="mt-1 block text-sm text-ink-soft">{body}</span>
      </span>
    </label>
  );
}

function SkippedList({ skipped, t }: { skipped: CatalogBulkDeleteSkip[]; t: Strings }) {
  if (skipped.length === 0) return null;
  const reason = (key: CatalogBulkDeleteSkipReason) => t[`reason_${key}`];
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-ink">{fmt(t.skippedTitle, { count: skipped.length })}</p>
      <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-[0.5rem] border border-line text-sm">
        {skipped.slice(0, LISTED_SKIPS).map((item) => (
          <li key={item.id} className="px-3 py-2">
            <p className="font-medium text-ink" dir="auto">
              {item.name ?? t.unnamed}
            </p>
            <p className="text-ink-soft">{reason(item.reason)}</p>
          </li>
        ))}
        {skipped.length > LISTED_SKIPS && (
          <li className="px-3 py-2 text-ink-soft">{fmt(t.more, { count: skipped.length - LISTED_SKIPS })}</li>
        )}
      </ul>
    </div>
  );
}

/** Products the permanent delete skipped for their orders can still be archived, as one product can. */
function ArchiveInstead({ skipped, t, onArchive }: { skipped: CatalogBulkDeleteSkip[]; t: Strings; onArchive: (ids: string[]) => void }) {
  const ids = skipped.filter((item) => item.reason === "has_orders").map((item) => item.id);
  if (ids.length === 0) return null;
  return (
    <Button type="button" variant="outline" onClick={() => onArchive(ids)}>
      {fmt(t.archiveInstead, { count: ids.length })}
    </Button>
  );
}
