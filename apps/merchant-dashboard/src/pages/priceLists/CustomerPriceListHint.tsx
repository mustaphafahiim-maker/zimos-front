import { Link } from "react-router-dom";
import { IconTag } from "@/components/icons";
import { Card } from "@store-builder/ui";
import { contactsGet, priceListAppliesTo, priceListsList } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { pluralOf } from "@/lib/plural";
import { fmt, getLocale, useT } from "@/i18n/LocaleContext";
import type { CustomerCardFrame } from "@/pages/customers/detail/CardFrame";
import { PRICE_LISTS_PATH, priceListPath } from "./priceListPaths";
import { PRICE_LIST_STRINGS } from "./priceListStrings";

/**
 * The customer page's «العميل ده بياخد أسعار: Wholesale» (handoff 205): which
 * price lists this customer's tags give them, read when the page opens.
 * Nothing at all for a customer no list applies to, for a store without
 * lists, and for a role that may not read them.
 *
 * `frame` (optional) lets the customer page draw this as one of its folding
 * sections instead of a pane of its own; left out, it is the card it always was.
 */
export function CustomerPriceListHint({ customerId, frame }: { customerId: string; frame?: CustomerCardFrame }) {
  const t = useT(PRICE_LIST_STRINGS);
  const workspaceId = useWorkspaceId();
  const found = useAsync(async () => {
    // The lists first: most stores have none, and then the contact is not read at all.
    const lists = (await priceListsList(apiClient, workspaceId)).filter((list) => list.isActive);
    if (lists.length === 0) return null;
    const { contact } = await contactsGet(apiClient, workspaceId, customerId);
    const matching = lists.filter((list) => priceListAppliesTo(list, contact.tags));
    if (matching.length === 0) return null;
    const mine = new Set(contact.tags.map((tag) => tag.trim().toLowerCase()));
    const tags = [...new Set(matching.flatMap((list) => list.customerTags.filter((tag) => mine.has(tag.trim().toLowerCase()))))];
    return { lists: matching, tags };
  }, [workspaceId, customerId]);

  // An extra on the page: while it loads, when it fails and when it has nothing to say, it stays out.
  if (!found.data) return null;
  const { lists, tags } = found.data;
  const arabic = getLocale() === "ar";
  const joiner = arabic ? "، " : ", ";
  const quoted = (tag: string) => (arabic ? `«${tag}»` : `“${tag}”`);

  const headline = fmt(t.customerGets, { lists: lists.map((list) => list.name).join(joiner) });
  const why = fmt(pluralOf(t, "customerGetsHint", tags.length), { tags: tags.map(quoted).join(joiner) });
  const link = (
    <Link
      to={lists.length === 1 ? priceListPath(lists[0].id) : PRICE_LISTS_PATH}
      className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-primary hover:underline"
    >
      {lists.length === 1 ? t.openList : t.openLists}
    </Link>
  );

  // Inside a folding section of the customer page: the same three things, without the pane and its glyph.
  if (frame) {
    return (
      <>
        {frame({
          title: headline,
          summary: headline,
          children: (
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-sm font-semibold text-ink">{headline}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{why}</p>
              </div>
              {link}
            </div>
          ),
        })}
      </>
    );
  }

  return (
    <Card className="flex-row flex-wrap items-start gap-x-3 gap-y-1 p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <IconTag className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-semibold text-ink">{headline}</p>
        <p className="mt-0.5 text-xs text-ink-soft">{why}</p>
      </div>
      {link}
    </Card>
  );
}
