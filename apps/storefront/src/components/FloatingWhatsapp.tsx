"use client";

import { useStore } from "@/lib/StoreContext";
import { WhatsAppIcon } from "./Icons";

/**
 * The floating WhatsApp button (settings → general): a chat link pinned to the
 * corner of every store page, opening wa.me with the merchant's number and
 * their opening message. Sits above the product page's sticky buy bar on phones.
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
      className="fixed bottom-24 end-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:bottom-6"
    >
      <WhatsAppIcon size={28} />
    </a>
  );
}
