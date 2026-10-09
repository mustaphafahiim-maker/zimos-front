import { useState } from "react";
import {
  contactsList,
  contactsListTags,
  contactsSetTags,
  segmentsList,
  type Contact,
  type ContactList,
  type ContactSegment,
  type ContactTagCount,
} from "@store-builder/api-client";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { invalidateCached, useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import type { ContactsQuery } from "./useContactsQuery";

const STRINGS = {
  en: {
    tagRemoved: "Tag “{tag}” removed.",
    tagsAdded: "Tags added.",
  },
  ar: {
    tagRemoved: "الوسم «{tag}» اتشال.",
    tagsAdded: "الوسوم اتضافت.",
  },
} satisfies Messages;

const PAGE = 50;
/** The prefix of every cached contacts answer: a save that changes the list forgets them all. */
export const CONTACTS_CACHE = "contacts:";

export interface ContactsData {
  contacts: Contact[];
  /** Totals under the filter (first page only): everyone, customers, leads, who accepts marketing. */
  totals: Pick<ContactList, "total" | "leads" | "customers" | "consenting"> | null;
  /** Nothing to show yet: the first read of this filter. */
  loading: boolean;
  /** A remembered answer is on screen while a fresh one is read. */
  refreshing: boolean;
  error: unknown;
  reload: () => void;
  /** Read again behind what is shown: after a save that changed the list. */
  refreshQuietly: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  tagOptions: ContactTagCount[];
  segmentOptions: ContactSegment[];
  /** Add tags to one contact (PUT /contacts/:id/tags with the whole list). True once saved. */
  addTags: (contact: Contact, tags: string[]) => Promise<boolean>;
  /** Take one tag off; the toast offers to put it back. */
  removeTag: (contact: Contact, tag: string) => Promise<void>;
}

/**
 * The contacts under the page's filter (GET /contacts, 50 a page, by cursor),
 * what the Filters sheet offers (the tags in use with their counts, the saved
 * segments), and the one edit the list makes itself: a contact's tags.
 *
 * A list the merchant comes back to shows at once from memory and is read
 * again behind (lib/useCachedAsync.ts); the first visit shows the skeleton.
 * `version` is bumped by the page after a contact was added.
 */
export function useContactsData(query: ContactsQuery, version: number): ContactsData {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const list = useCachedAsync<ContactList>(
    `${CONTACTS_CACHE}${workspaceId}:${query.key}`,
    () => contactsList(apiClient, workspaceId, { ...query.filter, limit: PAGE }),
    [workspaceId, query.key, version]
  );
  const options = useCachedAsync(
    `contact-filters:${workspaceId}`,
    () => Promise.all([contactsListTags(apiClient, workspaceId), segmentsList(apiClient, workspaceId)]),
    [workspaceId, version]
  );
  const [tagOptions, segmentOptions] = options.data ?? [[], []];
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadMore() {
    const cursor = list.data?.nextCursor;
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await contactsList(apiClient, workspaceId, { ...query.filter, limit: PAGE, cursor });
      // The totals come with the first page only: they are kept as later pages arrive.
      list.setData((prev) => ({
        ...prev,
        ...next,
        total: prev?.total,
        leads: prev?.leads,
        customers: prev?.customers,
        consenting: prev?.consenting,
        contacts: [...(prev?.contacts ?? []), ...next.contacts],
      }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  const setTagsLocally = (contactId: string, tags: string[]) =>
    list.setData((prev) => ({
      ...(prev ?? { nextCursor: null }),
      contacts: (prev?.contacts ?? []).map((contact) => (contact.id === contactId ? { ...contact, tags } : contact)),
    }));

  /** Save the whole list of tags; the row shows it at once and goes back if the save fails. */
  async function saveTags(contact: Contact, tags: string[]): Promise<boolean> {
    const before = contact.tags;
    setTagsLocally(contact.id, tags);
    try {
      const saved = await contactsSetTags(apiClient, workspaceId, contact.id, tags);
      setTagsLocally(contact.id, saved);
      // Other filters of the list were cached with the old tags, and the counts of the sheet moved.
      invalidateCached(CONTACTS_CACHE);
      void options.refresh({ silent: true });
      return true;
    } catch (err) {
      setTagsLocally(contact.id, before);
      toast.error(errorMessage(err));
      return false;
    }
  }

  async function addTags(contact: Contact, tags: string[]): Promise<boolean> {
    const next = [...new Set([...contact.tags, ...tags])];
    if (next.length === contact.tags.length) return true;
    const saved = await saveTags(contact, next);
    if (saved) toast.success(t.tagsAdded);
    return saved;
  }

  async function removeTag(contact: Contact, tag: string): Promise<void> {
    const before = contact.tags;
    const saved = await saveTags(
      contact,
      before.filter((other) => other !== tag)
    );
    if (!saved) return;
    toast.undo(fmt(t.tagRemoved, { tag }), async () => {
      const restored = await contactsSetTags(apiClient, workspaceId, contact.id, before);
      setTagsLocally(contact.id, restored);
      invalidateCached(CONTACTS_CACHE);
      void options.refresh({ silent: true });
    });
  }

  const data = list.data;
  return {
    contacts: data?.contacts ?? [],
    totals: data ? { total: data.total, leads: data.leads, customers: data.customers, consenting: data.consenting } : null,
    loading: list.loading,
    refreshing: list.stale,
    error: list.error,
    reload: () => void list.refresh(),
    refreshQuietly: () => {
      invalidateCached(CONTACTS_CACHE);
      void list.refresh({ silent: true });
      void options.refresh({ silent: true });
    },
    hasMore: Boolean(data?.nextCursor),
    loadingMore,
    loadMore: () => void loadMore(),
    tagOptions,
    segmentOptions,
    addTags,
    removeTag,
  };
}
