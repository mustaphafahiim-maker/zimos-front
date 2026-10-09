import type { ContactDetail } from "@store-builder/api-client";

/**
 * The contact record of the customer on the page (GET /contacts/:id), read
 * once by the page and shared: the hero takes the delivery figures and what
 * was spent from it, the «الوسوم والرسائل» section the tags, the form
 * messages and the WhatsApp thread — one request, not one each.
 */
export interface CustomerContactState {
  data: ContactDetail | null;
  error: unknown;
  loading: boolean;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
  setData: (updater: ContactDetail | ((prev: ContactDetail | null) => ContactDetail)) => void;
}
