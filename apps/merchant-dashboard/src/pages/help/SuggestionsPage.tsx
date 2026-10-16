import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { SUGGESTION_LIMITS, suggestionCreate, suggestionsList, type SuggestionCategory, type SuggestionStatus } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Suggest a feature",
    description: "Tell us what would make Zimos better for your store: a feature, a bug you found or an improvement. We read every one and reply here.",
    formTitle: "Your suggestion",
    fieldTitle: "Title",
    fieldDescription: "Describe it",
    fieldCategory: "Type",
    fieldContact: "How to reach you (optional)",
    contactHint: "A phone number or email, if not your account's.",
    category_feature: "New feature",
    category_bug: "Something is broken",
    category_improvement: "Improvement",
    send: "Send suggestion",
    sending: "Sending…",
    sent: "Thank you — your suggestion was sent.",
    tooShort: "Write a title of at least 3 characters and a description of at least 10.",
    listTitle: "Your suggestions",
    empty: "You have not sent any suggestions yet.",
    status_new: "New",
    status_under_review: "Under review",
    status_planned: "Planned",
    status_done: "Done",
    reply: "Our reply",
  },
  ar: {
    title: "اقترح ميزة",
    description: "أخبرنا بما يجعل Zimos أفضل لمتجرك: ميزة جديدة أو عطل وجدته أو تحسين. نقرأ كل اقتراح ونرد هنا.",
    formTitle: "اقتراحك",
    fieldTitle: "العنوان",
    fieldDescription: "الوصف",
    fieldCategory: "النوع",
    fieldContact: "وسيلة التواصل معك (اختياري)",
    contactHint: "رقم هاتف أو بريد إلكتروني، إن لم يكن بريد حسابك.",
    category_feature: "ميزة جديدة",
    category_bug: "شيء لا يعمل",
    category_improvement: "تحسين",
    send: "إرسال الاقتراح",
    sending: "جارٍ الإرسال…",
    sent: "شكرًا لك، تم إرسال اقتراحك.",
    tooShort: "اكتب عنوانًا من 3 أحرف على الأقل ووصفًا من 10 أحرف على الأقل.",
    listTitle: "اقتراحاتك",
    empty: "لم ترسل أي اقتراحات بعد.",
    status_new: "جديد",
    status_under_review: "قيد المراجعة",
    status_planned: "مُخطط له",
    status_done: "تم",
    reply: "ردنا",
  },
} satisfies Messages;

const CATEGORIES: SuggestionCategory[] = ["feature", "bug", "improvement"];

/** Help → Suggest a feature: send one, and read the status and reply of the store's suggestions. */
export function SuggestionsPage() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => suggestionsList(apiClient, workspaceId), [workspaceId]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SuggestionCategory>("feature");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    if (title.trim().length < 3 || description.trim().length < 10) return setError(t.tooShort);
    setSending(true);
    setError(null);
    setFieldErrors({});
    try {
      await suggestionCreate(apiClient, workspaceId, { title: title.trim(), description: description.trim(), category, contact: contact.trim() || null });
      toast.success(t.sent);
      setTitle("");
      setDescription("");
      setContact("");
      await list.refresh();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const statusText = (s: SuggestionStatus) => t[`status_${s}`];

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} description={t.description} />
      <section className="rounded-[var(--radius-card)] border border-line p-5">
        <h2 className="font-display text-lg font-medium text-ink">{t.formTitle}</h2>
        <form onSubmit={submit} className="mt-4 space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <TextField label={t.fieldTitle} value={title} maxLength={SUGGESTION_LIMITS.title} error={fieldErrors.title} onChange={(e) => setTitle(e.target.value)} />
            <Field label={t.fieldCategory} error={fieldErrors.category}>
              {({ id, ...aria }) => (
                <Select id={id} {...aria} value={category} onChange={(e) => setCategory(e.target.value as SuggestionCategory)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t[`category_${c}`]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Field label={t.fieldDescription} error={fieldErrors.description}>
            {({ id, ...aria }) => (
              <Textarea id={id} {...aria} rows={5} maxLength={SUGGESTION_LIMITS.description} value={description} onChange={(e) => setDescription(e.target.value)} />
            )}
          </Field>
          <TextField
            label={t.fieldContact}
            hint={t.contactHint}
            value={contact}
            maxLength={SUGGESTION_LIMITS.contact}
            error={fieldErrors.contact}
            onChange={(e) => setContact(e.target.value)}
            className="sm:max-w-[calc(50%-0.5rem)]"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={sending}>
              {sending ? t.sending : t.send}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line p-5">
        <h2 className="font-display text-lg font-medium text-ink">{t.listTitle}</h2>
        <DataState loading={list.loading} error={list.error} empty={false} onRetry={() => list.refresh()}>
          {list.data && list.data.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">{t.empty}</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {(list.data ?? []).map((s) => (
                <li key={s.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-ink" dir="auto">
                      {s.title}
                    </p>
                    <span className="text-xs text-ink-soft">
                      {t[`category_${s.category}`]} · {statusText(s.status)} · {formatDateTime(s.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-soft" dir="auto">
                    {s.description}
                  </p>
                  {s.adminReply && (
                    <div className="mt-2 rounded-md border border-line p-3 text-sm">
                      <p className="text-xs font-medium text-ink">{t.reply}</p>
                      <p className="mt-1 whitespace-pre-line text-ink" dir="auto">
                        {s.adminReply}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </section>
    </div>
  );
}
