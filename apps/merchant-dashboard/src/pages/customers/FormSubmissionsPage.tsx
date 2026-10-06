import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox, Mail, MailOpen, Trash2 } from "lucide-react";
import { Button, Card, cn } from "@store-builder/ui";
import {
  formSubmissionsDelete,
  formSubmissionsList,
  formSubmissionsMarkRead,
  type FormSubmission,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { useT, fmt, useCommon, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Field, TextField } from "@/components/Field";
import { LoadMore } from "@/components/LoadMore";
import { Select } from "@/components/Select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { TagChips } from "./ContactsAllTab";

const STRINGS = {
  en: {
    title: "Form submissions",
    description: "Every message sent through a form on your store's pages.",
    back: "Contacts",
    searchPlaceholder: "Name, phone, email or message",
    formFilter: "Form",
    anyForm: "All forms",
    unreadOnly: "Unread only",
    unread: "{count} unread",
    emptyTitle: "No submissions yet",
    emptyDescription: "Add a form block to a page in the website editor. Whatever shoppers send through it lands here, and each sender becomes a contact.",
    emptyFiltered: "No submission matches these filters.",
    from: "From {form}",
    page: "on {path}",
    noName: "No name",
    openContact: "Open contact",
    markRead: "Mark as read",
    markUnread: "Mark as unread",
    consent: "Agreed to marketing messages",
    addedTags: "Tags added",
    deleteTitle: "Delete this submission?",
    deleteDescription: "The message is removed for good. The contact stays.",
    deleting: "Deleting…",
    deleted: "Submission deleted.",
  },
  ar: {
    title: "رسائل النماذج",
    description: "كل رسالة أُرسلت من نموذج في صفحات متجرك.",
    back: "جهات الاتصال",
    searchPlaceholder: "الاسم أو الهاتف أو البريد أو نص الرسالة",
    formFilter: "النموذج",
    anyForm: "كل النماذج",
    unreadOnly: "غير المقروءة فقط",
    unread: "{count} غير مقروءة",
    emptyTitle: "مفيش رسائل لسه",
    emptyDescription: "أضف عنصر نموذج إلى صفحة من محرر الموقع. كل ما يرسله الزوار يصل هنا، وكل مرسل يصبح جهة اتصال.",
    emptyFiltered: "مفيش رسالة تطابق هذه الفلاتر.",
    from: "من {form}",
    page: "في {path}",
    noName: "بدون اسم",
    openContact: "فتح جهة الاتصال",
    markRead: "تحديد كمقروءة",
    markUnread: "تحديد كغير مقروءة",
    consent: "وافق على الرسائل التسويقية",
    addedTags: "الوسوم المضافة",
    deleteTitle: "حذف هذه الرسالة؟",
    deleteDescription: "تُحذف الرسالة نهائيًا. جهة الاتصال تبقى.",
    deleting: "بنمسح…",
    deleted: "تم حذف الرسالة.",
  },
} satisfies Messages;

/** Form submissions (SPEC §18.4 "Contact Form Data"): an inbox of page forms. */
export function FormSubmissionsPage() {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const [formName, setFormName] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const params = useMemo(
    () => ({ formName: formName || undefined, unreadOnly: unreadOnly || undefined, q: q || undefined }),
    [formName, unreadOnly, q]
  );
  const list = useAsync(() => formSubmissionsList(apiClient, workspaceId, { ...params, limit: 30 }), [workspaceId, params]);
  const submissions = list.data?.submissions ?? [];
  const [loadingMore, setLoadingMore] = useState(false);
  const [removing, setRemoving] = useState<FormSubmission | null>(null);
  const filtered = Boolean(formName || unreadOnly || q);

  async function loadMore() {
    const cursor = list.data?.nextCursor;
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const next = await formSubmissionsList(apiClient, workspaceId, { ...params, limit: 30, cursor });
      list.setData((prev) => ({ ...prev, ...next, forms: prev?.forms, unread: prev?.unread, submissions: [...(prev?.submissions ?? []), ...next.submissions] }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleRead(submission: FormSubmission) {
    try {
      const saved = await formSubmissionsMarkRead(apiClient, workspaceId, submission.id, !submission.isRead);
      list.setData((prev) => ({
        ...(prev ?? { nextCursor: null }),
        unread: prev?.unread === undefined ? undefined : Math.max(0, prev.unread + (saved.isRead ? -1 : 1)),
        submissions: (prev?.submissions ?? []).map((row) => (row.id === saved.id ? saved : row)),
      }));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    try {
      await formSubmissionsDelete(apiClient, workspaceId, removing.id);
    } catch (err) {
      throw new Error(errorMessage(err));
    }
    toast.success(t.deleted);
    setRemoving(null);
    void list.refresh({ silent: true });
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={t.title}
        description={t.description}
        back={{ to: "/customers", label: t.back }}
        titleBadge={
          list.data?.unread ? (
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-dark dark:text-primary">
              {fmt(t.unread, { count: list.data.unread })}
            </span>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <TextField
          label={common.search}
          labelHidden
          type="search"
          className="min-w-56 flex-1"
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Field label={t.formFilter} labelHidden className="w-48">
          {(props) => (
            <Select {...props} value={formName} onChange={(e) => setFormName(e.target.value)}>
              <option value="">{t.anyForm}</option>
              {(list.data?.forms ?? []).map((form) => (
                <option key={form.formName} value={form.formName}>
                  {form.formName} ({form.count})
                </option>
              ))}
            </Select>
          )}
        </Field>
        <label className="flex min-h-10 items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
          {t.unreadOnly}
        </label>
      </div>

      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        {submissions.length === 0 ? (
          filtered ? (
            <EmptyState title={t.emptyFiltered} />
          ) : (
            <EmptyState icon={<Inbox className="size-6" aria-hidden />} title={t.emptyTitle} description={t.emptyDescription} />
          )
        ) : (
          <ul className="space-y-3">
            {submissions.map((submission) => (
              <li key={submission.id}>
                <Card className={cn("gap-0 p-4", !submission.isRead && "border-primary/40")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                        {!submission.isRead && <span className="size-2 rounded-full bg-primary" aria-hidden />}
                        <bdi>{submission.fullName || t.noName}</bdi>
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-soft">
                        {submission.phone && <bdi dir="ltr">+{submission.phone}</bdi>}
                        {submission.email && <bdi dir="ltr">{submission.email}</bdi>}
                      </p>
                    </div>
                    <div className="text-end text-xs text-ink-soft">
                      <p>{formatDateTime(submission.createdAt)}</p>
                      <p>
                        <bdi>{fmt(t.from, { form: submission.formName })}</bdi>
                        {submission.pagePath && (
                          <>
                            {" "}
                            <bdi dir="ltr">{fmt(t.page, { path: submission.pagePath })}</bdi>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {submission.message && (
                    <p dir="auto" className="mt-3 whitespace-pre-wrap break-words text-sm text-ink">
                      {submission.message}
                    </p>
                  )}
                  {Object.keys(submission.data).length > 0 && (
                    <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
                      {Object.entries(submission.data).map(([label, value]) => (
                        <div key={label} className="contents">
                          <dt dir="auto" className="text-ink-soft">
                            {label}
                          </dt>
                          <dd dir="auto" className="break-words text-ink">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {/* The form's photo input (backend contacts/formFiles.js): a link that works for a few minutes. */}
                  {(submission.files ?? []).length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-3">
                      {(submission.files ?? []).map((file, i) => (
                        <li key={i} className="text-xs text-ink-soft">
                          <a href={file.url} target="_blank" rel="noreferrer" className="block">
                            <img src={file.url} alt={file.label} className="size-24 rounded-[var(--radius-card)] border border-line object-cover" />
                          </a>
                          <bdi className="mt-1 block max-w-24 truncate">{file.label}</bdi>
                        </li>
                      ))}
                    </ul>
                  )}
                  {(submission.tags.length > 0 || submission.marketingConsent) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                      {submission.tags.length > 0 && (
                        <>
                          <span>{t.addedTags}:</span>
                          <TagChips tags={submission.tags} max={6} />
                        </>
                      )}
                      {submission.marketingConsent && <span>{t.consent}</span>}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {submission.customerId && (
                      <Link to={`/customers/${submission.customerId}`} className="inline-flex min-h-9 items-center rounded-[0.5rem] border border-line px-3 text-sm font-medium text-ink hover:border-primary/40 hover:text-primary">
                        {t.openContact}
                      </Link>
                    )}
                    <Button size="sm" variant="outline" className="min-h-9" onClick={() => void toggleRead(submission)}>
                      {submission.isRead ? <Mail className="size-4" aria-hidden /> : <MailOpen className="size-4" aria-hidden />}
                      {submission.isRead ? t.markUnread : t.markRead}
                    </Button>
                    <Button size="sm" variant="outline" className="min-h-9" onClick={() => setRemoving(submission)}>
                      <Trash2 className="size-4" aria-hidden />
                      {common.delete}
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <LoadMore hasMore={Boolean(list.data?.nextCursor)} loading={loadingMore} onClick={() => void loadMore()} />
      </DataState>

      <ConfirmDialog
        open={removing !== null}
        title={t.deleteTitle}
        description={t.deleteDescription}
        confirmLabel={common.delete}
        busyLabel={t.deleting}
        cancelLabel={common.cancel}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
