/**
 * The one place the marketing site knows where the merchant dashboard lives.
 * Every "Sign in" / "Start free" link points here.
 */
export const DASHBOARD_URL = "https://app.zimos.co";

/** This site's own address, for absolute URLs (canonical links, the sitemap). */
export const SITE_URL = "https://zimos.co";

export const REGISTER_URL = `${DASHBOARD_URL}/register`;
export const LOGIN_URL = `${DASHBOARD_URL}/login`;

/** Sign-up with a plan already chosen: the dashboard's form starts on it. */
export function registerUrlFor(planId: string, cycle: "monthly" | "yearly"): string {
  return `${REGISTER_URL}?${new URLSearchParams({ plan: planId, cycle }).toString()}`;
}

/**
 * The API the pricing pages read the plans from, on the server. The same
 * variable the storefront uses for the same API.
 */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");
