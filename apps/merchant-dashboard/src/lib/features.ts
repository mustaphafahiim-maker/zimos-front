/**
 * Features that ship switched off and are turned on per deploy with a build
 * variable. Anything but the exact string "true" leaves a feature off, and
 * off means the dashboard shows nothing of it.
 */

/** Merchant-owned domains: the Domains tab in Store settings and its setup step. Pairs with the storefront's CUSTOM_DOMAINS_ENABLED. */
export const CUSTOM_DOMAINS_ENABLED = import.meta.env.VITE_CUSTOM_DOMAINS_ENABLED === "true";
