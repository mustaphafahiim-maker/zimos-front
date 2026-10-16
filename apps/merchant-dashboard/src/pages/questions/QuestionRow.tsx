import type { ProductQuestion } from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { IconChat, IconDelete, IconEdit, IconEye, IconEyeOff, IconProduct, IconQuickLook } from "@/components/icons";
import { ListRowCard } from "@/components/list";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatDateTime } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useViewNavigate } from "@/lib/viewTransition";
import { ItemMenu } from "@/pages/catalog/media/ItemMenu";
import { DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction, rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { QUESTION_STATUS_TONE, QUESTION_STRINGS } from "./questionStrings";

/** The columns of the questions sheet: the question and who asked, where it stands, since when, what to do. */
export const QUESTION_COLUMNS = "grid-cols-[minmax(0,1fr)_max-content_max-content_max-content]";

/** What a row can be asked to do, besides opening its preview. */
export type QuestionMove = "hide" | "publish";

export interface QuestionRowProps {
  question: ProductQuestion;
  /** Off in the product page's section, where every question is about that product. */
  showProduct: boolean;
  /** A card (narrow screens, the product page) or a line of the sheet. */
  compact: boolean;
  /** The move on its way to the server for this question, if any. */
  busy: QuestionMove | null;
  /** Its preview is open. */
  current: boolean;
  onPeek: () => void;
  onAnswer: () => void;
  onHide: () => void;
  /** A hidden question that already has its answer goes back on the product page. */
  onPublishAgain: () => void;
  onDelete: () => void;
}

/**
 * One shopper question in the list: what they asked, about which product,
 * where it stands — and the ONE move, «رُد» (or «عدّل الرد» once answered),
 * which opens the answer sheet. A press anywhere else opens Quick Look (Space
 * too; Enter opens the product). Hide, publish again and delete are in «…»,
 * in the menu of the row (right-click, a long press, Shift+F10) and in Quick
 * Look.
 */
export function QuestionRow({ question, showProduct, compact, busy, current, onPeek, onAnswer, onHide, onPublishAgain, onDelete }: QuestionRowProps) {
  const t = useT(QUESTION_STRINGS);
  const navigate = useViewNavigate();

  const asker = question.askerName?.trim() || t.anonymous;
  const productPath = question.productName ? `/catalog/${question.productId}?tab=questions` : null;
  const answered = Boolean(question.answer);
  const acting = busy !== null;
  const peekLabel = fmt(t.peek, { who: asker });
  const keys = rowKeyProps(onPeek, showProduct && productPath ? () => navigate(productPath) : undefined);

  const menu: ContextMenuItem[] = [{ id: "peek", label: t.menuPeek, icon: IconQuickLook, onSelect: onPeek }];
  if (showProduct && productPath) menu.push({ id: "product", label: t.menuProduct, icon: IconProduct, onSelect: () => navigate(productPath) });
  menu.push({
    id: "answer",
    label: answered ? t.editAnswer : t.answer,
    icon: answered ? IconEdit : IconChat,
    separatorBefore: true,
    disabled: acting,
    onSelect: onAnswer,
  });
  if (question.status === "hidden" && answered) menu.push({ id: "publish", label: t.publishAgain, icon: IconEye, disabled: acting, onSelect: onPublishAgain });
  if (question.status !== "hidden") menu.push({ id: "hide", label: t.hide, icon: IconEyeOff, disabled: acting, onSelect: onHide });
  menu.push({ id: "delete", label: t.remove, icon: IconDelete, destructive: true, separatorBefore: true, disabled: acting, onSelect: onDelete });

  // The ONE move of the row: the brand pill while an answer is due, a quiet pane once it was given.
  const action = (
    <RowAction
      tone={question.status === "pending" ? "primary" : "quiet"}
      label={answered ? t.editAnswer : t.answer}
      icon={compact ? undefined : answered ? IconEdit : IconChat}
      disabled={acting}
      onClick={onAnswer}
    />
  );

  const status = <StatusBadge value={question.status} tone={QUESTION_STATUS_TONE[question.status]} text={t[`status_${question.status}`]} />;
  const age = (
    <time dateTime={question.createdAt} title={formatDateTime(question.createdAt)}>
      {formatRelativeTime(question.createdAt)}
    </time>
  );
  // dir="auto": the shopper wrote it in their own language, not the dashboard's.
  const words = (
    <p dir="auto" className="line-clamp-2 text-sm leading-5 font-medium wrap-anywhere text-ink">
      {question.question}
    </p>
  );

  if (compact) {
    return (
      <li>
        <ContextMenu items={menu} label={t.menuLabel}>
          <ListRowCard
            title={
              showProduct ? (
                <bdi className={question.productName ? undefined : "font-medium text-ink-soft"}>{question.productName || t.unknownProduct}</bdi>
              ) : (
                <bdi>{asker}</bdi>
              )
            }
            amount={<span className="text-xs font-normal text-ink-soft">{age}</span>}
            status={status}
            meta={showProduct ? <bdi>{asker}</bdi> : undefined}
            action={action}
            footer={<div className="basis-full">{words}</div>}
            onOpen={onPeek}
            openLabel={peekLabel}
            aria-haspopup="dialog"
            {...keys}
          />
        </ContextMenu>
      </li>
    );
  }

  return (
    <DeskRow onOpen={onPeek} openLabel={peekLabel} keyProps={keys} current={current} menu={menu} menuLabel={t.menuLabel}>
      <div className="min-w-0 py-0.5">
        {words}
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs leading-5 text-ink-soft">
          {showProduct &&
            (productPath ? (
              // The name is the way to the product's page; the row itself opens the preview.
              <ViewLink
                to={productPath}
                className="min-w-0 truncate rounded-sm hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <bdi>{question.productName}</bdi>
              </ViewLink>
            ) : (
              <span className="min-w-0 truncate">{t.unknownProduct}</span>
            ))}
          {showProduct && <span aria-hidden>·</span>}
          <span className="shrink-0">
            <bdi>{asker}</bdi>
          </span>
        </p>
      </div>

      <div className="flex items-center">{status}</div>

      <div className="text-xs whitespace-nowrap text-ink-soft">{age}</div>

      <div className="flex items-center justify-end gap-1">
        {action}
        <ItemMenu items={menu} label={t.menuLabel} />
      </div>
    </DeskRow>
  );
}
