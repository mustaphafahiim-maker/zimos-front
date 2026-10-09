import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { IconDelete, IconEdit, IconEmail, IconLock, IconPlus } from "@/components/icons";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  apiErrorCode,
  apiFieldProblems,
  domainDnsRecordsGet,
  domainDnsRecordsReplace,
  type DomainDnsRecord,
  type DomainDnsRecordInput,
  type DomainDnsRecords,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Field, TextField } from "@/components/Field";
import { SaveBar } from "@/components/SaveBar";
import { Section } from "@/components/Section";
import { Select } from "@/components/Select";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { useDomainPurchaseErrorMessage } from "./DomainOwnerStep";

/**
 * The DNS records of a domain bought in the dashboard (handoff item 385),
 * at /domains/purchases/:purchaseId/dns — opened from the bought domain's menu
 * in Store settings → Domains.
 *
 * The store's own records (routing, redirect, verification) come first, locked.
 * Under them the merchant's: MX for email, TXT for a verification, A / AAAA /
 * CNAME for a subdomain. Edits stay in the page until «حفظ التغييرات», which
 * sends the whole list of the merchant's records in one PUT; a refused record
 * gets the server's reason under its row.
 */

const STRINGS = {
  en: {
    title: "DNS records for {hostname}",
    titlePlain: "DNS records",
    back: "Domains",
    description: "Add email (MX), a site verification (TXT) or a subdomain (A, AAAA, CNAME). The records that connect the domain to your store stay as they are.",
    section: "Records",
    type: "Type",
    name: "Name",
    value: "Value",
    priority: "Priority",
    ttl: "TTL",
    actions: "Actions",
    locked: "This record connects the domain to your store — it can't be changed",
    notPresent: "Will be written on the next save",
    storeEmail: "Store email",
    storeEmailHint: "If you delete it, order emails won't be sent from this domain",
    notEditable: "This record type can't be edited here",
    add: "Add record",
    edit: "Edit",
    editNamed: "Edit {type} {name}",
    delete: "Delete",
    deleteNamed: "Delete {type} {name}",
    addTitle: "Add record",
    editTitle: "Edit record",
    nameHint: "@ means the domain itself",
    priorityHint: "Lower priority is tried first",
    ttlHint: "Seconds, 60 to 86400. 300 is fine for most records.",
    ok: "Done",
    cancel: "Cancel",
    save: "Save changes",
    saved: "DNS records saved — they can take up to an hour to work",
    counter: "{n} of {max}",
    full: "This domain has as many records as it can hold ({max}). Delete one to add another.",
    emptyTitle: "No records of your own yet — add MX for email or TXT for verification",
    fixRows: "Some records need attention — the reason is under each one.",
    valueRequired: "Enter the value",
    priorityInvalid: "A whole number from 0 to 65535",
    ttlInvalid: "A whole number from 60 to 86400",
    placeholder_A: "203.0.113.10",
    placeholder_AAAA: "2001:db8::1",
    placeholder_CNAME: "shops.example.com",
    placeholder_MX: "mx.example.com",
    placeholder_TXT: "google-site-verification=…",
    DNS_RECORDS_UNSUPPORTED: "This domain holds records that can't be edited here — contact support",
    DOMAIN_REGISTRAR_CHANGED: "This domain is no longer held by the registrar it was bought from — contact support",
    DOMAIN_NOT_ACTIVE: "This domain isn't active, so its records can't be changed",
    DOMAIN_DNS_UNSUPPORTED: "This domain's registrar doesn't let its records be edited here — contact support",
    m_priorityNeeded: "An MX record needs a priority (0–65535, lower is tried first)",
    m_priorityOnlyMx: "Only an MX record has a priority",
    m_ipv4: "Enter an IPv4 address like 203.0.113.10",
    m_ipv6: "Enter an IPv6 address like 2001:db8::1",
    m_mx: "Enter the mail server's name, like mx.example.com (not an IP address)",
    m_host: "Enter a host name like shops.example.com",
    m_apexCname: "The domain itself can't have a CNAME record — use A records",
    m_selfCname: "A CNAME record can't point to itself",
    m_txt: "Enter the text (up to 1024 characters, on one line)",
    m_reserved: "This name is used by the store's own records: it can't be changed here",
    m_twice: "This record is listed twice",
    m_cnameAlone: "This name has a CNAME record, so it can't have any other record",
    m_name: "Use @ for the domain itself or a name like mail (letters, digits, - and _)",
  },
  ar: {
    title: "سجلات DNS لـ {hostname}",
    titlePlain: "سجلات DNS",
    back: "الدومينات",
    description: "ضيف إيميل (MX) أو تحقق من موقع (TXT) أو دومين فرعي (A و AAAA و CNAME). السجلات اللي بتوصّل الدومين بمتجرك بتفضل زي ما هي.",
    section: "السجلات",
    type: "النوع",
    name: "الاسم",
    value: "القيمة",
    priority: "الأولوية",
    ttl: "TTL",
    actions: "إجراءات",
    locked: "السجل ده بيوصّل الدومين بمتجرك — مينفعش يتغيّر",
    notPresent: "هيتكتب مع الحفظ الجاي",
    storeEmail: "إيميل المتجر",
    storeEmailHint: "لو مسحته، إيميلات الطلبات مش هتتبعت من الدومين ده",
    notEditable: "نوع السجل ده مينفعش يتعدل من هنا",
    add: "إضافة سجل",
    edit: "تعديل",
    editNamed: "تعديل {type} {name}",
    delete: "حذف",
    deleteNamed: "حذف {type} {name}",
    addTitle: "إضافة سجل",
    editTitle: "تعديل السجل",
    nameHint: "@ يعني الدومين نفسه",
    priorityHint: "الأولوية الأقل بتتجرّب الأول",
    ttlHint: "بالثواني، من 60 لـ 86400. 300 مناسبة لأغلب السجلات.",
    ok: "تمام",
    cancel: "إلغاء",
    save: "حفظ التغييرات",
    saved: "اتحفظت سجلات DNS — ممكن تاخد لحد ساعة لحد ما تشتغل",
    counter: "{n} من {max}",
    full: "الدومين ده وصل لأقصى عدد سجلات ({max}). امسح واحد علشان تضيف غيره.",
    emptyTitle: "مفيش سجلات خاصة بيك لسه — ضيف MX للإيميل أو TXT للتحقق",
    fixRows: "فيه سجلات محتاجة تتراجع — السبب مكتوب تحت كل واحد.",
    valueRequired: "اكتب القيمة",
    priorityInvalid: "رقم صحيح من 0 لـ 65535",
    ttlInvalid: "رقم صحيح من 60 لـ 86400",
    placeholder_A: "203.0.113.10",
    placeholder_AAAA: "2001:db8::1",
    placeholder_CNAME: "shops.example.com",
    placeholder_MX: "mx.example.com",
    placeholder_TXT: "google-site-verification=…",
    DNS_RECORDS_UNSUPPORTED: "الدومين ده عليه سجلات مينفعش تتعدل من هنا — كلّم الدعم",
    DOMAIN_REGISTRAR_CHANGED: "الدومين ده مبقاش عند المسجّل اللي اتشترى منه — كلّم الدعم",
    DOMAIN_NOT_ACTIVE: "الدومين ده مش شغال، فسجلاته مينفعش تتغيّر",
    DOMAIN_DNS_UNSUPPORTED: "المسجّل بتاع الدومين ده مش بيسمح بتعديل السجلات من هنا — كلّم الدعم",
    m_priorityNeeded: "سجل MX محتاج أولوية (من 0 لـ 65535، والأقل بتتجرّب الأول)",
    m_priorityOnlyMx: "الأولوية لسجل MX بس",
    m_ipv4: "اكتب عنوان IPv4 زي 203.0.113.10",
    m_ipv6: "اكتب عنوان IPv6 زي 2001:db8::1",
    m_mx: "اكتب اسم سيرفر الإيميل زي mx.example.com (مش عنوان IP)",
    m_host: "اكتب اسم هوست زي shops.example.com",
    m_apexCname: "الدومين نفسه مينفعش يبقى عليه سجل CNAME — استخدم سجلات A",
    m_selfCname: "سجل CNAME مينفعش يشاور على نفسه",
    m_txt: "اكتب النص (لحد 1024 حرف، في سطر واحد)",
    m_reserved: "الاسم ده مستخدم في سجلات المتجر نفسه: مينفعش يتغيّر من هنا",
    m_twice: "السجل ده مكتوب مرتين",
    m_cnameAlone: "الاسم ده عليه سجل CNAME، فمينفعش يبقى عليه سجل تاني",
    m_name: "استخدم @ للدومين نفسه أو اسم زي mail (حروف وأرقام و - و _)",
  },
} satisfies Messages;

type T = (typeof STRINGS)["en"];

/** The server's reasons for refusing a record (purchaseDns.js checkRecords), matched to our own sentences. */
const REASONS: [RegExp, keyof T][] = [
  [/needs a priority/i, "m_priorityNeeded"],
  [/Only an MX record/i, "m_priorityOnlyMx"],
  [/IPv4/i, "m_ipv4"],
  [/IPv6/i, "m_ipv6"],
  [/mail server/i, "m_mx"],
  [/Enter a host name/i, "m_host"],
  [/itself can't have a CNAME/i, "m_apexCname"],
  [/point to itself/i, "m_selfCname"],
  [/up to 1024/i, "m_txt"],
  [/store's own records/i, "m_reserved"],
  [/listed twice/i, "m_twice"],
  [/has a CNAME record/i, "m_cnameAlone"],
  [/^Use "@"/i, "m_name"],
];

function reasonText(t: T, message: string): string {
  const known = REASONS.find(([pattern]) => pattern.test(message));
  return known ? t[known[1]] : message;
}

const FALLBACK_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT"];
/** Written for the store's sending domain: email_spf, email_dkim, email_ownership, email_brevo_code … */
const isStoreEmail = (purpose: string | null) => Boolean(purpose && purpose.startsWith("email"));

/** One of the merchant's records while it is being edited in the page. */
interface Draft {
  key: string;
  type: string;
  host: string;
  value: string;
  priority: number | null;
  ttl: number;
  purpose: string | null;
  /** False for a type that can't be edited here: shown, never sent. */
  editable: boolean;
}

/** A table row: a locked record of the store's, or one of the merchant's. */
type Row = (Draft & { locked: false }) | { key: string; locked: true; record: DomainDnsRecord };

let nextKey = 0;
const newKey = () => `r${++nextKey}`;

function draftsOf(data: DomainDnsRecords): Draft[] {
  return data.records
    .filter((r) => !r.locked)
    .map((r) => ({
      key: newKey(),
      type: r.type,
      host: r.host,
      value: r.value,
      priority: r.priority ?? null,
      ttl: r.ttl,
      purpose: r.purpose,
      editable: r.editable !== false,
    }));
}

const sameDrafts = (a: Draft[], b: Draft[]) =>
  a.length === b.length && a.every((x, i) => x.type === b[i].type && x.host === b[i].host && x.value === b[i].value && x.priority === b[i].priority && x.ttl === b[i].ttl);

interface FormState {
  key: string | null;
  type: string;
  host: string;
  value: string;
  priority: string;
  ttl: string;
  purpose: string | null;
}

export function DomainDnsRecordsPage() {
  const t = useT(STRINGS);
  const { intlLocale } = useLocale();
  const { purchaseId = "" } = useParams();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useDomainPurchaseErrorMessage();
  const state = useAsync(() => domainDnsRecordsGet(apiClient, workspaceId, purchaseId), [workspaceId, purchaseId]);
  const data = state.data;
  // What the server has, and the page's own copy the merchant edits until Save.
  const [saved, setSaved] = useState<Draft[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [formErrors, setFormErrors] = useState<{ value?: string; priority?: string; ttl?: string }>({});

  function adopt(next: DomainDnsRecords) {
    const fresh = draftsOf(next);
    setSaved(fresh);
    setDrafts(fresh);
    setRowErrors({});
    setSaveError(null);
  }

  useEffect(() => {
    if (data) adopt(data);
  }, [data]);

  const dirty = !sameDrafts(saved, drafts);
  useReportDirty(dirty);

  const types = data?.limits.types?.length ? data.limits.types : FALLBACK_TYPES;
  const max = data?.limits.maxRecords ?? 50;
  const number = (n: number) => new Intl.NumberFormat(intlLocale).format(n);
  const overridden = {
    DNS_RECORDS_UNSUPPORTED: t.DNS_RECORDS_UNSUPPORTED,
    DOMAIN_REGISTRAR_CHANGED: t.DOMAIN_REGISTRAR_CHANGED,
    DOMAIN_NOT_ACTIVE: t.DOMAIN_NOT_ACTIVE,
    DOMAIN_DNS_UNSUPPORTED: t.DOMAIN_DNS_UNSUPPORTED,
  };

  const rows = useMemo<Row[]>(
    () => [
      // The store's own records first, in the server's order.
      ...(data?.records ?? []).filter((r) => r.locked).map((record, i): Row => ({ key: `locked-${i}`, locked: true, record })),
      ...drafts.map((d): Row => ({ ...d, locked: false })),
    ],
    [data, drafts]
  );

  function openAdd() {
    setFormErrors({});
    setForm({ key: null, type: types.includes("MX") ? "MX" : types[0], host: "@", value: "", priority: "10", ttl: "300", purpose: null });
  }

  function openEdit(d: Draft) {
    setFormErrors({});
    setForm({ key: d.key, type: d.type, host: d.host, value: d.value, priority: d.priority === null ? "10" : String(d.priority), ttl: String(d.ttl), purpose: d.purpose });
  }

  function remove(d: Draft) {
    setDrafts((prev) => prev.filter((x) => x.key !== d.key));
    setRowErrors((prev) => {
      const { [d.key]: _gone, ...rest } = prev;
      return rest;
    });
  }

  function submitForm(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    const errors: typeof formErrors = {};
    const value = form.value.trim();
    if (!value) errors.value = t.valueRequired;
    const priority = Number(form.priority);
    if (form.type === "MX" && (!/^\d+$/.test(form.priority.trim()) || priority > 65535)) errors.priority = t.priorityInvalid;
    const ttl = Number(form.ttl);
    if (!/^\d+$/.test(form.ttl.trim()) || ttl < 60 || ttl > 86400) errors.ttl = t.ttlInvalid;
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const next: Draft = {
      key: form.key ?? newKey(),
      type: form.type,
      host: form.host.trim() || "@",
      value,
      priority: form.type === "MX" ? priority : null,
      ttl,
      purpose: form.purpose,
      editable: true,
    };
    setDrafts((prev) => (form.key ? prev.map((x) => (x.key === form.key ? next : x)) : [...prev, next]));
    setRowErrors((prev) => {
      const { [next.key]: _fixed, ...rest } = prev;
      return rest;
    });
    setForm(null);
  }

  async function save() {
    if (saving) return;
    // Every one of the merchant's records, in the page's order; never the locked ones.
    const sent = drafts.filter((d) => d.editable);
    const body: DomainDnsRecordInput[] = sent.map((d) => ({
      type: d.type,
      name: d.host,
      value: d.value,
      ...(d.type === "MX" && d.priority !== null ? { priority: d.priority } : {}),
      ttl: d.ttl,
    }));
    setSaving(true);
    setSaveError(null);
    setRowErrors({});
    try {
      const answer = await domainDnsRecordsReplace(apiClient, workspaceId, purchaseId, body);
      state.setData(answer);
      toast.success(t.saved);
    } catch (err) {
      const problems = apiFieldProblems(err);
      const byRow: Record<string, string> = {};
      for (const problem of problems) {
        const index = /^records\[(\d+)\]/.exec(problem.field)?.[1];
        const row = index === undefined ? undefined : sent[Number(index)];
        if (row && !byRow[row.key]) byRow[row.key] = reasonText(t, problem.message);
      }
      setRowErrors(byRow);
      // Nothing is thrown away: the form stays as the merchant left it.
      setSaveError(Object.keys(byRow).length > 0 ? t.fixRows : errorMessage(err, overridden));
    } finally {
      setSaving(false);
    }
  }

  const ltr = (text: string, className?: string) => (
    <bdi dir="ltr" className={cn("break-all", className)}>
      {text}
    </bdi>
  );

  const columns: Column<Row>[] = [
    {
      key: "type",
      header: t.type,
      cell: (row) =>
        row.locked ? (
          <span className="inline-flex items-center gap-1.5 text-ink-soft" title={t.locked}>
            <IconLock className="size-4 shrink-0" aria-hidden />
            <span className="font-mono text-xs font-medium">{row.record.type}</span>
            <span className="sr-only">{t.locked}</span>
          </span>
        ) : (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-paper-sunken px-2 py-0.5 font-mono text-xs font-medium text-ink">{row.type}</span>
            {isStoreEmail(row.purpose) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-dark">
                <IconEmail className="size-3.5" aria-hidden />
                {t.storeEmail}
              </span>
            )}
          </span>
        ),
    },
    {
      key: "name",
      header: t.name,
      cell: (row) => ltr(row.locked ? row.record.host : row.host, cn("font-mono text-xs", row.locked ? "text-ink-soft" : "text-ink")),
    },
    {
      key: "value",
      header: t.value,
      className: "max-w-[26rem]",
      cell: (row) =>
        row.locked ? (
          <span className="block">
            {ltr(row.record.value, "font-mono text-xs text-ink-soft")}
            {row.record.present === false && <span className="mt-0.5 block text-xs font-medium text-accent-dark">{t.notPresent}</span>}
          </span>
        ) : (
          <span className="block">
            {ltr(row.value, "font-mono text-xs text-ink")}
            {isStoreEmail(row.purpose) && <span className="mt-0.5 block text-xs text-ink-soft">{t.storeEmailHint}</span>}
            {!row.editable && <span className="mt-0.5 block text-xs text-ink-soft">{t.notEditable}</span>}
            {rowErrors[row.key] && (
              <span role="alert" className="mt-0.5 block text-xs font-medium text-danger">
                {rowErrors[row.key]}
              </span>
            )}
          </span>
        ),
    },
    {
      key: "priority",
      header: t.priority,
      phoneSkip: (row) => (row.locked ? row.record.type !== "MX" : row.type !== "MX"),
      cell: (row) => {
        const priority = row.locked ? (row.record.priority ?? null) : row.priority;
        const type = row.locked ? row.record.type : row.type;
        return type === "MX" && priority !== null ? <span className="tabular-nums text-ink">{number(priority)}</span> : <span className="text-ink-soft">—</span>;
      },
    },
    {
      key: "ttl",
      header: t.ttl,
      cell: (row) => <span className="tabular-nums text-ink-soft">{number(row.locked ? row.record.ttl : row.ttl)}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t.actions}</span>,
      align: "end",
      phoneSkip: (row) => row.locked || !row.editable,
      cell: (row) =>
        row.locked || !row.editable ? null : (
          <span className="inline-flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 md:min-h-8"
              aria-label={fmt(t.editNamed, { type: row.type, name: row.host })}
              disabled={saving}
              onClick={() => openEdit(row)}
            >
              <IconEdit className="size-4" aria-hidden />
              {t.edit}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 text-danger hover:bg-danger-soft hover:text-danger md:min-h-8"
              aria-label={fmt(t.deleteNamed, { type: row.type, name: row.host })}
              disabled={saving}
              onClick={() => remove(row)}
            >
              <IconDelete className="size-4" aria-hidden />
              {t.delete}
            </Button>
          </span>
        ),
    },
  ];

  const full = drafts.length >= max;
  const addButton = (
    <Button type="button" className="min-h-11 rounded-full px-4 md:min-h-9" disabled={saving || full || !data} onClick={openAdd}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.add}
    </Button>
  );

  // A registrar whose records can't be edited here is a state of the domain, not a failed load.
  const loadCode = apiErrorCode(state.error);
  const closed = loadCode === "DOMAIN_DNS_UNSUPPORTED" || loadCode === "DOMAIN_NOT_ACTIVE" || loadCode === "DOMAIN_REGISTRAR_CHANGED";

  return (
    <div>
      <PageHeader
        back={{ to: "/store-settings/domains", label: t.back }}
        title={data ? fmt(t.title, { hostname: `⁦${data.hostname}⁩` }) : t.titlePlain}
        description={t.description}
      />

      {closed ? (
        <Alert>{errorMessage(state.error, overridden)}</Alert>
      ) : (
        <DataState loading={state.loading} error={state.error} onRetry={() => void state.refresh()} skeleton="table">
          <div className="space-y-4">
            <Section
              title={t.section}
              description={`${t.nameHint} · ${fmt(t.counter, { n: number(drafts.length), max: number(max) })}`}
              actions={addButton}
              flush
            >
              <DataTable columns={columns} rows={rows} rowKey={(row) => row.key} minWidth="46rem" className="max-md:px-4 max-md:pb-4" />
            </Section>

            {full && <p className="text-sm font-medium text-accent-dark">{fmt(t.full, { max: number(max) })}</p>}
            {drafts.length === 0 && <EmptyState icon={<IconEmail />} title={t.emptyTitle} action={addButton} />}
            {saveError && !saving && <Alert variant="danger">{saveError}</Alert>}

            <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onDiscard={() => data && adopt(data)} saveLabel={t.save} />
          </div>
        </DataState>
      )}

      <Sheet
        open={form !== null}
        onOpenChange={(open) => {
          if (!open) setForm(null);
        }}
        title={form?.key ? t.editTitle : t.addTitle}
        description={t.nameHint}
        side="auto-end"
        footer={
          <>
            <Button type="button" variant="outline" className="min-h-11 sm:min-h-9" onClick={() => setForm(null)}>
              {t.cancel}
            </Button>
            <Button type="submit" form="dns-record-form" className="min-h-11 sm:min-h-9">
              {t.ok}
            </Button>
          </>
        }
      >
        {form && (
          <form id="dns-record-form" onSubmit={submitForm} noValidate className="space-y-4">
            {isStoreEmail(form.purpose) && <Alert>{t.storeEmailHint}</Alert>}
            <Field label={t.type}>
              {({ id }) => (
                <Select id={id} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="min-h-11 sm:min-h-10">
                  {types.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <TextField
              label={t.name}
              hint={t.nameHint}
              dir="ltr"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="@"
              maxLength={253}
              value={form.host}
              onChange={(e) => setForm({ ...form, host: e.target.value })}
            />
            <TextField
              label={t.value}
              error={formErrors.value}
              dir="ltr"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={(t as Record<string, string>)[`placeholder_${form.type}`]}
              maxLength={1024}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
            {form.type === "MX" && (
              <TextField
                label={t.priority}
                hint={t.priorityHint}
                error={formErrors.priority}
                dir="ltr"
                inputMode="numeric"
                maxLength={5}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              />
            )}
            <TextField
              label={t.ttl}
              hint={t.ttlHint}
              error={formErrors.ttl}
              dir="ltr"
              inputMode="numeric"
              maxLength={5}
              value={form.ttl}
              onChange={(e) => setForm({ ...form, ttl: e.target.value })}
            />
          </form>
        )}
      </Sheet>
    </div>
  );
}
