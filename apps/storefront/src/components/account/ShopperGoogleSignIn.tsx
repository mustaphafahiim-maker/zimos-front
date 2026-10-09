"use client";

import { useEffect, useRef, useState } from "react";
import {
  SHOPPER_GOOGLE_NONCE_SECONDS,
  shopperGoogleConfig,
  shopperGoogleRefusalOf,
  shopperGoogleSignIn,
  shopperMe,
  type ShopperGoogleConfig,
  type ShopperSession,
} from "@store-builder/api-client";
import { loadGoogleIdentity } from "@/lib/googleIdentity";
import { pickText, type Locale } from "@/lib/i18n";
import { useShopperApi } from "@/lib/shopperSession";
import { useStore } from "@/lib/StoreContext";

/**
 * The words around Google's button. The two refusals are the handoff's own
 * (217, and 278 for an email no account has verified); Google draws and
 * words the button itself.
 */
const COPY = {
  en: {
    or: "or",
    working: "Signing you in…",
    failed: "Google sign-in did not work — try again",
    noAccount: "Sign in with your phone first, then add Google from your account",
    unverified: "This Google account's email isn't verified with Google. Try another account.",
    busy: "Too many tries. Wait a little, then try again.",
  },
  ar: {
    or: "أو",
    working: "بندخّلك…",
    failed: "تسجيل الدخول بجوجل منجحش — جرّب تاني",
    noAccount: "ادخل برقم موبايلك الأول، وبعدين ضيف جوجل من حسابك",
    unverified: "إيميل حساب جوجل ده مش متأكد عند جوجل. جرّب حساب تاني.",
    busy: "محاولات كتير. استنى شوية وجرّب تاني.",
  },
  fr: {
    or: "ou",
    working: "Connexion en cours…",
    failed: "La connexion avec Google n'a pas abouti — réessayez",
    noAccount: "Connectez-vous d'abord avec votre téléphone, puis ajoutez Google depuis votre compte",
    unverified: "L'e-mail de ce compte Google n'est pas vérifié chez Google. Essayez un autre compte.",
    busy: "Trop de tentatives. Patientez un peu, puis réessayez.",
  },
};

export function googleSignInCopy(locale: Locale) {
  return pickText(COPY, locale);
}

/** The nonce is read again a minute before it runs out, while the button is still on screen. */
const REFRESH_MS = (SHOPPER_GOOGLE_NONCE_SECONDS - 60) * 1000;

/**
 * Google's "Sign in with Google" button for shopper accounts
 * (frontend-handoff 217, 278, 279).
 *
 * Each time it is shown it asks GET /account/google; only when the store
 * offers Google sign-in does it load Google's script and draw the button,
 * initialised with the store's client id and a fresh nonce (good for 10
 * minutes — read again before that, and after a refused try). Google hands
 * back an ID token, which the API turns into the same shopper session a code
 * gives.
 *
 * `mode="link"` is the signed-in shopper adding Google from their profile:
 * the token is posted with their own, and the Google email becomes their
 * verified email. Without `divider` nothing but the button (and an error
 * under it) is drawn.
 */
export function ShopperGoogleSignIn({
  mode = "signIn",
  divider = true,
  onSignedIn,
}: {
  mode?: "signIn" | "link";
  /** The «أو» line under the button, for the sign-in sheet where the code form follows. */
  divider?: boolean;
  onSignedIn: (session: ShopperSession) => void;
}) {
  const { locale } = useStore();
  const c = googleSignInCopy(locale);
  const api = useShopperApi();
  const holder = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<ShopperGoogleConfig | null>(null);
  // Bumped to read the config (and its nonce) again.
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What the Google callback needs, as it is when Google calls back (minutes after the button was drawn).
  const live = useRef({ api, mode, onSignedIn, c });
  useEffect(() => {
    live.current = { api, mode, onSignedIn, c };
  });

  const { client, storeId } = api;
  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    shopperGoogleConfig(client, storeId)
      .then((next) => {
        if (!cancelled) setConfig(next);
      })
      .catch(() => {
        // Accounts off, a locked store, no network: no Google button, the code form is still there.
        if (!cancelled) setConfig(null);
      });
    const timer = window.setTimeout(() => setRound((n) => n + 1), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [client, storeId, round]);

  const clientId = config?.enabled ? config.clientId : null;
  const nonce = config?.enabled ? config.nonce : null;

  useEffect(() => {
    const box = holder.current;
    if (!clientId || !box) return;
    let cancelled = false;

    async function onCredential(idToken: string | undefined) {
      const now = live.current;
      if (!idToken) return setError(now.c.failed);
      setBusy(true);
      setError(null);
      try {
        const linking = now.mode === "link" ? now.api.token : null;
        const answer = await shopperGoogleSignIn(now.api.client, now.api.storeId, idToken, linking);
        // The answer names the shopper; the account itself (phone, addresses) is read with the new token.
        const me = await shopperMe(now.api.client, now.api.storeId, answer.token);
        // Linking keeps the session the shopper already has; a sign-in starts one.
        if (now.mode !== "link") now.api.signIn(answer.token);
        now.onSignedIn({ token: answer.token, expiresInSeconds: answer.expiresInSeconds, ...me });
      } catch (err) {
        const refusal = shopperGoogleRefusalOf(err);
        if (refusal === "off") setConfig(null);
        else {
          setError(refusal === "no_account" ? now.c.noAccount : refusal === "unverified" ? now.c.unverified : refusal === "busy" ? now.c.busy : now.c.failed);
          // A token is good for one try, and so is its nonce: the next press starts from a fresh one.
          setRound((n) => n + 1);
        }
      } finally {
        setBusy(false);
      }
    }

    loadGoogleIdentity()
      .then((google) => {
        if (cancelled) return;
        google.initialize({
          client_id: clientId,
          ...(nonce ? { nonce } : {}),
          callback: (response) => void onCredential(response.credential),
          auto_select: false,
          ux_mode: "popup",
        });
        box.replaceChildren();
        google.renderButton(box, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text: live.current.mode === "link" ? "continue_with" : "signin_with",
          logo_alignment: "center",
          width: Math.max(200, Math.min(400, Math.floor(box.clientWidth) || 320)),
          locale,
        });
      })
      .catch(() => {
        // Google's script did not load (blocked, offline): nothing is drawn.
        if (!cancelled) setConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, nonce, locale]);

  if (!clientId) return null;

  return (
    <div className={divider ? "mb-4" : undefined} data-google-sign-in={mode}>
      <div ref={holder} className="flex min-h-11 w-full justify-center" aria-busy={busy || undefined} />
      <div aria-live="polite" className="empty:hidden">
        {busy && <p className="mt-2 text-center text-sm text-ink-soft">{c.working}</p>}
        {!busy && error && <p className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
      </div>
      {divider && (
        <p aria-hidden className="mt-4 flex items-center gap-3 text-xs text-ink-soft">
          <span className="h-px flex-1 bg-line" />
          {c.or}
          <span className="h-px flex-1 bg-line" />
        </p>
      )}
    </div>
  );
}
