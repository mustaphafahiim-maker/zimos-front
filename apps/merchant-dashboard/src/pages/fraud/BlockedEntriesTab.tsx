import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Ban, Trash2, Upload } from "lucide-react";
import { Alert, Button, Card } from "@store-builder/ui";
import {
  BLOCKED_ENTRY_SCOPES,
  BLOCKED_ENTRY_TYPES,
  apiFieldProblems,
  protectionAddBlocked,
  protectionImportBlocked,
  protectionListBlocked,
  protectionRemoveBlocked,
  type BlockedEntry,
  type BlockedEntryImportResult,
  type BlockedEntryScope,
  type BlockedEntryType,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Field, TextField } from "@/components/Field";
import { FilterTabs } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    add: "Block something",
    importCsv: "Import CSV",
    typeFilter: "Filter blocked entries by type",
    all: "All",
    type_phone: "Phone",
    type_ip: "IP address",
    type_email: "Email",
    type_device: "Device",
    type_name_address: "Name + address",
    scope_orders: "Ordering",
    scope_otp: "Verification codes",
    scope_visit: "Visiting the store",
    scopeFilter: "Blocked from",
    anyScope: "Anything",
    search: "Search",
    searchPlaceholder: "Number, IP, name or reason",
    colType: "Type",
    colValue: "Blocked",
    colScope: "Blocked from",
    colReason: "Reason",
    colAdded: "Added",
    noReason: "—",
    by: "by {name}",
    viewCustomer: "Open customer",
    remove: "Unblock",
    removeTitle: "Unblock {value}?",
    removeDescription: "It will no longer be blocked from this. A blocked phone's customer is un-blacklisted too.",
    removing: "Unblocking…",
    cancel: "Cancel",
    removed: "{value} is no longer blocked.",
    emptyTitle: "Nothing is blocked yet",
    emptyDescription: "Block a phone, an IP, an email, a device or a name and address — from ordering, from verification codes, or from seeing the store.",
    emptyFiltered: "Nothing matches these filters.",
    addTitle: "Block something",
    addDescription: "Blocking something that is already blocked only updates its reason.",
    what: "What to block",
    value_phone: "Phone number",
    value_ip: "IP address",
    value_email: "Email address",
    value_device: "Device ID",
    name: "Customer name",
    address: "Address",
    nameAddressHint: "Matches orders with this name and this street address, however they are spaced or punctuated.",
    blockFrom: "Block from",
    reason: "Reason (optional)",
    reasonPlaceholder: "Refused three deliveries",
    valueRequired: "Fill this in.",
    valueInvalid_phone: "Enter a valid phone number.",
    valueInvalid_ip: "Enter a valid IP address.",
    valueInvalid_email: "Enter a valid email address.",
    valueInvalid_device: "A device ID is 8 to 128 characters.",
    valueInvalid_name_address: "Enter both a name and an address.",
    scopeRequired: "Choose at least one.",
    save: "Block",
    saving: "Blocking…",
    added: "{value} is now blocked.",
    importTitle: "Import a blocklist",
    importDescription:
      "A CSV file with one entry per line. With a header row, the columns are read by name: type, value, scope, reason, name, address. Without one, the first column is the value and the second the reason.",
    file: "CSV file",
    defaultType: "Type, for rows that do not say",
    defaultScope: "Block from, for rows that do not say",
    chooseFile: "Choose a file first.",
    fileTooBig: "The file is too large (1 MB at most).",
    runImport: "Import",
    importing: "Importing…",
    importDone: "{imported} added, {updated} already there, {skipped} skipped.",
    importErrors: "Lines that were skipped",
    line: "Line {n}: {message}",
    close: "Close",
  },
  ar: {
    add: "حظر جديد",
    importCsv: "استيراد CSV",
    typeFilter: "تصفية المحظورين حسب النوع",
    all: "الكل",
    type_phone: "رقم هاتف",
    type_ip: "عنوان IP",
    type_email: "بريد إلكتروني",
    type_device: "جهاز",
    type_name_address: "اسم + عنوان",
    scope_orders: "الطلب",
    scope_otp: "أكواد التحقق",
    scope_visit: "زيارة المتجر",
    scopeFilter: "محظور من",
    anyScope: "أي شيء",
    search: "بحث",
    searchPlaceholder: "رقم، IP، اسم أو سبب",
    colType: "النوع",
    colValue: "المحظور",
    colScope: "محظور من",
    colReason: "السبب",
    colAdded: "تاريخ الإضافة",
    noReason: "—",
    by: "بواسطة {name}",
    viewCustomer: "فتح العميل",
    remove: "إلغاء الحظر",
    removeTitle: "إلغاء حظر {value}؟",
    removeDescription: "لن يبقى محظورًا من ذلك. وإذا كان رقم هاتف فسيُلغى حظر العميل صاحبه أيضًا.",
    removing: "بنفك الحظر…",
    cancel: "إلغاء",
    removed: "تم إلغاء حظر {value}.",
    emptyTitle: "مفيش أي محظور لسه",
    emptyDescription: "احظر رقم هاتف أو IP أو بريدًا أو جهازًا أو اسمًا وعنوانًا — من الطلب، أو من أكواد التحقق، أو من رؤية المتجر.",
    emptyFiltered: "مفيش نتائج بهذه التصفية.",
    addTitle: "حظر جديد",
    addDescription: "حظر شيء محظور بالفعل يحدّث السبب فقط.",
    what: "ما الذي تريد حظره",
    value_phone: "رقم الهاتف",
    value_ip: "عنوان IP",
    value_email: "البريد الإلكتروني",
    value_device: "معرّف الجهاز",
    name: "اسم العميل",
    address: "العنوان",
    nameAddressHint: "يطابق الأوردرات التي تحمل هذا الاسم وهذا العنوان مهما اختلفت المسافات وعلامات الترقيم.",
    blockFrom: "الحظر من",
    reason: "السبب (اختياري)",
    reasonPlaceholder: "رفض الاستلام ثلاث مرات",
    valueRequired: "املأ هذا الحقل.",
    valueInvalid_phone: "اكتب رقم هاتف صحيحًا.",
    valueInvalid_ip: "اكتب عنوان IP صحيحًا.",
    valueInvalid_email: "اكتب بريدًا إلكترونيًا صحيحًا.",
    valueInvalid_device: "معرّف الجهاز من 8 إلى 128 حرفًا.",
    valueInvalid_name_address: "اكتب الاسم والعنوان معًا.",
    scopeRequired: "اختار واحدًا على الأقل.",
    save: "حظر",
    saving: "بنحظر…",
    added: "تم حظر {value}.",
    importTitle: "استيراد قائمة حظر",
    importDescription:
      "ملف CSV فيه محظور واحد في كل سطر. إذا كان فيه صف عناوين تُقرأ الأعمدة بأسمائها: type, value, scope, reason, name, address. وإن لم يكن، فالعمود الأول هو القيمة والثاني هو السبب.",
    file: "ملف CSV",
    defaultType: "النوع للسطور التي لا تحدده",
    defaultScope: "الحظر من، للسطور التي لا تحدده",
    chooseFile: "اختار ملفًا أولًا.",
    fileTooBig: "الملف كبير جدًا (1 ميجابايت كحد أقصى).",
    runImport: "استيراد",
    importing: "بنستورد…",
    importDone: "أُضيف {imported}، {updated} موجود بالفعل، وتم تخطي {skipped}.",
    importErrors: "سطور تم تخطيها",
    line: "سطر {n}: {message}",
    close: "إغلاق",
  },
} satisfies Messages;

type TypeFilter = "all" | BlockedEntryType;

/** Isolates an LTR value (a phone, an IP) inside a sentence of either direction. */
function isolate(value: string): string {
  return `⁦${value}⁩`;
}

const SCOPE_TONE: Record<BlockedEntryScope, "danger" | "warning" | "neutral"> = {
  orders: "danger",
  otp: "warning",
  visit: "neutral",
};

/**
 * Fraud protection → Blocked: the store's blocked_entries. Phones, IPs,
 * emails, devices and name + address pairs, each blocked from ordering, from
 * verification codes or from visiting.
 */
export function BlockedEntriesTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const [type, setType] = useState<TypeFilter>("all");
  const [scope, setScope] = useState<"" | BlockedEntryScope>("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const params = useMemo(
    () => ({ type: type === "all" ? undefined : type, scope: scope || undefined, q: q || undefined }),
    [type, scope, q]
  );
  const list = useAsync(() => protectionListBlocked(apiClient, workspaceId, params), [workspaceId, params]);
  const entries = list.data?.entries ?? [];
  const counts = list.data?.counts;
  const [loadingMore, setLoadingMore] = useState(false);

  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [removing, setRemoving] = useState<BlockedEntry | null>(null);

  async function loadMore() {
    const cursor = list.data?.nextCursor;
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const next = await protectionListBlocked(apiClient, workspaceId, { ...params, cursor });
      list.setData((prev) => ({ ...next, entries: [...(prev?.entries ?? []), ...next.entries] }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    try {
      await protectionRemoveBlocked(apiClient, workspaceId, removing.id);
    } catch (err) {
      // ConfirmDialog shows a thrown Error's message as-is.
      throw new Error(errorMessage(err));
    }
    toast.success(fmt(t.removed, { value: isolate(removing.label) }));
    setRemoving(null);
    void list.refresh({ silent: true });
  }

  const total = counts ? Object.values(counts).reduce((sum, n) => sum + n, 0) : 0;
  const typeTabs = [
    { value: "all" as const, label: counts ? `${t.all} (${total})` : t.all },
    ...BLOCKED_ENTRY_TYPES.map((key) => ({
      value: key,
      label: counts ? `${t[`type_${key}`]} (${counts[key]})` : t[`type_${key}`],
    })),
  ];
  const filtered = type !== "all" || scope !== "" || q !== "";

  const columns: Column<BlockedEntry>[] = [
    {
      key: "value",
      header: t.colValue,
      cell: (entry) => (
        <div className="min-w-0">
          <bdi dir={entry.type === "name_address" ? "auto" : "ltr"} className="font-medium break-words text-ink">
            {entry.label}
          </bdi>
          <div className="text-xs text-ink-soft">
            {t[`type_${entry.type}`]}
            {entry.customerId && (
              <>
                {" · "}
                <Link to={`/customers/${entry.customerId}`} className="text-primary hover:underline">
                  {t.viewCustomer}
                </Link>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "scope",
      header: t.colScope,
      cell: (entry) => <StatusBadge value={entry.scope} tone={SCOPE_TONE[entry.scope]} text={t[`scope_${entry.scope}`]} />,
    },
    {
      key: "reason",
      header: t.colReason,
      cell: (entry) =>
        entry.reason ? (
          <span dir="auto" className="break-words text-ink">
            {entry.reason}
          </span>
        ) : (
          <span className="text-ink-soft">{t.noReason}</span>
        ),
    },
    {
      key: "added",
      header: t.colAdded,
      cell: (entry) => (
        <div className="text-ink-soft">
          <div>{formatDate(entry.createdAt)}</div>
          {entry.createdBy && <div className="text-xs">{fmt(t.by, { name: entry.createdBy })}</div>}
        </div>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t.remove}</span>,
      align: "end",
      cell: (entry) => (
        <Button variant="outline" size="sm" className="min-h-9" onClick={() => setRemoving(entry)}>
          <Trash2 className="size-4" aria-hidden />
          {t.remove}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs tabs={typeTabs} value={type} onChange={setType} label={t.typeFilter} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-10" onClick={() => setImporting(true)}>
            <Upload className="size-4" aria-hidden />
            {t.importCsv}
          </Button>
          <Button className="min-h-10" onClick={() => setAdding(true)}>
            <Ban className="size-4" aria-hidden />
            {t.add}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <TextField
          label={t.search}
          labelHidden
          type="search"
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Field label={t.scopeFilter} labelHidden>
          {(props) => (
            <Select {...props} value={scope} onChange={(e) => setScope(e.target.value as "" | BlockedEntryScope)}>
              <option value="">
                {t.scopeFilter}: {t.anyScope}
              </option>
              {BLOCKED_ENTRY_SCOPES.map((key) => (
                <option key={key} value={key}>
                  {t.scopeFilter}: {t[`scope_${key}`]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        <Card className="p-0">
          <DataTable
            columns={columns}
            rows={entries}
            rowKey={(entry) => entry.id}
            minWidth="44rem"
            empty={
              filtered ? (
                <EmptyState title={t.emptyFiltered} />
              ) : (
                <EmptyState
                  icon={<Ban className="size-6" aria-hidden />}
                  title={t.emptyTitle}
                  description={t.emptyDescription}
                  action={<Button onClick={() => setAdding(true)}>{t.add}</Button>}
                />
              )
            }
          />
        </Card>
        <LoadMore hasMore={Boolean(list.data?.nextCursor)} loading={loadingMore} onClick={() => void loadMore()} />
      </DataState>

      <AddBlockedModal
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          void list.refresh({ silent: true });
        }}
      />
      <ImportBlockedModal
        open={importing}
        onClose={() => setImporting(false)}
        onImported={() => void list.refresh({ silent: true })}
      />
      <ConfirmDialog
        open={removing !== null}
        title={removing ? fmt(t.removeTitle, { value: isolate(removing.label) }) : ""}
        description={t.removeDescription}
        confirmLabel={t.remove}
        busyLabel={t.removing}
        cancelLabel={t.cancel}
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

function AddBlockedModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [type, setType] = useState<BlockedEntryType>("phone");
  const [value, setValue] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [scopes, setScopes] = useState<BlockedEntryScope[]>(["orders"]);
  const [reason, setReason] = useState("");
  const [problems, setProblems] = useState<{ value?: string; name?: string; address?: string; scopes?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType("phone");
    setValue("");
    setName("");
    setAddress("");
    setScopes(["orders"]);
    setReason("");
    setProblems({});
    setError(null);
  }, [open]);

  function toggleScope(key: BlockedEntryScope) {
    setScopes((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof problems = {};
    if (type === "name_address") {
      if (!name.trim()) next.name = t.valueRequired;
      if (!address.trim()) next.address = t.valueRequired;
    } else if (!value.trim()) next.value = t.valueRequired;
    if (scopes.length === 0) next.scopes = t.scopeRequired;
    setProblems(next);
    setError(null);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const [entry] = await protectionAddBlocked(apiClient, workspaceId, {
        type,
        ...(type === "name_address" ? { name: name.trim(), address: address.trim() } : { value: value.trim() }),
        scopes,
        ...(reason.trim().length >= 2 ? { reason: reason.trim() } : {}),
      });
      toast.success(fmt(t.added, { value: isolate(entry.label) }));
      onAdded();
    } catch (err) {
      const field = apiFieldProblems(err)[0]?.field;
      if (field === "value") setProblems({ value: t[`valueInvalid_${type}`] });
      else if (field === "name") setProblems({ name: t.valueInvalid_name_address });
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t.addTitle} description={t.addDescription}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label={t.what}>
          {(props) => (
            <Select
              {...props}
              value={type}
              onChange={(e) => {
                setType(e.target.value as BlockedEntryType);
                setProblems({});
              }}
            >
              {BLOCKED_ENTRY_TYPES.map((key) => (
                <option key={key} value={key}>
                  {t[`type_${key}`]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {type === "name_address" ? (
          <>
            <TextField
              label={t.name}
              required
              dir="auto"
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={problems.name}
            />
            <TextField
              label={t.address}
              required
              dir="auto"
              maxLength={500}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              error={problems.address}
              hint={t.nameAddressHint}
            />
          </>
        ) : (
          <TextField
            label={t[`value_${type}`]}
            required
            dir="ltr"
            autoComplete="off"
            inputMode={type === "phone" ? "tel" : type === "email" ? "email" : "text"}
            maxLength={255}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            error={problems.value}
          />
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">{t.blockFrom}</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {BLOCKED_ENTRY_SCOPES.map((key) => (
              <label key={key} className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-primary)]"
                  checked={scopes.includes(key)}
                  onChange={() => toggleScope(key)}
                />
                {t[`scope_${key}`]}
              </label>
            ))}
          </div>
          {problems.scopes && <p className="text-xs font-medium text-danger">{problems.scopes}</p>}
        </fieldset>

        <TextField
          label={t.reason}
          dir="auto"
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t.reasonPlaceholder}
        />

        {error && <Alert variant="danger">{error}</Alert>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? t.saving : t.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const MAX_IMPORT_BYTES = 1024 * 1024;

function ImportBlockedModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<BlockedEntryType>("phone");
  const [scope, setScope] = useState<BlockedEntryScope>("orders");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BlockedEntryImportResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult(null);
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    setError(null);
    if (!file) return setError(t.chooseFile);
    if (file.size > MAX_IMPORT_BYTES) return setError(t.fileTooBig);
    setBusy(true);
    try {
      const csv = await file.text();
      const done = await protectionImportBlocked(apiClient, workspaceId, { csv, type, scope });
      setResult(done);
      onImported();
    } catch (err) {
      setError(apiFieldProblems(err)[0]?.message ?? errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t.importTitle} description={t.importDescription}>
      {result ? (
        <div className="space-y-4">
          <Alert variant="success">
            {fmt(t.importDone, { imported: result.imported, updated: result.updated, skipped: result.skipped })}
          </Alert>
          {result.errors.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-ink">{t.importErrors}</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-ink-soft">
                {result.errors.map((problem) => (
                  <li key={problem.line}>{fmt(t.line, { n: problem.line, message: problem.message })}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={onClose}>{t.close}</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label={t.file} required>
            {(props) => (
              <input
                {...props}
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="block w-full text-sm text-ink file:me-3 file:rounded-md file:border file:border-line file:bg-paper file:px-3 file:py-2 file:text-sm file:text-ink"
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.defaultType}>
              {(props) => (
                <Select {...props} value={type} onChange={(e) => setType(e.target.value as BlockedEntryType)}>
                  {BLOCKED_ENTRY_TYPES.filter((key) => key !== "name_address").map((key) => (
                    <option key={key} value={key}>
                      {t[`type_${key}`]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t.defaultScope}>
              {(props) => (
                <Select {...props} value={scope} onChange={(e) => setScope(e.target.value as BlockedEntryScope)}>
                  {BLOCKED_ENTRY_SCOPES.map((key) => (
                    <option key={key} value={key}>
                      {t[`scope_${key}`]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t.importing : t.runImport}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
