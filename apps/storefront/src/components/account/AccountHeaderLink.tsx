"use client";

import { usePathname } from "next/navigation";
import { StoreLink } from "@/components/StoreRoute";
import { iconBtn } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";
import type { ResolvedShellLink } from "@/lib/storeShell";
import { useShopperConfig, useShopperToken } from "@/lib/shopperSession";
import { UserIcon } from "./accountIcons";

/**
 * The header's way into the shopper's account (frontend-handoff 185), only
 * when the store offers accounts. In the bar from `sm` up: «تسجيل الدخول»
 * (the icon alone below `lg`) while signed out, the account icon once signed
 * in. On a phone the bar has no room left beside the store's name, so the
 * same link sits in the menu sheet instead (useAccountMenuLink). Nothing
 * renders until the store's setting is known, so a store without accounts
 * never flashes a link.
 */
export function useAccountMenuLink(): ResolvedShellLink | null {
  const { t, store } = useStore();
  const config = useShopperConfig();
  const token = useShopperToken(store?.id);
  if (config.status !== "ready" || !config.config.enabled) return null;
  return { key: "account", label: token ? t.account.myAccount : t.account.signIn, href: "/account", external: false };
}

export function AccountHeaderLink() {
  const { t, store } = useStore();
  const config = useShopperConfig();
  const token = useShopperToken(store?.id);
  const pathname = usePathname();
  if (config.status !== "ready" || !config.config.enabled) return null;

  const here = /\/account(\/|$)/.test(pathname);
  if (token) {
    return (
      <span className="hidden sm:contents">
        <StoreLink href="/account" aria-label={t.account.myAccount} aria-current={here ? "page" : undefined} className={iconBtn}>
          <UserIcon />
        </StoreLink>
      </span>
    );
  }
  return (
    <span className="hidden sm:contents">
      <StoreLink
        href="/account"
        aria-label={t.account.signIn}
        aria-current={here ? "page" : undefined}
        className={`${iconBtn} lg:w-auto lg:gap-2 lg:px-3`}
      >
        <UserIcon />
        <span className="hidden text-sm font-medium lg:inline">{t.account.signIn}</span>
      </StoreLink>
    </span>
  );
}
