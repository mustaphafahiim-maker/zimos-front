"use client";

import { useEffect, useState, type MouseEvent, type SVGProps } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { StoreLink, useStoreBasePath } from "@/components/StoreRoute";
import { CrossIcon } from "@/components/Icons";
import { btnPrimary, focusRing, iconBtn } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";
import { useWishlist, wishlistErrorMessage } from "@/lib/wishlist";

/** The heart, drawn like components/Icons.tsx (24px grid, 1.8 stroke); `filled` paints it in. */
export function HeartIcon({ size = 20, filled = false, ...rest }: SVGProps<SVGSVGElement> & { size?: number; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4 7.4 4c2 0 3.6 1.1 4.6 2.7C13 5.1 14.6 4 16.6 4c3.5 0 5.8 3.6 4.6 7.1-1.7 4.8-9.2 9.4-9.2 9.4Z" />
    </svg>
  );
}

/** The heart whose notice is on screen: one notice at a time, the newest. */
let dismissShown: (() => void) | null = null;

const LOOKS = {
  // Over a product card's photo: round, on a light disc so it reads on any picture.
  card: `z-10 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-paper-raised/95 shadow-sm backdrop-blur transition-colors hover:text-primary ${focusRing}`,
  // Beside the product page's title: the store's square icon button.
  page: iconBtn,
} as const;

/**
 * «ضيف للمفضلة» / «شيل من المفضلة» on product cards and
 * the product page. Filled when the product is on the list. A guest's tap
 * fills it in this browser and offers «سجّل دخول عشان تحفظ مفضلتك»; the hearts
 * join the account at sign-in (lib/wishlist mergeGuestWishlist). Renders
 * nothing while the store has no shopper accounts.
 */
export function WishlistHeart({
  productId,
  look = "card",
  className = "",
}: {
  productId: string;
  look?: keyof typeof LOOKS;
  className?: string;
}) {
  const { t } = useStore();
  const wishlist = useWishlist();
  const basePath = useStoreBasePath();
  const pathname = usePathname();
  const [notice, setNotice] = useState<{ tone: "guest" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), notice.tone === "guest" ? 9000 : 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!wishlist.enabled) return null;
  const on = wishlist.has(productId);
  const busy = wishlist.pending(productId);
  const label = on ? t.wishlist.remove : t.wishlist.add;

  function show(next: { tone: "guest" | "error"; text: string } | null) {
    dismissShown?.();
    dismissShown = next ? () => setNotice(null) : null;
    setNotice(next);
  }

  async function onClick(e: MouseEvent) {
    // Cards are one big link: this tap is the heart's alone.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const guest = !wishlist.signedIn;
    try {
      const added = await wishlist.toggle(productId);
      show(guest && added ? { tone: "guest", text: t.wishlist.signInToKeep } : null);
    } catch (err) {
      show({ tone: "error", text: wishlistErrorMessage(err, t) });
    }
  }

  // Back to this page after signing in (AccountShell reads `next`).
  const here = basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || "/" : pathname;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-busy={busy || undefined}
        title={label}
        className={`${LOOKS[look]} ${on ? "text-primary" : "text-ink"} ${className}`}
      >
        <HeartIcon filled={on} size={look === "page" ? 22 : 20} />
      </button>
      {notice &&
        createPortal(
          <div
            role={notice.tone === "error" ? "alert" : "status"}
            className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex items-start gap-3 rounded-2xl border border-line bg-paper-raised p-3 shadow-xl md:inset-x-auto md:bottom-6 md:end-6 md:w-96"
          >
            <span
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                notice.tone === "error" ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary"
              }`}
            >
              <HeartIcon filled size={20} />
            </span>
            <div className="min-w-0 flex-1 py-0.5">
              <p className="text-sm font-semibold text-ink">{notice.text}</p>
              {notice.tone === "guest" && (
                <>
                  <p className="mt-0.5 text-xs text-ink-soft">{t.wishlist.onThisDevice}</p>
                  <StoreLink
                    href={`/account?next=${encodeURIComponent(here)}`}
                    className={`${btnPrimary} mt-2.5 px-4 py-2`}
                    onClick={() => setNotice(null)}
                  >
                    {t.account.signIn}
                  </StoreLink>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label={t.wishlist.close}
              className={`-me-1 -mt-1 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-ink-soft hover:text-ink ${focusRing}`}
            >
              <CrossIcon size={18} />
            </button>
          </div>,
          document.querySelector<HTMLElement>(".brand-theme") ?? document.body
        )}
    </>
  );
}
