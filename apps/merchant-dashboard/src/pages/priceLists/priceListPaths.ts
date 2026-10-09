/** Where a price list's editor lives, and the form for a new one (routes in App.tsx). */
export const PRICE_LISTS_PATH = "/offers/price-lists";
export const NEW_PRICE_LIST_PATH = `${PRICE_LISTS_PATH}/new`;
export const priceListPath = (id: string) => `${PRICE_LISTS_PATH}/${id}`;
