"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { API_BASE_URL, REGISTER_URL } from "@/lib/urls";

/**
 * Anonymous traffic beacons for the platform console's "Site traffic" page.
 *
 * - `view` on every page shown (route changes too); the referrer and the
 *   address's utm_* only on the visit's first view.
 * - `ping` every 15 s while the tab is visible.
 * - `cta_click` when a sign-up link is clicked; every sign-up link also gets
 *   `?sv={sessionId}` so the dashboard can tie the new account to this visit.
 *
 * No cookie: a random visitor id in localStorage and a per-visit id in
 * sessionStorage. Fire and forget — the server answers 404 while collection is
 * off, and nothing here ever blocks or shows on the page. Renders nothing.
 */

const ENDPOINT = `${API_BASE_URL}/public/site-events`;
const VISITOR_KEY = "zimos:visitor";
const SESSION_KEY = "zimos:visit";
const PING_MS = 15_000;

type SiteEvent = "view" | "ping" | "cta_click";

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

function visitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = newId();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

/** The visit's id: one per tab, and a new one when the day changes. `first` until its first view is sent. */
function session(): { id: string; first: boolean } {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const kept = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as { id?: string; day?: string; viewed?: boolean } | null;
    if (kept?.id && kept.day === today) return { id: kept.id, first: !kept.viewed };
  } catch {
    // A value this site did not write: start a new visit.
  }
  const id = newId();
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, day: today, viewed: false }));
  return { id, first: true };
}

function markViewed(id: string) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, day: new Date().toISOString().slice(0, 10), viewed: true }));
}

function send(event: SiteEvent, path: string) {
  try {
    const visit = session();
    const body: Record<string, string> = { visitorId: visitorId(), sessionId: visit.id, event, path: path.slice(0, 300) };
    const locale = path.split("/")[1];
    if (locale === "ar" || locale === "en") body.locale = locale;
    if (event === "view" && visit.first) {
      if (document.referrer) body.referrer = document.referrer.slice(0, 500);
      const query = new URLSearchParams(window.location.search);
      for (const [param, key] of [
        ["utm_source", "utmSource"],
        ["utm_medium", "utmMedium"],
        ["utm_campaign", "utmCampaign"],
      ] as const) {
        const value = query.get(param);
        if (value) body[key] = value.slice(0, 100);
      }
      markViewed(visit.id);
    }
    const payload = JSON.stringify(body);
    // text/plain keeps it a simple request: no preflight.
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "text/plain" }))) return;
    void fetch(ENDPOINT, {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "text/plain" },
      keepalive: true,
      credentials: "omit",
    }).catch(() => undefined);
  } catch {
    // Storage blocked, or the beacon refused: the page carries on without it.
  }
}

function isSignUpLink(a: HTMLAnchorElement): boolean {
  return a.href.startsWith(REGISTER_URL);
}

/** Adds `sv` to a sign-up link, keeping whatever it already carries (a chosen plan). */
function tag(a: HTMLAnchorElement) {
  try {
    const url = new URL(a.href);
    url.searchParams.set("sv", session().id);
    a.href = url.toString();
  } catch {
    // Left as it was.
  }
}

export function SiteBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    // `pathname` only says the route changed; the address itself is what is sent
    // (the proxy may have rewritten what the hook saw on the first render).
    send("view", window.location.pathname);
    // Sign-up links on this page, so a new-tab or copied link carries the visit too.
    document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
      if (isSignUpLink(a)) tag(a);
    });
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") send("ping", window.location.pathname);
    }, PING_MS);
    return () => window.clearInterval(timer);
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || !isSignUpLink(a)) return;
      tag(a);
      send("cta_click", window.location.pathname);
    };
    // Capture: the link is tagged before the browser follows it.
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onClick, true);
    };
  }, []);

  return null;
}
