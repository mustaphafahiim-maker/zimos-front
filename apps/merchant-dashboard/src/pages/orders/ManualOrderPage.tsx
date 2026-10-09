import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { OrdersListPage } from "@/pages/orders/OrdersListPage";
import { CreateOrderSheet } from "./create/CreateOrderSheet";

/** The sheet's own way out takes about this long (--dur-move is 320ms, most of it in the first two thirds). */
const LEAVE_MS = 220;

/** The part of the browser's Navigation API this page reads: the entries of this tab and where we are in them. */
interface HistoryLike {
  currentEntry?: { index: number } | null;
  entries?: () => Array<{ url?: string | null }>;
}

function isOrdersList(path: string): boolean {
  return path.replace(/\/+$/, "") === "/orders";
}

/**
 * The list's own query. The list sends its filters and search along to
 * /orders/new, so the same list is under the sheet (OrdersListPage.tsx); what a
 * conversation added for the form — the customer's phone and name — is not the
 * list's and stays behind.
 */
function listSearch(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("phone");
  params.delete("name");
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}

/**
 * Did the merchant come here straight from the orders list? Then closing goes
 * one step back in history, and the list is exactly where it was — its
 * filters, its search, its scroll — with no second copy of it left in the
 * history. Known from the link's own state when it gives one (`state.from`: a
 * path, or a location), otherwise from the browser's list of this tab's
 * history where the browser has one. When it cannot be known the answer is
 * no, and closing puts the list in place of this entry instead.
 */
function cameFromOrdersList(state: unknown): boolean {
  const from = (state as { from?: unknown } | null)?.from;
  const fromPath = typeof from === "string" ? from : (from as { pathname?: unknown } | null | undefined)?.pathname;
  if (typeof fromPath === "string") return isOrdersList(fromPath.split(/[?#]/)[0] ?? "");
  try {
    const history = (window as unknown as { navigation?: HistoryLike }).navigation;
    const index = history?.currentEntry?.index;
    const entries = history?.entries?.();
    if (typeof index !== "number" || index < 1 || !entries) return false;
    const before = entries[index - 1]?.url;
    return typeof before === "string" && isOrdersList(new URL(before).pathname);
  } catch {
    return false;
  }
}

/**
 * SPEC §4.5 — `/orders/new`: the orders list with the create-order sheet open
 * over it (pages/orders/create). Closing the sheet returns to the list with
 * the query string it had: one step back when that is where the merchant came
 * from, otherwise `/orders` (and that query) in place of this entry.
 * `?phone=&name=` (the inbox's "create order") still start the form.
 */
export function ManualOrderPage() {
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(true);
  const leaving = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (leaving.current !== null) window.clearTimeout(leaving.current);
    },
    []
  );

  function close() {
    if (!open) return;
    setOpen(false);
    const back = cameFromOrdersList(location.state);
    const search = listSearch(location.search);
    const go = () => {
      leaving.current = null;
      if (back) navigate(-1);
      else navigate({ pathname: "/orders", search }, { replace: true });
    };
    // Let the sheet go down first; with less motion asked for there is nothing to wait for.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) go();
    else leaving.current = window.setTimeout(go, LEAVE_MS);
  }

  return (
    <>
      <OrdersListPage />
      {/* Keyed by the store: another store is another draft and another catalog. */}
      <CreateOrderSheet
        key={workspaceId}
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      />
    </>
  );
}
