/** Base URL of the storefront app, without a trailing slash. Used by the live preview. */
export const STOREFRONT_URL = (import.meta.env.VITE_STOREFRONT_URL ?? "http://localhost:3000").replace(
  /\/$/,
  ""
);
