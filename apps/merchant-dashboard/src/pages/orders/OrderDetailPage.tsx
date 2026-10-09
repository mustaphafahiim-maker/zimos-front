import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import type { Order } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { refreshWorkCounts } from "@/lib/workCounts";
import { formatDateTime } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageActionBar, PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import type { ConfirmationPanelHandle } from "./components/ConfirmationPanel";
import { OrderFulfilmentPlan } from "./components/OrderFulfilmentPlan";
import { OrderHero } from "./components/OrderHero";
import { RestockReturnedCard } from "./components/RestockReturnedCard";
import { OrderNeighborArrows, useMarkSeen, useOrderNeighbors } from "./components/OrderHeaderTools";
import { useOrderSessionDetails } from "./components/OrderSessionDetails";
import { OrderMoreMenu } from "./detail/OrderMoreMenu";
import { NextStepButton } from "./detail/OrderNextStep";
import { OrderPageSkeleton } from "./detail/OrderPageSkeleton";
import { OrderSections } from "./detail/OrderSections";
import { OrderStageChip } from "./detail/OrderStageChip";
import { useConfirmationGate } from "./detail/useConfirmationGate";
import { useOrderNextStep } from "./detail/useOrderNextStep";
import { useOrderPageActions } from "./detail/useOrderPageActions";
import { useSectionOpen } from "./detail/useSectionOpen";

const STRINGS = {
  en: {
    order: "Order",
    back: "Orders",
    placed: "Placed {date}",
  },
  ar: {
    order: "الأوردر",
    back: "الأوردرات",
    placed: "اتطلب {date}",
  },
} satisfies Messages;

/** An order number is read left to right wherever it stands; the title is plain text, so the marks do what <bdi> would. */
const isolate = (value: string) => `⁦${value}⁩`;

/**
 * One order (/orders/:orderId).
 *
 * What used to be twenty always-open cards is a hero, three open cards and
 * folding sections (docs/ux/REDESIGN_PROMPT.md §6):
 *
 *   header   back · the order number · the stage chip (press it to move the
 *            order in place, with Undo) · previous / next · «…» with every
 *            other action                      detail/OrderStageChip, OrderMoreMenu
 *   hero     who · how much · where · the next step as one button
 *                                              components/OrderHero, detail/useOrderNextStep
 *   below    holiday / pickup / delivery-time notes, then items, money and
 *            notes open, and everything else folded with a one-line summary
 *                                              detail/OrderSections
 *
 * This file loads the order and composes those. Each order gets a page of
 * its own (the key), so nothing opened or typed on one follows the merchant
 * to the next — and an order already seen in this session is on screen from
 * the first frame (lib/useCachedAsync), refreshed behind.
 */
export function OrderDetailPage() {
  const { orderId = "" } = useParams<{ orderId: string }>();
  const workspaceId = useWorkspaceId();
  return <OrderPage key={`${workspaceId}:${orderId}`} workspaceId={workspaceId} orderId={orderId} />;
}

function OrderPage({ workspaceId, orderId }: { workspaceId: string; orderId: string }) {
  const t = useT(STRINGS);
  const loaded = useCachedAsync(`order-page:${workspaceId}:${orderId}`, () => apiClient.getOrder(workspaceId, orderId), [workspaceId, orderId]);
  const order = loaded.data;
  // Bumped on every reload: notes and seen do not move the order's updatedAt.
  const [refreshCount, setRefreshCount] = useState(0);
  const reload = () => {
    setRefreshCount((n) => n + 1);
    return loaded.refresh({ silent: true });
  };

  // Asked for beside the order (not after it), and shown in either state of the page.
  const neighbors = useOrderNeighbors(orderId);
  const arrows = <OrderNeighborArrows neighbors={neighbors} />;

  if (!order || loaded.error) {
    return (
      <div className="max-w-6xl">
        <PageHeader title={t.order} back={{ to: "/orders", label: t.back }} actions={arrows} />
        {/* Not found, no permission and a dropped connection each get DataState's own pane. */}
        <DataState loading={loaded.loading} error={loaded.error} onRetry={() => loaded.refresh()} skeleton={<OrderPageSkeleton />}>
          {null}
        </DataState>
      </div>
    );
  }

  return <LoadedOrder order={order} arrows={arrows} reload={reload} refreshCount={refreshCount} />;
}

function LoadedOrder({
  order,
  arrows,
  reload,
  refreshCount,
}: {
  order: Order;
  arrows: ReactNode;
  reload: () => Promise<void>;
  refreshCount: number;
}) {
  const t = useT(STRINGS);
  // Opening the page is what "seen" means.
  useMarkSeen(order, reload);
  // Session details, the customer's order count and the last action (SPEC §4.4).
  const session = useOrderSessionDetails(order.id, `${order.updatedAt}:${refreshCount}`);

  // Every dialog of the page's actions, mounted once; the header's menus and the hero open them.
  const { actions, host } = useOrderPageActions(order, reload);
  const gate = useConfirmationGate(order);
  const sections = useSectionOpen(order, gate.open);
  const confirmRef = useRef<ConfirmationPanelHandle>(null);
  const nextStep = useOrderNextStep(order, {
    gate,
    confirm: () => confirmRef.current?.confirm() ?? Promise.resolve(false),
    sections,
  });

  // The side menu, the dock and home count orders by stage: tell them when this one moved.
  const lastStage = useRef(order.stage);
  useEffect(() => {
    if (lastStage.current === order.stage) return;
    lastStage.current = order.stage;
    refreshWorkCounts();
  }, [order.stage]);

  return (
    <div className="zimos-order-page max-w-6xl">
      {/* The three parts a row of the orders list travels into: the stage chip here, the name and the total in the hero. */}
      <div data-vt-target>
        <PageHeader
          title={isolate(order.orderNumber)}
          back={{ to: "/orders", label: t.back }}
          description={fmt(t.placed, { date: formatDateTime(order.createdAt) })}
          titleBadge={<OrderStageChip order={order} onChanged={reload} actions={actions} />}
          actions={
            <>
              {arrows}
              <OrderMoreMenu order={order} onChanged={reload} actions={actions} />
            </>
          }
        />
        <OrderHero order={order} session={session.data} nextStep={nextStep} onChanged={reload} onReveal={sections.reveal} />
      </div>

      <div className="mt-[var(--bento-gap)] flex flex-col gap-[var(--bento-gap)]">
        {/* The pickup place instead of an address, the delivery time with "Change", a holiday order's note (handoff 225, 221, 216). */}
        <OrderFulfilmentPlan order={order} onChanged={reload} />
        {/* A parcel that came back undelivered: give its units back to the stock (handoff 354). */}
        <RestockReturnedCard order={order} onChanged={reload} />
        <OrderSections
          order={order}
          reload={reload}
          session={session.data}
          timelineKey={`${order.stage}:${order.updatedAt}:${refreshCount}`}
          gate={gate}
          sections={sections}
          ownsConfirm={nextStep?.ownsConfirm ?? false}
          confirmRef={confirmRef}
        />
      </div>

      {/* On a phone the next step is the bar above the dock: the same button, where the thumb is. No step, no bar. */}
      {nextStep?.action && (
        <PageActionBar>
          <NextStepButton action={nextStep.action} />
        </PageActionBar>
      )}

      {host}
    </div>
  );
}
