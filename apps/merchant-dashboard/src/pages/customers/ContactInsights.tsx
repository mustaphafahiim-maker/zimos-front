import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@store-builder/ui";
import { contactsGet, contactsSetTags } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { CONTACT_STRINGS, parseTagInput } from "./contactStrings";
import { DeliveryRateBar } from "./DeliveryRateBar";

const STRINGS = {
  en: {
    title: "Contact",
    orders: "Orders",
    spent: "Spent",
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
    orders: "الطلبات",
    spent: "المدفوع",
    lastOrder: "آخر طلب",
    never: "لم يطلب بعد",
    source: "المصدر",
    tags: "الوسوم",
    noTags: "مفيش وسوم لسه.",
    addTag: "إضافة وسم",
    addTagPlaceholder: "مثال: vip، جملة",
    add: "إضافة",
    removeTag: "حذف الوسم {tag}",
    forms: "رسائل النماذج",
    noMessage: "بدون رسالة",
    allForms: "كل الرسائل",
    inbox: "فتح محادثة واتساب",
  },
} satisfies Messages;

/**
 * The contact side of a customer page: lead/customer, live order facts,
 * delivery rate, tags, the forms they sent and their WhatsApp thread.
 */
export function ContactInsights({ customerId }: { customerId: string }) {
  const t = useT(STRINGS);
  const c = useT(CONTACT_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const detail = useAsync(() => contactsGet(apiClient, workspaceId, customerId), [workspaceId, customerId]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // The page around this section already shows loading and errors.
  if (!detail.data) return null;
  const { contact, submissions, conversationId } = detail.data;

  async function saveTags(tags: string[]) {
    setSaving(true);
    try {
      const saved = await contactsSetTags(apiClient, workspaceId, customerId, tags);
      detail.setData((prev) => (prev ? { ...prev, contact: { ...prev.contact, tags: saved } } : (prev as never)));
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
  const facts: [string, React.ReactNode][] = [
    [t.orders, <span className="tabular-nums">{contact.ordersCount}</span>],
    [t.spent, <span className="tabular-nums">{formatMoney(contact.totalSpent, currency)}</span>],
    [t.lastOrder, contact.lastOrderAt ? formatDate(contact.lastOrderAt) : t.never],
    [c.deliveryRate, <DeliveryRateBar contact={contact} />],
  ];
  if (contact.source) facts.push([t.source, c[sourceKey] ?? contact.source]);

  return (
    <Section
      title={t.title}
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
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-ink-soft">{label}</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 border-t border-line pt-4">
        <h3 className="text-sm font-semibold text-ink">{t.tags}</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {contact.tags.length === 0 && <span className="text-sm text-ink-soft">{t.noTags}</span>}
          {contact.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-line bg-paper py-0.5 ps-2.5 pe-1 text-sm text-ink">
              <bdi>{tag}</bdi>
              <button
                type="button"
                disabled={saving}
                aria-label={t.removeTag.replace("{tag}", tag)}
                onClick={() => void saveTags(contact.tags.filter((other) => other !== tag))}
                className="flex size-5 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:bg-line hover:text-ink"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
        <form onSubmit={addTags} className="mt-3 flex max-w-md items-end gap-2">
          <TextField
            className="flex-1"
            label={t.addTag}
            labelHidden
            placeholder={t.addTagPlaceholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={200}
          />
          <Button type="submit" variant="outline" disabled={saving || !draft.trim()}>
            {t.add}
          </Button>
        </form>
      </div>

      {submissions.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">{t.forms}</h3>
            <Link to="/form-submissions" className="text-sm text-primary hover:underline">
              {t.allForms}
            </Link>
          </div>
          <ul className="mt-2 divide-y divide-line">
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
        <div className="mt-5 border-t border-line pt-4">
          <Link to={`/inbox?conversation=${conversationId}`} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            <MessageCircle className="size-4" aria-hidden />
            {t.inbox}
          </Link>
        </div>
      )}
    </Section>
  );
}
