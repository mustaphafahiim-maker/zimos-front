"use client";

import { useStore } from "@/lib/StoreContext";
import { WhatsAppIcon } from "./Icons";

/**
 * The floating WhatsApp button (settings → general): a chat link pinned to the
 * end corner of every store page, opening wa.me with the merchant's number and
 * their opening message.
 *
 * Where it sits is the store wrapper's to say (globals.css,
 * `--sf-whatsapp-bottom`): a thumb's reach from the corner on a plain page,
 * and above whatever bar is pinned to the bottom of a phone — the product
 * page's order bar, the cart's, the checkout's, the theme's toolbar. The way
 * back up (BackToTop) finds it by `data-sf-whatsapp` and sits above it. It is
 * moved with a transform, so a bar sliding in lifts it smoothly.
 */
export function FloatingWhatsapp({ phone, message }: { phone: string; message: string }) {
  const { t } = useStore();
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const href = `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t.thankYou.whatsapp}
      data-sf-whatsapp=""
      className="fixed bottom-0 end-4 z-30 flex h-14 w-14 -translate-y-[var(--sf-whatsapp-bottom,6rem)] items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
    >
      <WhatsAppIcon size={28} />
    </a>
  );
}
