import { useEffect, useState } from "react";
import { orderListExtrasOf, type Order } from "@store-builder/api-client";
import { Card, cn } from "@store-builder/ui";
import { ContactActions } from "@/components/ContactActions";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { CopyButton } from "@/components/CopyButton";
import { IconCopy, IconOrders, IconPhone, IconSparkle, IconWhatsApp } from "@/components/icons";
import { useQuickLookRow } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { storeUrl } from "@/lib/storeAddress";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useViewNavigate } from "@/lib/viewTransition";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import { OrderLineThumb } from "@/pages/orders/components/OrderLineThumb";
import { STAGE_TONE, useOrderLabels } from "@/pages/orders/orderLabels";
import { HomeSection, HomeSectionError, HomeSkeleton } from "./HomeSection";
import { OrderQuickLook, dialablePhone, orderPlace, orderTelHref } from "./OrderQuickLook";
import { useNow, type HomeSectionProps } from "./homeTime";

const STRINGS = {
  en: {
    title: "Latest orders",
    viewAll: "All orders",
    loadError: "We couldn't load your latest orders.",
    empty: "No orders yet. The first one shows up here the moment it arrives.",
    shareStore: "Share your store link",
    newCustomer: "New customer",
    noName: "Customer without a name",
    moreItems: "+{n}",
    menuLabel: "Actions for order {number}",
    menuOpen: "Open the order",
    menuCall: "Call",
    menuWhatsapp: "WhatsApp",
    menuCopyPhone: "Copy the number",
    menuCopyOrder: "Copy the order number",
    copiedPhone: "The customer's number is copied",
    copiedOrder: "The order number is copied",
    copyFailed: "We couldn't copy that. Try again.",
  },
  ar: {
    title: "آخر الأوردرات",
    viewAll: "كل الأوردرات",
    loadError: "معرفناش نجيب آخر الأوردرات.",
    empty: "لسه مفيش أوردرات. أول ما ييجي أوردر هيظهر هنا على طول.",
    shareStore: "شارك لينك متجرك",
    newCustomer: "عميل جديد",
    noName: "عميل من غير اسم",
    moreItems: "+{n}",
    menuLabel: "إجراءات الأوردر {number}",
    menuOpen: "افتح الأوردر",
    menuCall: "اتصل",
    menuWhatsapp: "واتساب",
    menuCopyPhone: "انسخ الرقم",
    menuCopyOrder: "انسخ رقم الأوردر",
    copiedPhone: "رقم العميل اتنسخ",
    copiedOrder: "رقم الأوردر اتنسخ",
    copyFailed: "معرفناش ننسخ. جرّب تاني.",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

/** How many of the newest orders the home shows. */
const LIMIT = 5;
/** Coming back to the tab re-reads the list, but not more often than this. */
const REFRESH_GAP_MS = 15_000;

/** Puts `value` on the clipboard; false when the browser would not. */
async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // No permission, or an origin without the clipboard API: the old selection way still works there.
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      field.remove();
    }
  }
}

/**
 * «آخر الأوردرات»: the five newest orders, each one tap from its preview, its
 * page, a call or a WhatsApp message. The list is the same for every range of
 * the home, is kept between visits and is read again when the tab comes back.
 * A role that cannot see orders (403) sees no section at all.
 */
export function LatestOrders(props: HomeSectionProps) {
  // One instance per store: after a switch nothing of the last store is on screen, not even for a frame.
  return <LatestOrdersList key={props.workspaceId} {...props} />;
}

function LatestOrdersList({ workspaceId }: HomeSectionProps) {
  const t = useT(STRINGS);
  const common = useCommon();
  const { currentWorkspace } = useWorkspace();
  const now = useNow();
  const cached = useCachedAsync<Order[]>(
    "home:orders:" + workspaceId,
    () => apiClient.listOrders(workspaceId, { limit: LIMIT }).then((page) => page.orders),
    [workspaceId]
  );
  const { error, refresh } = cached;
  // Nothing to show while the first answer (or a retry after a failure) is on its way: hold the space.
  const data = cached.loading ? null : cached.data;
  // The order being looked at. It stays here while the panel closes, so the panel does not empty on its way out.
  const [peek, setPeek] = useState<{ order: Order; open: boolean } | null>(null);

  useEffect(() => {
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < REFRESH_GAP_MS) return;
      last = Date.now();
      void refresh({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  // Not for this role: no section, rather than a false "no orders yet".
  if (isPermissionError(error)) return null;

  if (!data) {
    return (
      <HomeSection title={t.title}>
        {error ? (
          <HomeSectionError message={t.loadError} retryLabel={common.retry} onRetry={() => void refresh()} />
        ) : (
          <HomeSkeleton className="h-[21.5rem]" />
        )}
      </HomeSection>
    );
  }

  if (data.length === 0) {
    const link = currentWorkspace?.slug ? storeUrl(currentWorkspace.slug) : null;
    return (
      <HomeSection title={t.title}>
        <Card className="gap-0 p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="min-w-0 flex-1 basis-56 text-sm leading-6 text-ink-soft">{t.empty}</p>
            {link && (
              <CopyButton
                value={link}
                label={t.shareStore}
                className="min-h-11 shrink-0 px-4 text-[13px] font-semibold text-primary ring-1 ring-line-strong ring-inset"
              />
            )}
          </div>
        </Card>
      </HomeSection>
    );
  }

  // The preview follows the list: a refresh that changes the order shows in the open panel too.
  const peeked = peek ? (data.find((order) => order.id === peek.order.id) ?? peek.order) : null;

  return (
    <HomeSection title={t.title} link={{ to: "/orders", label: t.viewAll }}>
      <Card data-slot="home-orders" className="@container/orders gap-0 p-2">
        <ul className="space-y-0.5">
          {data.map((order) => (
            <OrderRow key={order.id} order={order} now={now} t={t} onPeek={(next) => setPeek({ order: next, open: true })} />
          ))}
        </ul>
      </Card>
      <OrderQuickLook
        order={peeked}
        open={Boolean(peek?.open)}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
      />
    </HomeSection>
  );
}

/**
 * One order: its first product, who ordered and for how much, then where it
 * stands, where it goes and how long ago. The whole row opens the preview
 * (click, or Space on the keyboard; Enter opens the order's page); the call
 * and WhatsApp buttons are their own stops, laid over the row, not inside it.
 * Right-click, a long press or Shift+F10 gives the same actions as a menu.
 */
function OrderRow({ order, now, t, onPeek }: { order: Order; now: number; t: Strings; onPeek: (order: Order) => void }) {
  const labels = useOrderLabels();
  const toast = useToast();
  const navigate = useViewNavigate();
  const peekProps = useQuickLookRow(() => onPeek(order));

  const to = `/orders/${order.id}`;
  const extras = orderListExtrasOf(order);
  const name = order.contactSnapshot?.fullName?.trim() || t.noName;
  // A masked number (010****665) is not one to dial or copy: every action on it needs the whole number.
  const phone = dialablePhone(order.contactSnapshot?.phone);
  const whatsapp = phone ? toWhatsAppNumber(phone) : null;
  const place = orderPlace(order);
  const items = order.items ?? [];
  const first = items[0];

  const copy = async (value: string, done: string) => {
    if (await copyText(value)) toast.success(done);
    else toast.error(t.copyFailed);
  };

  const menu: ContextMenuItem[] = [{ id: "open", label: t.menuOpen, icon: IconOrders, onSelect: () => navigate(to) }];
  if (phone) {
    menu.push({
      id: "call",
      label: t.menuCall,
      icon: IconPhone,
      separatorBefore: true,
      onSelect: () => {
        window.location.href = orderTelHref(phone);
      },
    });
  }
  if (whatsapp) {
    menu.push({
      id: "whatsapp",
      label: t.menuWhatsapp,
      icon: IconWhatsApp,
      onSelect: () => {
        window.open(`https://wa.me/${whatsapp}`, "_blank", "noopener,noreferrer");
      },
    });
  }
  if (phone) {
    menu.push({
      id: "copy-phone",
      label: t.menuCopyPhone,
      icon: IconCopy,
      separatorBefore: true,
      onSelect: () => void copy(phone, t.copiedPhone),
    });
  }
  menu.push({
    id: "copy-order",
    label: t.menuCopyOrder,
    icon: IconCopy,
    separatorBefore: !phone,
    onSelect: () => void copy(order.orderNumber, t.copiedOrder),
  });

  return (
    <ContextMenu items={menu} label={fmt(t.menuLabel, { number: order.orderNumber })}>
      <li
        data-slot="home-order-row"
        className="relative flex min-h-16 items-center gap-2.5 rounded-2xl px-2 py-2 transition-colors duration-(--dur-fade) ease-(--ease-out) hover:bg-paper-sunken motion-reduce:transition-none"
      >
        <span aria-hidden className="relative flex size-9 shrink-0">
          {first ? (
            <OrderLineThumb item={first} className="size-9 rounded-xl" />
          ) : (
            <span
              data-slot="home-chip"
              data-tone="primary"
              className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary-dark"
            >
              <IconOrders className="size-[18px]" weight="duotone" />
            </span>
          )}
          {items.length > 1 && (
            <span
              data-slot="home-order-more"
              className="absolute -end-1.5 -bottom-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink px-1 text-[11px] leading-none font-semibold text-paper-raised tabular-nums ring-2 ring-paper-raised"
            >
              {fmt(t.moreItems, { n: items.length - 1 })}
            </span>
          )}
        </span>

        {/* The row's own button: its ::after covers the whole row, so the thumbnail and the gaps open the preview too. */}
        <div
          role="button"
          aria-haspopup="dialog"
          {...peekProps}
          onKeyDown={(e) => {
            // Space peeks (useQuickLookRow); Enter, on the row itself, opens the order's page.
            peekProps.onKeyDown(e);
            if (e.key !== "Enter" || e.target !== e.currentTarget || e.defaultPrevented || e.repeat) return;
            e.preventDefault();
            navigate(to);
          }}
          onClick={(e) => {
            // Ctrl / ⌘ + click is "in a new tab", as on a link.
            if (e.metaKey || e.ctrlKey) {
              window.open(to, "_blank", "noopener");
              return;
            }
            onPeek(order);
          }}
          className="min-w-0 flex-1 cursor-pointer outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-primary"
        >
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 truncate text-[15px] leading-6 font-medium text-ink">
              <bdi>{name}</bdi>
            </span>
            {extras.isNewCustomer && (
              <>
                {/* Where the row is narrow (a phone) the words give way to a mark; the preview says it in full. */}
                <IconSparkle
                  role="img"
                  aria-label={t.newCustomer}
                  weight="fill"
                  className="size-3.5 shrink-0 self-center text-primary @md/orders:hidden"
                />
                <StatusBadge
                  value="new_customer"
                  tone="info"
                  text={t.newCustomer}
                  className="hidden shrink-0 self-center @md/orders:inline-flex"
                />
              </>
            )}
            <span className="ms-auto shrink-0 ps-1 text-sm leading-6 font-semibold whitespace-nowrap text-ink tabular-nums">
              <bdi>{formatMoney(order.totalAmount, order.currency)}</bdi>
            </span>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs leading-5 text-ink-soft">
            {order.stage && (
              <StatusBadge
                value={order.stage}
                tone={STAGE_TONE[order.stage]}
                text={labels.stage(order.stage)}
                className="shrink-0"
              />
            )}
            {/* Beside two 44px buttons a phone has no room for the place: it is in the preview, one tap away. */}
            {place && (
              <>
                <span className={cn("min-w-0 shrink-[99] truncate", phone && "hidden @md/orders:block")}>{place}</span>
                <span aria-hidden className={cn("shrink-0", phone && "hidden @md/orders:inline")}>
                  ·
                </span>
              </>
            )}
            <time dateTime={order.createdAt} className="min-w-0 truncate">
              {formatRelativeTime(order.createdAt, now)}
            </time>
          </div>
        </div>

        {phone && (
          <div className="relative z-10 shrink-0">
            <ContactActions phone={phone} name={order.contactSnapshot?.fullName} variant="icon" />
          </div>
        )}
      </li>
    </ContextMenu>
  );
}
