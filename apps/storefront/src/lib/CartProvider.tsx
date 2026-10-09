"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import { ApiError, parseMoney, type Cart, type CartLine, type CustomizationInput } from "@store-builder/api-client";
import { getVisitorId } from "@/lib/visitorId";
// The storefront's client, whose cart calls also carry the signed-in shopper's token: the cart is priced with their price lists (handoff 205).
import { createCartApiClient } from "@/lib/shopperCart";
import { track } from "@/lib/track";
import { contentIdOf } from "@/lib/contentId";
import { takeAddSource, takenAddSourceId } from "./addSource";
import { rethrowCartLimit } from "./buyInfo";

/**
 * Guest cart identity lives in localStorage, keyed per workspace so two store
 * tabs (or two workspaces of the same merchant) never share a token — a token
 * from one workspace resolves to nothing in another anyway.
 */
const TOKEN_KEY_PREFIX = "zimos_cart_token_";

function tokenKeyFor(workspaceId: string) {
  return `${TOKEN_KEY_PREFIX}${workspaceId}`;
}

function readStoredToken(workspaceId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(tokenKeyFor(workspaceId));
  } catch {
    return null;
  }
}

function writeStoredToken(workspaceId: string, token: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(tokenKeyFor(workspaceId), token);
  } catch {
    /* private mode / storage disabled — cart just won't survive a reload */
  }
}

function clearStoredToken(workspaceId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(tokenKeyFor(workspaceId));
  } catch {
    /* ignore */
  }
}

/** How long a tapped quantity waits for another tap before it is sent: quick taps become one request per line. */
const QUANTITY_DEBOUNCE_MS = 300;
/** How long the next cart request waits for one that has not answered before it goes anyway. */
const QUEUE_PATIENCE_MS = 15_000;

/**
 * What a page already knows about the product it is adding — enough to draw
 * the line in the cart before the server answers.
 */
export interface LinePreview {
  name?: string;
  /** The variant's own picture, else the product's first. */
  image?: string | null;
  /** For the line's link to the product page. */
  slug?: string;
}

/** A line on its way to the cart: drawn as a placeholder until the server's cart answers. */
export interface PendingAdd {
  key: string;
  variantId: string;
  offerId?: string;
  quantity: number;
  /** It carries answers to custom fields, so it is a line of its own. */
  customized: boolean;
  preview: LinePreview | null;
}

/**
 * A cart line as the drawer and the cart page draw it this instant. The money
 * on it is always the server's (`line`); only the quantity runs ahead.
 */
export interface CartLineView {
  line: CartLine;
  /** The quantity just tapped (or with an add on its way), else the server's. */
  quantity: number;
  /** A change to this line has not been confirmed yet: its total is the last one the server sent. */
  syncing: boolean;
  /** Being removed. */
  removing: boolean;
}

export type CartProblemKind = "add" | "update" | "remove";

/** A cart change the server refused or never got; `message` is the server's own words when it gave any. */
export interface CartProblem {
  kind: CartProblemKind;
  message: string | null;
}

/**
 * A failed cart call in words fit for the shopper: the server's own, or the
 * purchase limit's (lib/buyInfo). null when there are none — a dropped
 * connection only has the browser's "Failed to fetch" — and the caller says
 * its own line.
 */
export function cartErrorMessage(err: unknown): string | null {
  if (err instanceof TypeError) return null;
  return err instanceof Error && err.message ? err.message : null;
}

// What the pages that added a line said about it, by variant, for this page
// life: a product outside the catalogue the cart reads (lib/useCatalog) keeps
// the name and photo it was added with instead of falling back to "item".
const previews = new Map<string, LinePreview>();

export function linePreviewOf(variantId: string): LinePreview | undefined {
  return previews.get(variantId);
}

/** Whether a line on its way lands on one the cart already holds (the server keeps one line per variant and offer). */
function landsOn(line: CartLine, add: PendingAdd): boolean {
  return (
    !add.customized &&
    !line.isOrderBump &&
    line.variantId === add.variantId &&
    (line.offerId ?? undefined) === add.offerId &&
    !(line.customizations && line.customizations.length > 0)
  );
}

/**
 * One cart request at a time, in the order they were asked for. Every cart
 * call answers with the whole cart, so two answers arriving out of order would
 * leave the page on the older one; in a line, the last answer is the cart.
 *
 * A request that never answers does not hold the line for ever: after
 * QUEUE_PATIENCE_MS the next one goes anyway, and once they have all settled
 * `onOverlap` reads the cart again, so the page still ends on the server's.
 */
function createCartQueue(onOverlap: () => void) {
  let tail: Promise<void> = Promise.resolve();
  let flying = 0;
  let overlapped = false;
  return function run<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(async () => {
      if (flying > 0) overlapped = true;
      flying += 1;
      try {
        return await task();
      } finally {
        flying -= 1;
      }
    });
    const settled = result.then(
      () => undefined,
      () => undefined
    );
    tail = Promise.race([settled, new Promise<void>((resolve) => setTimeout(resolve, QUEUE_PATIENCE_MS))]);
    void settled.then(() => {
      if (flying === 0 && overlapped) {
        overlapped = false;
        onOverlap();
      }
    });
    return result;
  };
}

/** A line's quantity as the shopper last tapped it, on its way to the server. */
interface QuantityIntent {
  desired: number;
  timer: ReturnType<typeof setTimeout> | null;
  sending: boolean;
  /** The line is being removed (or the cart was let go): nothing more is sent for it, and its failures are not news. */
  dropped: boolean;
}

export interface CartContextValue {
  /** The cart as the server last sent it. Prices and totals are only ever read from here. */
  cart: Cart | null;
  isLoading: boolean;
  /** Sum of every line's quantity, as shown (a tapped quantity and a line on its way count at once). */
  itemCount: number;
  /**
   * `customizations` answers the product's custom fields (photos by upload id).
   * `preview` is what the page knows about the product, for the line the cart
   * shows while the request is on its way.
   */
  addItem: (
    variantId: string,
    offerId?: string,
    quantity?: number,
    customizations?: CustomizationInput,
    preview?: LinePreview
  ) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  refreshCart: () => Promise<void>;
  /** Drop the local cart + token, e.g. right after a successful checkout. */
  clearCart: () => void;
  /**
   * The slide-over cart drawer (components/CartDrawer). Its open/closed state
   * lives here — next to the one cart it shows — so "add to cart" anywhere in
   * the store can open it without a second context. Nothing about the cart's
   * contents is duplicated: the drawer reads `cart` like every other consumer.
   */
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  /**
   * The cart as the drawer and the cart page draw it: the server's lines with
   * the quantities just tapped, and (`adding`) the lines still on their way
   * that have no line to land on yet.
   */
  lines: CartLineView[];
  adding: PendingAdd[];
  /** A change is waiting on the server: the totals on screen are the last ones it sent, shown dimmed. */
  isSyncing: boolean;
  /**
   * The quantity stepper's change: the number shows at once, quick taps are
   * sent as one request per line, and a refusal puts the old quantity back
   * and says why (`problem`).
   */
  changeQuantity: (itemId: string, quantity: number) => void;
  /** The remove button's: the line dims at once, the other lines stay usable, a refusal is said in `problem`. */
  removeLine: (itemId: string) => void;
  /** Send what is still waiting now — on the way to the checkout, which reads the server's cart. */
  flushCart: () => void;
  /** The last cart change that failed, until the next one or until the drawer closes. */
  problem: CartProblem | null;
  /** For the add buttons, which open the drawer before the server answers: the drawer then says why it failed. */
  reportProblem: (kind: CartProblemKind, message?: string | null) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart() must be used inside <CartProvider>");
  return ctx;
}

export function CartProvider({ children }: { children: ReactNode }) {
  // The provider lives in the root layout, so it renders on every route. It only
  // does anything on `/store/[workspaceId]/...`, where this param is filled in.
  const params = useParams();
  const workspaceId =
    typeof params.workspaceId === "string" ? params.workspaceId : undefined;

  const [client] = useState(() => createCartApiClient());
  const [cart, setCart] = useState<Cart | null>(null);
  // On a store route the cart is on its way from the first render (the server's
  // included), so a page never draws "empty" before it has asked.
  const [isLoading, setIsLoading] = useState(() => Boolean(workspaceId));
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [problem, setProblem] = useState<CartProblem | null>(null);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setProblem(null);
  }, []);
  const reportProblem = useCallback(
    (kind: CartProblemKind, message?: string | null) => setProblem({ kind, message: message ?? null }),
    []
  );

  // --- what runs ahead of the server ---------------------------------------
  const [pendingAdds, setPendingAdds] = useState<PendingAdd[]>([]);
  const [pendingQuantities, setPendingQuantities] = useState<Record<string, number>>({});
  const [removingIds, setRemovingIds] = useState<string[]>([]);
  const intents = useRef(new Map<string, QuantityIntent>());
  const leaving = useRef(new Set<string>());
  const addSeq = useRef(0);

  // The server's cart, for the callbacks that must read the latest one.
  const cartRef = useRef<Cart | null>(null);
  const applyCart = useCallback((next: Cart | null) => {
    cartRef.current = next;
    setCart(next);
  }, []);

  const refreshRef = useRef<() => void>(() => {});
  const [enqueue] = useState(() => createCartQueue(() => refreshRef.current()));

  // Resolve the cart once per workspace: reuse a saved token when it still
  // points at a live cart, otherwise create a fresh one and remember its token.
  // (Nothing to do off the storefront routes, where there's no workspace.)
  // It takes its place in the queue, so an "add to cart" tapped while it is
  // still on its way is answered after it, never overwritten by it.
  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;
    const saved = readStoredToken(workspaceId);

    async function resolveCart(id: string) {
      setIsLoading(true);
      try {
        if (saved) {
          try {
            const existing = await client.getCart(id, saved);
            if (!cancelled) applyCart(existing);
            return;
          } catch (err) {
            if (!(err instanceof ApiError) || err.status !== 404) throw err;
            // stale token — fall through and create a new cart
          }
        }
        const created = await client.getOrCreateCart(id, saved ?? undefined);
        if (cancelled) return;
        writeStoredToken(id, created.guestToken);
        applyCart(created);
      } catch {
        if (!cancelled) applyCart(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void enqueue(() => resolveCart(workspaceId));
    return () => {
      cancelled = true;
    };
  }, [workspaceId, client, enqueue, applyCart]);

  /** Guarantee a usable cart token before a mutation, creating the cart lazily. */
  const ensureToken = useCallback(async (): Promise<string> => {
    if (!workspaceId) throw new Error("No storefront workspace in scope");
    const saved = readStoredToken(workspaceId);
    if (saved) return saved;
    const created = await client.getOrCreateCart(workspaceId);
    writeStoredToken(workspaceId, created.guestToken);
    applyCart(created);
    return created.guestToken;
  }, [workspaceId, client, applyCart]);

  const addItem = useCallback(
    async (
      variantId: string,
      offerId?: string,
      quantity = 1,
      customizations?: CustomizationInput,
      preview?: LinePreview
    ) => {
      if (!workspaceId) return;
      // The line shows in the cart at once — with what the page knows about the
      // product — and gives way to the server's own line when it answers.
      if (preview) previews.set(variantId, { ...previews.get(variantId), ...preview });
      addSeq.current += 1;
      const key = `add-${addSeq.current}`;
      const pending: PendingAdd = {
        key,
        variantId,
        offerId,
        quantity,
        customized: Boolean(customizations),
        preview: previews.get(variantId) ?? null,
      };
      setProblem(null);
      setPendingAdds((list) => [...list, pending]);
      await enqueue(async () => {
        try {
          const token = await ensureToken();
          const next = await client.addCartItem(
            workspaceId,
            token,
            { variantId, offerId, quantity, ...(customizations ? { customizations } : {}) },
            // The visitor owns any photo among the answers.
            { visitorId: getVisitorId(workspaceId) }
          ).catch(rethrowCartLimit);
          applyCart(next);
          // AddToCart for the store's own analytics: the line just added, valued at
          // its unit price × the quantity added (not the whole line, which may have
          // held the variant already).
          try {
            const line = next.items.find((l) => l.variantId === variantId && (l.offerId ?? undefined) === offerId);
            const unit = line ? parseMoney(line.unitPriceSnapshot) : 0;
            track("AddToCart", {
              contentIds: [contentIdOf(line?.variant) ?? variantId],
              valueMinor: Math.round(unit * quantity),
              currency: next.currency,
              numItems: quantity,
              source: takeAddSource(),
              sourceId: takenAddSourceId(),
            });
          } catch {
            /* tracking never breaks the cart */
          }
        } finally {
          // The server's cart is in, or it refused: either way the placeholder
          // has done its job (dropped in the same pass the real line lands in).
          setPendingAdds((list) => list.filter((add) => add.key !== key));
        }
      });
    },
    [workspaceId, client, ensureToken, enqueue, applyCart]
  );

  const updateItem = useCallback(
    async (itemId: string, quantity: number) => {
      if (!workspaceId) return;
      const token = readStoredToken(workspaceId);
      if (!token) return;
      await enqueue(async () =>
        applyCart(await client.updateCartItem(workspaceId, token, itemId, quantity).catch(rethrowCartLimit))
      );
    },
    [workspaceId, client, enqueue, applyCart]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!workspaceId) return;
      const token = readStoredToken(workspaceId);
      if (!token) return;
      await enqueue(async () => applyCart(await client.removeCartItem(workspaceId, token, itemId)));
    },
    [workspaceId, client, enqueue, applyCart]
  );

  const refreshCart = useCallback(async () => {
    if (!workspaceId) return;
    await enqueue(async () => {
      const token = readStoredToken(workspaceId);
      if (!token) {
        applyCart(null);
        return;
      }
      try {
        applyCart(await client.getCart(workspaceId, token));
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          clearStoredToken(workspaceId);
          applyCart(null);
          return;
        }
        throw err;
      }
    });
  }, [workspaceId, client, enqueue, applyCart]);

  // What the queue calls after requests overlapped (createCartQueue).
  useEffect(() => {
    refreshRef.current = () => {
      void refreshCart().catch(() => {
        /* the cart on screen stands until the next change */
      });
    };
  }, [refreshCart]);

  // --- quantity: the number at once, one request per line -------------------

  const settleQuantity = useCallback((itemId: string) => {
    intents.current.delete(itemId);
    setPendingQuantities((prev) => {
      if (!(itemId in prev)) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }, []);

  const sendQuantity = useCallback(
    function send(itemId: string) {
      const intent = intents.current.get(itemId);
      // One request per line at a time: the one on its way picks the newer number up when it lands.
      if (!intent || intent.sending) return;
      const token = workspaceId ? readStoredToken(workspaceId) : null;
      const line = cartRef.current?.items.find((l) => l.id === itemId);
      if (!workspaceId || !token || !line || intent.dropped || line.quantity === intent.desired) {
        settleQuantity(itemId);
        return;
      }
      const sent = intent.desired;
      intent.sending = true;
      enqueue(async () =>
        applyCart(await client.updateCartItem(workspaceId, token, itemId, sent).catch(rethrowCartLimit))
      ).then(
        () => {
          intent.sending = false;
          // Tapped again since: that tap's own wait sends it.
          if (intent.timer) return;
          if (!intent.dropped && intent.desired !== sent) send(itemId);
          else settleQuantity(itemId);
        },
        (err: unknown) => {
          intent.sending = false;
          if (intent.timer) clearTimeout(intent.timer);
          intent.timer = null;
          // The server's cart never changed, so letting go of the tapped number
          // puts the old quantity back.
          settleQuantity(itemId);
          if (!intent.dropped) setProblem({ kind: "update", message: cartErrorMessage(err) });
        }
      );
    },
    [workspaceId, client, enqueue, applyCart, settleQuantity]
  );

  const changeQuantity = useCallback(
    (itemId: string, quantity: number) => {
      let intent = intents.current.get(itemId);
      if (!intent) {
        intent = { desired: quantity, timer: null, sending: false, dropped: false };
        intents.current.set(itemId, intent);
      }
      if (intent.dropped) return;
      const current = intent;
      current.desired = quantity;
      if (current.timer) clearTimeout(current.timer);
      current.timer = setTimeout(() => {
        current.timer = null;
        sendQuantity(itemId);
      }, QUANTITY_DEBOUNCE_MS);
      setProblem(null);
      setPendingQuantities((prev) => (prev[itemId] === quantity ? prev : { ...prev, [itemId]: quantity }));
    },
    [sendQuantity]
  );

  const flushCart = useCallback(() => {
    for (const [itemId, intent] of Array.from(intents.current)) {
      if (!intent.timer) continue;
      clearTimeout(intent.timer);
      intent.timer = null;
      sendQuantity(itemId);
    }
  }, [sendQuantity]);

  // A tab put away, or left: what was tapped goes out now rather than never.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushCart();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushCart);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushCart);
    };
  }, [flushCart]);

  const removeLine = useCallback(
    (itemId: string) => {
      if (!workspaceId || leaving.current.has(itemId)) return;
      const token = readStoredToken(workspaceId);
      if (!token) return;
      // A number still waiting to go out for this line no longer matters.
      const intent = intents.current.get(itemId);
      if (intent) {
        if (intent.timer) clearTimeout(intent.timer);
        intent.timer = null;
        intent.dropped = true;
        if (!intent.sending) settleQuantity(itemId);
      }
      leaving.current.add(itemId);
      setProblem(null);
      setRemovingIds((list) => [...list, itemId]);
      enqueue(async () => applyCart(await client.removeCartItem(workspaceId, token, itemId)))
        .catch((err: unknown) => setProblem({ kind: "remove", message: cartErrorMessage(err) }))
        .finally(() => {
          leaving.current.delete(itemId);
          setRemovingIds((list) => list.filter((id) => id !== itemId));
        });
    },
    [workspaceId, client, enqueue, applyCart, settleQuantity]
  );

  const clearCart = useCallback(() => {
    if (workspaceId) clearStoredToken(workspaceId);
    // Nothing tapped on the cart that is gone is sent after it.
    for (const intent of intents.current.values()) {
      if (intent.timer) clearTimeout(intent.timer);
      intent.timer = null;
      intent.dropped = true;
    }
    intents.current.clear();
    setPendingQuantities({});
    applyCart(null);
  }, [workspaceId, applyCart]);

  // The cart as it is drawn: the server's lines, the quantities running ahead
  // of it, and the lines on their way that have no line to land on yet.
  const { lines, adding } = useMemo(() => {
    const items = cart?.items ?? [];
    const landing = new Map<string, number>();
    const waiting: PendingAdd[] = [];
    for (const add of pendingAdds) {
      const target = items.find((line) => landsOn(line, add));
      if (target) landing.set(target.id, (landing.get(target.id) ?? 0) + add.quantity);
      else waiting.push(add);
    }
    const views: CartLineView[] = items.map((line) => {
      const tapped = pendingQuantities[line.id];
      const more = landing.get(line.id) ?? 0;
      return {
        line,
        // A tapped number is the one the shopper set from what was on screen, the landing add included.
        quantity: tapped ?? line.quantity + more,
        syncing: tapped !== undefined || more > 0,
        removing: removingIds.includes(line.id),
      };
    });
    return { lines: views, adding: waiting };
  }, [cart, pendingAdds, pendingQuantities, removingIds]);

  const itemCount = useMemo(
    () => lines.reduce((sum, view) => sum + view.quantity, 0) + adding.reduce((sum, add) => sum + add.quantity, 0),
    [lines, adding]
  );

  const isSyncing = pendingAdds.length > 0 || removingIds.length > 0 || Object.keys(pendingQuantities).length > 0;

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      isLoading,
      itemCount,
      addItem,
      updateItem,
      removeItem,
      refreshCart,
      clearCart,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
      lines,
      adding,
      isSyncing,
      changeQuantity,
      removeLine,
      flushCart,
      problem,
      reportProblem,
    }),
    [
      cart,
      isLoading,
      itemCount,
      addItem,
      updateItem,
      removeItem,
      refreshCart,
      clearCart,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
      lines,
      adding,
      isSyncing,
      changeQuantity,
      removeLine,
      flushCart,
      problem,
      reportProblem,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
