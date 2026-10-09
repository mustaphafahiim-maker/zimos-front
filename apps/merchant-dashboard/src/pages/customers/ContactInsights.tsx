import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconChat, IconClose } from "@/components/icons";
import { Button } from "@store-builder/ui";
import { contactsSetTags } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatDateTime } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { StatusBadge } from "@/components/StatusBadge";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { CONTACT_STRINGS, parseTagInput } from "./contactStrings";
import { CustomerCard, type CustomerCardFrame } from "./detail/CardFrame";
import type { CustomerContactState } from "./detail/contactState";
import { SECTION_STRINGS } from "./detail/sectionStrings";

const STRINGS = {
  en: {
    title: "Contact",
    lastOrder: "Last order",
    never: "Never",
    source: "Came from",
    tags: "Tags",
    noTags: "No tags yet.",
    addTag: "Add a tag",
    addTagPlaceholder: "e.g. vip, wholesale",
    add: "Add",
    removeTag: "Remove tag {tag}",
    forms: "Form submissions",
    noMessage: "No message",
    allForms: "All submissions",
    inbox: "Open WhatsApp chat",
  },
  ar: {
    title: "جهة الاتصال",
    lastOrder: "آخر أوردر",
    never: "لسه ما طلبش",
    source: "جاي منين",
    tags: "الوسوم",
    noTags: "مفيش وسوم لسه.",
    addTag: "ضيف وسم",
    addTagPlaceholder: "مثال: vip، جملة",
    add: "ضيف",
    removeTag: "شيل الوسم {tag}",
    forms: "رسايل النماذج",
    noMessage: "من غير رسالة",
    allForms: "كل الرسايل",
    inbox: "افتح محادثة الواتساب",
  },
} satisfies Messages;

/**
 * The contact side of a customer page: whether they are a lead or a customer
 * and accept marketing, when they last ordered and where they came from, their
 * tags, the forms they sent and their WhatsApp thread.
 *
 * How many orders, what they spent and how many parcels they received are the
 * hero's to say (detail/CustomerHero.tsx) — said once, there. The contact
 * record itself is read by the page (`state`) and shared with the hero, so it
 * is asked for once.
 *
 * `frame` lets the page draw this as one of its folding sections, with the
 * tags as the folded line; left out, it is a `Section`.
 */
export function ContactInsights({ customerId, state, frame }: { customerId: string; state: CustomerContactState; frame?: CustomerCardFrame }) {
  const t = useT(STRINGS);
  const c = useT(CONTACT_STRINGS);
  const sections = useT(SECTION_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // The page around this section already shows loading and errors.
  if (!state.data) return null;
  const { contact, submissions, conversationId } = state.data;

  async function saveTags(tags: string[]) {
    setSaving(true);
    try {
      const saved = await contactsSetTags(apiClient, workspaceId, customerId, tags);
      state.setData((prev) => (prev ? { ...prev, contact: { ...prev.contact, tags: saved } } : (prev as never)));
      setDraft("");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function addTags(e: FormEvent) {
    e.preventDefault();
    const next = parseTagInput(draft);
    if (next.length) void saveTags([...contact.tags, ...next]);
  }

  const sourceKey = `source_${contact.source}` as keyof typeof c;
  const facts: [string, ReactNode][] = [[t.lastOrder, contact.lastOrderAt ? formatDate(contact.lastOrderAt) : t.never]];
  if (contact.source) facts.push([t.source, c[sourceKey] ?? contact.source]);

  // The folded line: the tags themselves, then how many form messages there are.
  const summary = [
    contact.tags.length > 0 ? contact.tags.join(sections.listSep) : sections.tagsNone,
    submissions.length > 0 ? pluralOf(sections, "forms", submissions.length) : null,
  ]
    .filter(Boolean)
    .join(sections.listSep);

  return (
    <CustomerCard
      frame={frame}
      title={t.title}
      summary={summary}
      actions={
        <>
          <StatusBadge value={contact.type} tone={contact.type === "customer" ? "success" : "info"} text={c[`type_${contact.type}`]} />
          <StatusBadge
            value={contact.marketingConsent ? "consent" : "no_consent"}
            tone={contact.marketingConsent ? "success" : "neutral"}
            text={contact.marketingConsent ? c.consentYes : c.consentNo}
          />
        </>
      }
    >
      <dl className="grid grid-cols-2 gap-4">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-ink-soft">{label}</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 border-t border-line pt-4">
        <h3 className="text-sm font-semibold text-ink">{t.tags}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {contact.tags.length === 0 && <span className="text-sm leading-6 text-ink-soft">{t.noTags}</span>}
          {contact.tags.map((tag) => (
            // The chip is as tall as its remove button: 36px beside a mouse, 44px under a thumb.
            <span key={tag} data-slot="customer-tag" className="inline-flex h-9 max-w-full items-center rounded-full border border-line bg-paper ps-3 text-sm text-ink pointer-coarse:h-11">
              <bdi className="min-w-0 truncate">{tag}</bdi>
              <button
                type="button"
                disabled={saving}
                aria-label={fmt(t.removeTag, { tag })}
                onClick={() => void saveTags(contact.tags.filter((other) => other !== tag))}
                className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none pointer-coarse:size-11"
              >
                <IconClose className="size-3.5" weight="bold" aria-hidden />
              </button>
            </span>
          ))}
        </div>
        <form onSubmit={addTags} className="mt-3 flex max-w-md items-end gap-2">
          <TextField
            className="min-w-0 flex-1"
            label={t.addTag}
            labelHidden
            placeholder={t.addTagPlaceholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={200}
          />
          <Button type="submit" variant="outline" className="min-h-11 shrink-0 rounded-full px-5 pointer-fine:min-h-9" disabled={saving || !draft.trim()}>
            {t.add}
          </Button>
        </form>
      </div>

      {submissions.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">{t.forms}</h3>
            <Link to="/form-submissions" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline pointer-fine:min-h-0">
              {t.allForms}
            </Link>
          </div>
          <ul className="mt-1 divide-y divide-line">
            {submissions.map((submission) => (
              <li key={submission.id} className="py-2 text-sm">
                <p className="flex flex-wrap justify-between gap-2 text-xs text-ink-soft">
                  <bdi>{submission.formName}</bdi>
                  <span>{formatDateTime(submission.createdAt)}</span>
                </p>
                <p dir="auto" className="mt-1 whitespace-pre-wrap break-words text-ink">
                  {submission.message || t.noMessage}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {conversationId && (
        <div className="mt-4 border-t border-line pt-3">
          <Link to={`/inbox?conversation=${conversationId}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline">
            <IconChat className="size-4" aria-hidden />
            {t.inbox}
          </Link>
        </div>
      )}
    </CustomerCard>
  );
}
