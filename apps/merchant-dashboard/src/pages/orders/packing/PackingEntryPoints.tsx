import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { IconClipboard, IconPrint, IconScan } from "@/components/icons";
import { Button } from "@store-builder/ui";
import {
  ORDER_PACKED_TAG,
  ORDER_PACKING_SLIPS_MAX,
  ORDER_PICK_LIST_MAX,
  ordersMeta,
  type Order,
} from "@store-builder/api-client";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT } from "@/i18n/LocaleContext";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { PACKING_STRINGS } from "./packingStrings";
import { savePickListSelection } from "./packingStorage";
import { PackingSlipsDialog } from "./PackingSlipsDialog";
import { useFulfilmentTag } from "../components/fulfilmentTags";

/*
 * What picking and packing add to the screens that already exist (handoff
 * 226, 244, 249): each is mounted there with one line.
 */

const isPackedTag = (tag: string) => tag.trim().toLowerCase() === ORDER_PACKED_TAG;

/** Orders list → the bulk bar: "Pick list" and "Packing slips" for the ticked orders, beside the waybills. */
export function SelectionPacking({ orderIds }: { orderIds: string[] }) {
  const workspaceId = useWorkspaceId();
  const t = useT(PACKING_STRINGS);
  const toast = useToast();
  const navigate = useNavigate();
  const [slipsOpen, setSlipsOpen] = useState(false);

  function openPickList() {
    if (orderIds.length > ORDER_PICK_LIST_MAX) {
      toast.error(fmt(t.pickTooMany, { max: ORDER_PICK_LIST_MAX }));
      return;
    }
    // The page is its own route: the ids ride in the navigation and, for a reload, in the session.
    savePickListSelection(workspaceId, orderIds);
    navigate("/orders/pick-list", { state: { workspaceId, orderIds } });
  }

  function openSlips() {
    if (orderIds.length > ORDER_PACKING_SLIPS_MAX) {
      toast.error(fmt(t.slipsTooMany, { max: ORDER_PACKING_SLIPS_MAX }));
      return;
    }
    setSlipsOpen(true);
  }

  return (
    <>
      <Button variant="outline" size="sm" className="min-h-11 gap-1.5 rounded-full px-4" onClick={openPickList}>
        <IconClipboard className="size-4" aria-hidden />
        {t.pickList}
      </Button>
      <Button variant="outline" size="sm" className="min-h-11 gap-1.5 rounded-full px-4" onClick={openSlips}>
        <IconPrint className="size-4" aria-hidden />
        {t.packingSlips}
      </Button>
      <PackingSlipsDialog open={slipsOpen} orderIds={orderIds} onClose={() => setSlipsOpen(false)} />
    </>
  );
}

/** Orders list → the "Ready to ship" tab: one button to pick every order waiting to ship. Nothing on the other tabs. */
export function PickReadyToShip() {
  const t = useT(PACKING_STRINGS);
  const [params] = useSearchParams();
  if (params.get("stage") !== "ready_to_ship") return null;
  return (
    <div className="mb-3 flex justify-end">
      <Button asChild variant="outline" className="min-h-11 w-full gap-1.5 rounded-full px-5 sm:w-auto">
        <Link to="/orders/pick-list?ready=1">
          <IconClipboard className="size-4" aria-hidden />
          {t.pickReady}
        </Link>
      </Button>
    </div>
  );
}

/** A tag chip as the orders list draws them; the `packed` tag reads «اتغلّف» / "Packed". */
export function OrderTagBadge({ tag }: { tag: string }) {
  const t = useT(PACKING_STRINGS);
  // `holiday` and `pickup` read «إجازة» / «استلام من الفرع» (handoff 216, 225).
  const fulfilment = useFulfilmentTag(tag);
  const packed = isPackedTag(tag);
  if (fulfilment) return <StatusBadge value={tag} tone={fulfilment.tone} text={fulfilment.text} />;
  return <StatusBadge value={tag} tone={packed ? "success" : "info"} text={packed ? t.packed : tag} />;
}

/** Order page → among the status chips: «اتغلّف» once the order carries the `packed` tag. */
export function OrderPackedBadge({ order }: { order: Order }) {
  const t = useT(PACKING_STRINGS);
  if (!ordersMeta(order).tags.some(isPackedTag)) return null;
  return <StatusBadge value={ORDER_PACKED_TAG} tone="success" text={t.packed} />;
}

/** Order page → the tools row: "Print packing slip" and "Scan to pack". A cancelled order has neither. */
export function OrderPackingTools({ order }: { order: Order }) {
  const t = useT(PACKING_STRINGS);
  const [slipOpen, setSlipOpen] = useState(false);
  if (order.cancelledAt) return null;
  return (
    <>
      <Button variant="outline" size="sm" className="min-h-11 gap-1.5 rounded-full px-4" onClick={() => setSlipOpen(true)}>
        <IconPrint className="size-4" aria-hidden />
        {t.printPackingSlip}
      </Button>
      <Button asChild variant="outline" size="sm" className="min-h-11 gap-1.5 rounded-full px-4">
        <Link to={`/orders/${order.id}/pack`}>
          <IconScan className="size-4" aria-hidden />
          {t.scanToPack}
        </Link>
      </Button>
      <PackingSlipsDialog single open={slipOpen} orderIds={[order.id]} onClose={() => setSlipOpen(false)} />
    </>
  );
}
