/**
 * Store features that ship switched off and are turned on per deploy with a
 * build variable. Anything but the exact string "true" leaves a feature off,
 * and off means the store shows and sends nothing of it. Each pairs with the
 * dashboard's VITE_ switch and the API switch of the same name.
 */

/** Shopper accounts (sign-in, account pages, wishlist). Off, no shopper token is kept, read or sent. */
export const SHOPPER_ACCOUNTS_ENABLED = process.env.NEXT_PUBLIC_SHOPPER_ACCOUNTS_ENABLED === "true";
