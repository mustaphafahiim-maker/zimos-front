"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { shopperMe, type ShopperAddress, type ShopperMe, type ShopperSession } from "@store-builder/api-client";
import { StoreLink, useStoreBasePath } from "@/components/StoreRoute";
import { btnGhost, btnPrimary, btnSecondary, card, container, skeleton } from "@/components/ui";
import { storeHref } from "@/lib/storeHref";
import { useStore } from "@/lib/StoreContext";
import { isAccountsOffError, isShopperSignedOutError, useShopperApi, useShopperConfig, type ShopperApi } from "@/lib/shopperSession";
import { ShopperSignIn } from "./ShopperSignIn";
import { UserIcon } from "./accountIcons";

/**
 * The frame of every account page (`/account`, `/account/addresses`,
 * `/account/profile`, `/account/orders/:id`): the store's setting first
 * (off → a short note and the tracking page instead), then the sign-in when
 * there is no token, then the shopper's name, the three tabs and the page.
 * The signed-in shopper (GET /me) is shared with the pages below through
 * useAccount().
 */

interface AccountContextValue {
  api: ShopperApi;
  me: ShopperMe;
  setMe: (next: ShopperMe) => void;
  setAddresses: (addresses: ShopperAddress[]) => void;
}

/** The store's button recipes in the danger colour, for deleting and signing out everywhere. */
export const btnDanger = btnPrimary.replace("bg-primary ", "bg-danger ").replace("hover:bg-primary/90", "hover:bg-danger/90");
export const btnGhostDanger = btnGhost.replace("text-primary", "text-danger").replace("hover:bg-primary-soft", "hover:bg-danger-soft");

const AccountContext = createContext<AccountContextValue | null>(null);

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount() must be used inside <AccountShell>");
  return ctx;
}

/** Where the sign-in goes back to (`?next=/checkout`): a path of this store only. */
function nextPath(): string | null {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && /^\/(?!\/)[\w\-/]*$/.test(next) ? next : null;
}

export function Notice({
  title,
  body,
  action,
  tone = "neutral",
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={`${card} flex flex-col items-center px-5 py-10 text-center`}>
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone === "danger" ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary"}`}
      >
        <UserIcon size={24} />
      </span>
      <p className="mt-4 text-base font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className={`${skeleton} h-8 w-48`} />
      <div className={`${skeleton} h-11 w-full max-w-md`} />
      <div className={`${skeleton} h-28 w-full`} />
      <div className={`${skeleton} h-28 w-full`} />
    </div>
  );
}

const TABS = [
  { key: "orders", href: "/account" },
  { key: "addresses", href: "/account/addresses" },
  { key: "profile", href: "/account/profile" },
] as const;

export function AccountShell({ children }: { children: ReactNode }) {
  const { t } = useStore();
  const a = t.account;
  const config = useShopperConfig();
  const api = useShopperApi();
  const router = useRouter();
  const basePath = useStoreBasePath();
  const pathname = usePathname();
  const [me, setMeState] = useState<{ token: string; value: ShopperMe } | null>(null);
  const [failure, setFailure] = useState<{ token: string; error: unknown } | null>(null);
  const [nonce, setNonce] = useState(0);

  const token = api.token;
  const enabled = config.status === "ready" && config.config.enabled;
  const current = me && me.token === token ? me.value : null;
  const failed = failure && failure.token === token ? failure.error : null;

  useEffect(() => {
    if (!enabled || !token || (me && me.token === token)) return;
    let cancelled = false;
    api
      .call((client, storeId, tk) => shopperMe(client, storeId, tk))
      .then((value) => {
        if (!cancelled) setMeState({ token, value });
      })
      .catch((error) => {
        // A 401 has already dropped the token: the sign-in shows by itself.
        if (!cancelled && !isShopperSignedOutError(error)) setFailure({ token, error });
      });
    return () => {
      cancelled = true;
    };
    // `me` is read only to skip a reload of the same token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, token, api, nonce]);

  const setMe = useCallback((value: ShopperMe) => {
    if (token) setMeState({ token, value });
  }, [token]);
  const setAddresses = useCallback(
    (addresses: ShopperAddress[]) => setMeState((prev) => (prev ? { ...prev, value: { ...prev.value, addresses } } : prev)),
    []
  );

  function signedIn(session: ShopperSession) {
    setMeState({ token: session.token, value: { customer: session.customer, addresses: session.addresses } });
    const next = nextPath();
    if (next) router.push(storeHref(basePath, next));
  }

  let body: ReactNode;
  if (config.status === "loading") {
    body = <ShellSkeleton />;
  } else if (config.status === "error") {
    body = (
      <Notice
        tone="danger"
        title={a.loadFailed}
        action={
          <button type="button" onClick={config.reload} className={btnPrimary}>
            {a.retry}
          </button>
        }
      />
    );
  } else if (!config.config.enabled) {
    body = (
      <Notice
        title={a.off}
        body={a.offHint}
        action={
          <StoreLink href="/track" className={btnPrimary}>
            {a.trackInstead}
          </StoreLink>
        }
      />
    );
  } else if (!token) {
    body = <ShopperSignIn channels={config.config.channels} onSignedIn={signedIn} />;
  } else if (failed) {
    body = isAccountsOffError(failed) ? (
      <Notice title={a.off} body={a.offHint} />
    ) : (
      <Notice
        tone="danger"
        title={a.loadFailed}
        action={
          <button
            type="button"
            onClick={() => {
              setFailure(null);
              setNonce((n) => n + 1);
            }}
            className={btnPrimary}
          >
            {a.retry}
          </button>
        }
      />
    );
  } else if (!current) {
    body = <ShellSkeleton />;
  } else {
    const active = pathname.endsWith("/account/addresses")
      ? "addresses"
      : pathname.endsWith("/account/profile")
        ? "profile"
        : "orders";
    const name = current.customer.fullName?.trim();
    body = (
      <AccountContext.Provider value={{ api, me: current, setMe, setAddresses }}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-ink-soft">{a.title}</p>
            <h1 className="mt-0.5 truncate font-display text-2xl font-bold text-ink sm:text-3xl">
              {name ? a.hello(name) : a.myAccount}
            </h1>
          </div>
        </div>
        <nav aria-label={a.tabs} className="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex w-max gap-2">
            {TABS.map((tab) => {
              const selected = tab.key === active;
              return (
                <li key={tab.key}>
                  <StoreLink
                    href={tab.href}
                    aria-current={selected ? "page" : undefined}
                    className={`${selected ? btnPrimary : btnSecondary} whitespace-nowrap`}
                  >
                    {a[tab.key]}
                  </StoreLink>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-6">{children}</div>
      </AccountContext.Provider>
    );
  }

  return <main className={`${container} flex-1 py-8 sm:py-10`}>{body}</main>;
}
