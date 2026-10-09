import { Fragment } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@store-builder/ui";
import type { Customer } from "@store-builder/api-client";
import { IconChat, IconCopy, IconMoreActions, IconUnlock, IconUserBlocked, type IconComponent } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useViewNavigate } from "@/lib/viewTransition";
import { copyText } from "./sections";

const STRINGS = {
  en: {
    tools: "Customer tools",
    copyPhone: "Copy the number",
    copiedPhone: "The customer's number is copied",
    copyFailed: "We couldn't copy that. Try again.",
    openChat: "Open their WhatsApp chat in the inbox",
    block: "Block this customer…",
    unblock: "Remove the block…",
  },
  ar: {
    tools: "أدوات العميل",
    copyPhone: "انسخ الرقم",
    copiedPhone: "رقم العميل اتنسخ",
    copyFailed: "معرفناش ننسخ. جرّب تاني.",
    openChat: "افتح محادثة الواتساب في الرسائل",
    block: "احظر العميل ده…",
    unblock: "شيل الحظر…",
  },
} satisfies Messages;

interface Row {
  id: string;
  label: string;
  icon: IconComponent;
  onSelect: () => void;
  destructive?: boolean;
}

// The row of the list kit's menus: 36px under a mouse, 44px under a thumb.
const ITEM = "min-h-9 cursor-pointer items-center gap-3 rounded-[0.625rem] px-2.5 py-2 pointer-coarse:min-h-11 pointer-coarse:py-3";

/**
 * «…» in the customer page's header: what is done to a customer rarely, one
 * tap away instead of on the page — copy the number, their WhatsApp thread in
 * the inbox, and blocking them (or taking the block off), last and apart,
 * with the confirmation the page's «الحظر» card always asked.
 */
export function CustomerMoreMenu({
  customer,
  phone,
  conversationId,
  onBlock,
  onUnblock,
}: {
  customer: Customer;
  /** The whole number, or null when it is hidden from this role or erased. */
  phone: string | null;
  /** The customer's WhatsApp thread in the inbox, when the page knows of one. */
  conversationId: string | null;
  onBlock: () => void;
  onUnblock: () => void;
}) {
  const t = useT(STRINGS);
  const { dir } = useLocale();
  const toast = useToast();
  const navigate = useViewNavigate();
  // Consts, so the closures below keep what the checks found.
  const number = phone;
  const chat = conversationId;

  const groups: Row[][] = [
    [
      ...(number
        ? [
            {
              id: "copy",
              label: t.copyPhone,
              icon: IconCopy,
              onSelect: () => {
                void copyText(number).then((done) => (done ? toast.success(t.copiedPhone) : toast.error(t.copyFailed)));
              },
            },
          ]
        : []),
      ...(chat
        ? [{ id: "chat", label: t.openChat, icon: IconChat, onSelect: () => navigate(`/inbox?conversation=${chat}`) }]
        : []),
    ],
    [
      customer.isBlacklisted
        ? { id: "unblock", label: t.unblock, icon: IconUnlock, onSelect: onUnblock }
        : { id: "block", label: t.block, icon: IconUserBlocked, onSelect: onBlock, destructive: true },
    ],
  ];
  const shown = groups.filter((group) => group.length > 0);

  return (
    <DirectionProvider direction={dir}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t.tools}
              title={t.tools}
              className="zimos-customer-tool inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-paper-raised text-ink-soft ring-1 ring-line transition-[color,background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-expanded:text-ink motion-safe:active:scale-[0.97] pointer-fine:size-10 motion-reduce:transition-none"
            />
          }
        >
          <IconMoreActions className="size-5" weight="bold" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-auto max-w-[min(21rem,calc(100vw_-_1.5rem))] min-w-60 rounded-[1.125rem] p-1.5">
          {shown.map((group, index) => (
            <Fragment key={group[0].id}>
              {index > 0 && <DropdownMenuSeparator className="mx-1.5" />}
              {group.map((row) => {
                const RowIcon = row.icon;
                return (
                  <DropdownMenuItem key={row.id} variant={row.destructive ? "destructive" : "default"} onClick={row.onSelect} className={ITEM}>
                    <RowIcon className="size-[18px]" aria-hidden />
                    <span className="min-w-0 flex-1">{row.label}</span>
                  </DropdownMenuItem>
                );
              })}
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </DirectionProvider>
  );
}
