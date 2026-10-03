"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  affiliatePortalOverview,
  affiliatePortalRequestCode,
  affiliatePortalVerify,
  type AffiliatePortal as Portal,
  type CommissionStatus,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStore } from "@/lib/StoreContext";
import { useStoreBasePath } from "./StoreRoute";
import { storeHref } from "@/lib/storeHref";
import { btnPrimary, btnSecondary, card, container, input, label } from "./ui";

const STRINGS = {
  en: {
    title: "Affiliate portal",
    intro: "Sign in with the phone number the store registered for you.",
    phone: "Phone number",
    sendCode: "Send me a code",
    sending: "Sending…",
    codeSent: "If this number is registered, a code is on its way by SMS.",
    code: "Code",
    signIn: "Sign in",
    signingIn: "Signing in…",
    changePhone: "Use another number",
    invalidPhone: "Enter a valid phone number.",
    invalidCode: "That code is not valid.",
    expiredCode: "That code has expired. Ask for a new one.",
    tooMany: "Too many attempts. Try again in a few minutes.",
    error: "Something went wrong. Please try again.",
    hello: (name: string) => `Hello, ${name}`,
    rate: "Your commission",
    perOrder: "per order",
    pending: "Waiting for delivery",
    approved: "Ready to be paid",
    paid: "Paid",
    links: "Your links",
    storeLink: "The whole store",
    copy: "Copy",
    copied: "Copied",
    orders: "Your orders",
    noOrders: "No orders through your links yet.",
    payouts: "Payments you received",
    signOut: "Sign out",
    status: { pending: "Waiting for delivery", approved: "Approved", paid: "Paid", void: "Cancelled" } as Record<CommissionStatus, string>,
  },
  ar: {
    title: "بوابة المسوّقين",
    intro: "ادخل برقم الموبايل اللي المتجر سجّله ليك.",
    phone: "رقم الموبايل",
    sendCode: "ابعتلي كود",
    sending: "جارٍ الإرسال…",
    codeSent: "لو الرقم ده مسجّل، هيوصلك كود في رسالة.",
    code: "الكود",
    signIn: "دخول",
    signingIn: "جارٍ الدخول…",
    changePhone: "استخدم رقم تاني",
    invalidPhone: "اكتب رقم موبايل صحيح.",
    invalidCode: "الكود ده مش صحيح.",
    expiredCode: "الكود انتهت صلاحيته. اطلب كود جديد.",
    tooMany: "محاولات كتير. جرّب تاني بعد شوية.",
    error: "حصلت مشكلة. حاول تاني.",
    hello: (name: string) => `أهلاً ${name}`,
    rate: "عمولتك",
    perOrder: "لكل طلب",
    pending: "في انتظار التسليم",
    approved: "مستحق الدفع",
    paid: "اتدفع",
    links: "روابطك",
    storeLink: "المتجر كله",
    copy: "نسخ",
    copied: "تم النسخ",
    orders: "طلباتك",
    noOrders: "لسه مفيش طلبات من روابطك.",
    payouts: "المبالغ اللي استلمتها",
    signOut: "خروج",
    status: { pending: "في انتظار التسليم", approved: "مستحقة", paid: "مدفوعة", void: "ملغاة" } as Record<CommissionStatus, string>,
  },
};

const tokenKey = (workspaceId: string) => `zimos.affiliate.${workspaceId}`;

/**
 * The marketer's portal (SPEC §20.3): phone + SMS code, then their links,
 * their orders (a number, a date and the commission — never the customer) and
 * their balance. The portal token lives in sessionStorage for this tab only.
 */
export function AffiliatePortal({ workspaceId }: { workspaceId: string }) {
  const { intlLocale, money } = useStore();
  const t = intlLocale.startsWith("ar") ? STRINGS.ar : STRINGS.en;
  const basePath = useStoreBasePath();
  const [token, setToken] = useState<string | null>(null);
  const [portal, setPortal] = useState<Portal | null>(null);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    try {
      setToken(sessionStorage.getItem(tokenKey(workspaceId)));
    } catch {
      /* storage blocked — sign in each visit */
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    affiliatePortalOverview(createStorefrontApiClient(), workspaceId, token)
      .then((data) => {
        if (!cancelled) setPortal(data);
      })
      .catch(() => {
        if (!cancelled) signOut();
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, workspaceId]);

  function signOut() {
    setToken(null);
    setPortal(null);
    setStep("phone");
    setCode("");
    try {
      sessionStorage.removeItem(tokenKey(workspaceId));
    } catch {
      /* nothing stored */
    }
  }

  function problem(err: unknown): string {
    const errorCode = err instanceof ApiError ? err.code : undefined;
    if (errorCode === "INVALID_PHONE") return t.invalidPhone;
    if (errorCode === "INVALID_CODE") return t.invalidCode;
    if (errorCode === "EXPIRED") return t.expiredCode;
    if (errorCode === "TOO_MANY_ATTEMPTS" || errorCode === "OTP_RATE_LIMITED" || errorCode === "RATE_LIMITED") return t.tooMany;
    return t.error;
  }

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await affiliatePortalRequestCode(createStorefrontApiClient(), workspaceId, phone.trim());
      setStep("code");
    } catch (err) {
      setError(problem(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await affiliatePortalVerify(createStorefrontApiClient(), workspaceId, phone.trim(), code.trim());
      try {
        sessionStorage.setItem(tokenKey(workspaceId), result.token);
      } catch {
        /* this visit only */
      }
      setToken(result.token);
    } catch (err) {
      setError(problem(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked — the link is on screen */
    }
  }

  if (!token || !portal) {
    return (
      <div className={`${container} py-10`}>
        <div className={`${card} mx-auto max-w-md p-6`}>
          <h1 className="text-xl font-semibold text-ink">{t.title}</h1>
          <p className="mt-1 text-sm text-ink-soft">{step === "phone" ? t.intro : t.codeSent}</p>
          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          {step === "phone" ? (
            <form onSubmit={requestCode} className="mt-4 space-y-4">
              <div>
                <label className={label} htmlFor="affiliate-phone">
                  {t.phone}
                </label>
                <input
                  id="affiliate-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  required
                  maxLength={32}
                  className={input}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
                {busy ? t.sending : t.sendCode}
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="mt-4 space-y-4">
              <div>
                <label className={label} htmlFor="affiliate-code">
                  {t.code}
                </label>
                <input
                  id="affiliate-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  dir="ltr"
                  required
                  maxLength={10}
                  className={input}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
                {busy ? t.signingIn : t.signIn}
              </button>
              <button type="button" className="w-full cursor-pointer text-sm text-primary" onClick={() => setStep("phone")}>
                {t.changePhone}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = (path: string) => `${origin}${storeHref(basePath, path)}${path.includes("?") ? "&" : "?"}ref=${encodeURIComponent(portal.affiliate.code)}`;
  const links = [{ name: t.storeLink, url: link("/") }, ...portal.products.map((p) => ({ name: p.name, url: link(`/products/${p.slug}`) }))];
  const rate =
    portal.affiliate.commissionType === "percent"
      ? `${portal.affiliate.commissionValue / 100}%`
      : `${money(portal.affiliate.commissionValue, portal.currency)} ${t.perOrder}`;
  const when = new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" });

  return (
    <div className={`${container} space-y-6 py-10`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t.hello(portal.affiliate.name)}</h1>
          <p className="text-sm text-ink-soft">
            {t.rate}: {rate}
          </p>
        </div>
        <button type="button" className={btnSecondary} onClick={signOut}>
          {t.signOut}
        </button>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        {(["pending", "approved", "paid"] as const).map((key) => (
          <div key={key} className={`${card} p-4`}>
            <dt className="text-xs text-ink-soft">{t[key]}</dt>
            <dd className="mt-1 text-2xl font-semibold text-ink">{money(portal.totals[key], portal.currency)}</dd>
          </div>
        ))}
      </dl>

      <section className={`${card} p-5`}>
        <h2 className="text-base font-semibold text-ink">{t.links}</h2>
        <ul className="mt-3 space-y-2">
          {links.map((item) => (
            <li key={item.url} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  <bdi>{item.name}</bdi>
                </p>
                <p dir="ltr" className="truncate text-start text-xs text-ink-soft">
                  {item.url}
                </p>
              </div>
              <button type="button" onClick={() => void copy(item.url)} className="shrink-0 cursor-pointer text-sm font-semibold text-primary">
                {copied === item.url ? t.copied : t.copy}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="text-base font-semibold text-ink">{t.orders}</h2>
        {portal.orders.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">{t.noOrders}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {portal.orders.map((order) => (
              <li key={order.orderNumber} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <bdi dir="ltr" className="font-medium text-ink">
                    {order.orderNumber}
                  </bdi>
                  <span className="ms-2 text-xs text-ink-soft">{when.format(new Date(order.orderedAt))}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-ink-soft">{t.status[order.status]}</span>
                  <span className={`font-semibold ${order.status === "void" ? "text-ink-soft line-through" : "text-ink"}`}>{money(order.amount, order.currency)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {portal.payouts.length > 0 && (
        <section className={`${card} p-5`}>
          <h2 className="text-base font-semibold text-ink">{t.payouts}</h2>
          <ul className="mt-3 divide-y divide-line">
            {portal.payouts.map((payout) => (
              <li key={payout.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="text-ink-soft">{when.format(new Date(payout.paidAt))}</span>
                <span className="font-semibold text-ink">{money(payout.amount, payout.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
