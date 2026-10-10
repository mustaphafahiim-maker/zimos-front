/**
 * Features that ship switched off and are turned on per deploy with a build
 * variable. Anything but the exact string "true" leaves a feature off, and
 * off means the console shows nothing of it.
 */

/**
 * Two-step sign-in: the code step at console sign-in, and support's reset on
 * a person's page. Pairs with the API's TWO_FACTOR_ENABLED (and NEW_DEVICE_CODE).
 */
export const TWO_FACTOR_ENABLED = import.meta.env.VITE_TWO_FACTOR_ENABLED === "true";
