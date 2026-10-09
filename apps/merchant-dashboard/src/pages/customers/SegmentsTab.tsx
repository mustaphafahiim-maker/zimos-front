import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { IconDelete, IconEdit, IconFilter, IconPeople, IconPlus } from "@/components/icons";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  segmentsCreate,
  segmentsDelete,
  segmentsList,
  segmentsPreview,
  segmentsUpdate,
  type ContactSegment,
  type Product,
  type SegmentPreview,
  type SegmentRules,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { useT, fmt, useCommon, type Messages } from "@/i18n/LocaleContext";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { TextField } from "@/components/Field";
import { PageActionBar } from "@/components/PageHeader";
import { Segmented } from "@/components/Segmented";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { CONTACT_STRINGS, contactErrorCode, parseTagInput } from "./contactStrings";
import { FormSheet } from "./list/FormSheet";

const STRINGS = {
  en: {
    intro: "A segment is a saved filter. It is worked out again every time you use it, so it always reflects today's orders.",
    add: "New segment",
    emptyTitle: "No segments yet",
    emptyDescription: "Group contacts by what they bought, how much they spent or the tags they carry — then message the right people.",
    contacts: "{count} contacts",
    consenting: "{count} accept marketing",
    view: "View contacts",
    everyone: "Everyone",
    deleteTitle: "Delete “{name}”?",
    deleteDescription: "Only the saved filter is removed. The contacts themselves stay.",
    deleted: "Segment deleted.",
    deleting: "Deleting…",
    saved: "Segment saved.",
    createTitle: "New segment",
    editTitle: "Edit segment",
    name: "Name",
    description: "Note",
    rules: "Who is in it",
    rulesHint: "Leave a field empty to ignore it. A contact must match every field you fill in.",
    type: "Type",
    anyType: "Customers and leads",
    includeTags: "Has all of these tags",
    excludeTags: "Has none of these tags",
    tagsHint: "Separate with commas.",
    minOrders: "Orders, at least",
    maxOrders: "Orders, at most",
    minSpent: "Spent at least ({currency})",
    maxSpent: "Spent at most ({currency})",
    olderThan: "Last order more than … days ago",
    within: "Last order within … days",
    governorates: "Governorates",
    governoratesHint: "As written on the orders, separated by commas.",
    products: "Bought any of these products",
    productsHint: "Hold Ctrl (⌘ on a Mac) to pick several.",
    minRate: "Delivery rate at least (%)",
    maxRate: "Delivery rate at most (%)",
    consent: "Marketing consent",
    consentAny: "Does not matter",
    consentYes: "Accepts marketing",
    consentNo: "Does not accept",
    matches: "{total} contacts match now · {consenting} accept marketing",
    counting: "Counting…",
    sum_type: "{type} only",
    sum_include: "tagged {tags}",
    sum_exclude: "not tagged {tags}",
    sum_minOrders: "{n}+ orders",
    sum_maxOrders: "up to {n} orders",
    sum_minSpent: "spent {amount}+",
    sum_maxSpent: "spent up to {amount}",
    sum_older: "no order for {n} days",
    sum_within: "ordered in the last {n} days",
    sum_gov: "in {list}",
    sum_products: "bought {n} chosen products",
    sum_minRate: "delivery rate {n}%+",
    sum_maxRate: "delivery rate up to {n}%",
    sum_consentYes: "accepts marketing",
    sum_consentNo: "does not accept marketing",
    editNamed: "Edit “{name}”",
    deleteNamed: "Delete “{name}”",
    anyShort: "Everyone",
    otherProducts: "+{n} other products chosen",
    productsPickHint: "Tap a product to add it or take it off. The first 100 products are listed.",
  },
  ar: {
    intro: "الشريحة فلتر محفوظ. تُحسب من جديد في كل مرة تستخدمها، فتعكس دائمًا أوردرات اليوم.",
    add: "شريحة جديدة",
    emptyTitle: "مفيش شرائح لسه",
    emptyDescription: "قسّم جهات الاتصال حسب ما اشتروه أو ما دفعوه أو الوسوم التي يحملونها، ثم راسل الأشخاص المناسبين.",
    contacts: "{count} جهة اتصال",
    consenting: "{count} موافق على التسويق",
    view: "عرض جهات الاتصال",
    everyone: "الجميع",
    deleteTitle: "حذف «{name}»؟",
    deleteDescription: "يُحذف الفلتر المحفوظ فقط. جهات الاتصال نفسها تبقى.",
    deleted: "تم حذف الشريحة.",
    deleting: "بنمسح…",
    saved: "تم حفظ الشريحة.",
    createTitle: "شريحة جديدة",
    editTitle: "تعديل الشريحة",
    name: "الاسم",
    description: "ملاحظة",
    rules: "من يدخل فيها",
    rulesHint: "اترك الحقل فارغًا لتجاهله. يجب أن تطابق جهة الاتصال كل حقل تملؤه.",
    type: "النوع",
    anyType: "العملاء والمحتملون",
    includeTags: "يحمل كل هذه الوسوم",
    excludeTags: "لا يحمل أيًا من هذه الوسوم",
    tagsHint: "افصل بفاصلة.",
    minOrders: "عدد الأوردرات على الأقل",
    maxOrders: "عدد الأوردرات على الأكثر",
    minSpent: "دفع على الأقل ({currency})",
    maxSpent: "دفع على الأكثر ({currency})",
    olderThan: "آخر أوردر منذ أكثر من … يوم",
    within: "آخر أوردر خلال … يوم",
    governorates: "المحافظات",
    governoratesHint: "كما هي مكتوبة في الأوردرات، مفصولة بفاصلة.",
    products: "اشترى أيًا من هذه المنتجات",
    productsHint: "اضغط Ctrl (أو ⌘ على ماك) لاختيار أكثر من منتج.",
    minRate: "نسبة الاستلام على الأقل (%)",
    maxRate: "نسبة الاستلام على الأكثر (%)",
    consent: "الموافقة على التسويق",
    consentAny: "لا يهم",
    consentYes: "موافق",
    consentNo: "غير موافق",
    matches: "{total} جهة اتصال تطابق الآن · {consenting} موافق على التسويق",
    counting: "بنعدّ…",
    sum_type: "{type} فقط",
    sum_include: "يحمل وسم {tags}",
    sum_exclude: "لا يحمل وسم {tags}",
    sum_minOrders: "{n} أوردرات فأكثر",
    sum_maxOrders: "حتى {n} أوردرات",
    sum_minSpent: "دفع {amount} فأكثر",
    sum_maxSpent: "دفع حتى {amount}",
    sum_older: "لم يطلب منذ {n} يوم",
    sum_within: "طلب خلال آخر {n} يوم",
    sum_gov: "في {list}",
    sum_products: "اشترى من {n} منتجات مختارة",
    sum_minRate: "نسبة استلام {n}% فأكثر",
    sum_maxRate: "نسبة استلام حتى {n}%",
    sum_consentYes: "موافق على التسويق",
    sum_consentNo: "غير موافق على التسويق",
    editNamed: "عدّل «{name}»",
    deleteNamed: "امسح «{name}»",
    anyShort: "الكل",
    otherProducts: "+{n} منتجات تانية مختارة",
    productsPickHint: "دوس على المنتج عشان تضيفه أو تشيله. بيظهر أول ١٠٠ منتج.",
  },
} satisfies Messages;

type T = (typeof STRINGS)["en"];

/** The rules as short phrases, for the segment card. */
function summarize(rules: SegmentRules, t: Record<keyof T, string>, typeLabel: (type: "lead" | "customer") => string, currency: string): string[] {
  const out: string[] = [];
  if (rules.type) out.push(fmt(t.sum_type, { type: typeLabel(rules.type) }));
  if (rules.includeTags?.length) out.push(fmt(t.sum_include, { tags: rules.includeTags.join("، ") }));
  if (rules.excludeTags?.length) out.push(fmt(t.sum_exclude, { tags: rules.excludeTags.join("، ") }));
  if (rules.minOrders !== undefined) out.push(fmt(t.sum_minOrders, { n: rules.minOrders }));
  if (rules.maxOrders !== undefined) out.push(fmt(t.sum_maxOrders, { n: rules.maxOrders }));
  if (rules.minSpent !== undefined) out.push(fmt(t.sum_minSpent, { amount: formatMoney(rules.minSpent, currency) }));
  if (rules.maxSpent !== undefined) out.push(fmt(t.sum_maxSpent, { amount: formatMoney(rules.maxSpent, currency) }));
  if (rules.lastOrderOlderThanDays !== undefined) out.push(fmt(t.sum_older, { n: rules.lastOrderOlderThanDays }));
  if (rules.lastOrderWithinDays !== undefined) out.push(fmt(t.sum_within, { n: rules.lastOrderWithinDays }));
  if (rules.governorates?.length) out.push(fmt(t.sum_gov, { list: rules.governorates.join("، ") }));
  if (rules.productIds?.length) out.push(fmt(t.sum_products, { n: rules.productIds.length }));
  if (rules.minDeliveryRate !== undefined) out.push(fmt(t.sum_minRate, { n: rules.minDeliveryRate }));
  if (rules.maxDeliveryRate !== undefined) out.push(fmt(t.sum_maxRate, { n: rules.maxDeliveryRate }));
  if (rules.marketingConsent === true) out.push(t.sum_consentYes);
  if (rules.marketingConsent === false) out.push(t.sum_consentNo);
  return out;
}

/** The round icon button of a segment card: 44px under a finger, 40px with a mouse. */
const ICON_BUTTON =
  "flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-ink/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-coarse:size-11";

/**
 * Contacts → Segments: saved filters, each a card with its live count, what it
 * filters by as small chips, and its actions — «عرض جهات الاتصال» (the list
 * under «الكل», filtered to it), edit and delete (also in the card's menu:
 * right-click or a long press). «شريحة جديدة» is the tab's one main action: in
 * the row from md up, in the bar above the dock on a phone. The editor is a
 * sheet over the cards.
 */
export function SegmentsTab({ onView }: { onView: (segmentId: string) => void }) {
  const t = useT(STRINGS);
  const c = useT(CONTACT_STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => segmentsList(apiClient, workspaceId), [workspaceId]);
  const segments = list.data ?? [];
  const [editing, setEditing] = useState<ContactSegment | "new" | null>(null);
  const [removing, setRemoving] = useState<ContactSegment | null>(null);

  async function confirmRemove() {
    if (!removing) return;
    try {
      await segmentsDelete(apiClient, workspaceId, removing.id);
    } catch (err) {
      throw new Error(errorMessage(err));
    }
    toast.success(t.deleted);
    setRemoving(null);
    void list.refresh({ silent: true });
  }

  const addButton = (
    <Button className="min-h-11 rounded-full px-5" onClick={() => setEditing("new")}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.add}
    </Button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-ink-soft">{t.intro}</p>
        {/* Only one of the two is displayed at any width. */}
        <div className="hidden md:block">{addButton}</div>
      </div>
      <PageActionBar>{addButton}</PageActionBar>

      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()} skeleton="tiles">
        {segments.length === 0 ? (
          <EmptyState
            icon={<IconFilter aria-hidden />}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={
              <Button className="min-h-11 rounded-full px-5" onClick={() => setEditing("new")}>
                <IconPlus className="size-4" weight="bold" aria-hidden />
                {t.add}
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {segments.map((segment) => {
              const phrases = summarize(segment.rules, t, (type) => c[`type_${type}`], currency);
              const menu: ContextMenuItem[] = [
                { id: "view", label: t.view, icon: IconPeople, onSelect: () => onView(segment.id) },
                { id: "edit", label: common.edit, icon: IconEdit, onSelect: () => setEditing(segment) },
                { id: "delete", label: common.delete, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setRemoving(segment) },
              ];
              return (
                <ContextMenu key={segment.id} items={menu} label={segment.name}>
                  <li className="zimos-crm-card flex flex-col rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 dir="auto" className="truncate text-base leading-6 font-semibold text-ink">
                          {segment.name}
                        </h3>
                        {segment.description && (
                          <p dir="auto" className="mt-0.5 text-sm leading-6 text-ink-soft">
                            {segment.description}
                          </p>
                        )}
                      </div>
                      {/* The live count: how many contacts match right now. */}
                      <div className="shrink-0 text-end">
                        <p className="zimos-segment-count inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-primary-soft px-3 text-lg leading-none font-semibold text-primary-dark tabular-nums dark:text-primary">
                          {fmt("{n}", { n: segment.contactsCount ?? 0 })}
                        </p>
                        <p className="mt-1 text-xs leading-4 text-ink-soft">{fmt(t.consenting, { count: segment.consentingCount ?? 0 })}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-1 flex-wrap content-start gap-1.5">
                      {(phrases.length ? phrases : [t.everyone]).map((phrase) => (
                        <span
                          key={phrase}
                          dir="auto"
                          className="zimos-contact-tag inline-flex min-h-6 items-center rounded-full bg-paper px-2.5 py-0.5 text-xs leading-5 text-ink ring-1 ring-line"
                        >
                          {phrase}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <Button variant="outline" className="min-h-11 flex-1 rounded-full px-4 sm:flex-none" onClick={() => onView(segment.id)}>
                        <IconPeople className="size-4" aria-hidden />
                        {t.view}
                      </Button>
                      <span className="ms-auto flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={fmt(t.editNamed, { name: segment.name })}
                          title={common.edit}
                          onClick={() => setEditing(segment)}
                          className={ICON_BUTTON}
                        >
                          <IconEdit className="size-5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label={fmt(t.deleteNamed, { name: segment.name })}
                          title={common.delete}
                          onClick={() => setRemoving(segment)}
                          className={cn(ICON_BUTTON, "hover:bg-danger-soft hover:text-danger")}
                        >
                          <IconDelete className="size-5" aria-hidden />
                        </button>
                      </span>
                    </div>
                  </li>
                </ContextMenu>
              );
            })}
          </ul>
        )}
      </DataState>

      <SegmentEditor
        segment={editing}
        currency={currency}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void list.refresh({ silent: true });
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title={removing ? fmt(t.deleteTitle, { name: removing.name }) : ""}
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

type TypeChoice = "any" | "lead" | "customer";
type ConsentChoice = "any" | "yes" | "no";

// The same pill as a chip of the row over a list (components/list/ChipRow.tsx): glass/list.css styles `.zimos-chip` once.
const PICK =
  "zimos-chip inline-flex h-10 max-w-full cursor-pointer items-center rounded-full px-3.5 text-sm font-medium select-none pointer-coarse:h-11 " +
  "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100";
const PICK_ON = "bg-primary text-primary-foreground";
const PICK_OFF = "bg-paper-raised text-ink ring-1 ring-line hover:bg-paper-sunken";

interface RuleForm {
  type: "" | "lead" | "customer";
  includeTags: string;
  excludeTags: string;
  minOrders: string;
  maxOrders: string;
  minSpent: string;
  maxSpent: string;
  olderThan: string;
  within: string;
  governorates: string;
  productIds: string[];
  minRate: string;
  maxRate: string;
  consent: "" | "yes" | "no";
}

function toForm(rules: SegmentRules): RuleForm {
  const n = (value: number | undefined) => (value === undefined ? "" : String(value));
  return {
    type: rules.type ?? "",
    includeTags: (rules.includeTags ?? []).join(", "),
    excludeTags: (rules.excludeTags ?? []).join(", "),
    minOrders: n(rules.minOrders),
    maxOrders: n(rules.maxOrders),
    minSpent: rules.minSpent === undefined ? "" : minorToMajorInput(rules.minSpent),
    maxSpent: rules.maxSpent === undefined ? "" : minorToMajorInput(rules.maxSpent),
    olderThan: n(rules.lastOrderOlderThanDays),
    within: n(rules.lastOrderWithinDays),
    governorates: (rules.governorates ?? []).join(", "),
    productIds: rules.productIds ?? [],
    minRate: n(rules.minDeliveryRate),
    maxRate: n(rules.maxDeliveryRate),
    consent: rules.marketingConsent === undefined ? "" : rules.marketingConsent ? "yes" : "no",
  };
}

function toRules(form: RuleForm): SegmentRules {
  const int = (text: string, max: number) => {
    const value = Math.floor(Number(text));
    return text.trim() === "" || !Number.isFinite(value) || value < 0 ? undefined : Math.min(value, max);
  };
  const days = (text: string) => {
    const value = int(text, 3650);
    return value === undefined || value < 1 ? undefined : value;
  };
  const list = (text: string) => {
    const items = text
      .split(/[,،\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length ? items : undefined;
  };
  const tags = (text: string) => {
    const items = parseTagInput(text);
    return items.length ? items : undefined;
  };
  const rules: SegmentRules = {
    type: form.type || undefined,
    includeTags: tags(form.includeTags),
    excludeTags: tags(form.excludeTags),
    minOrders: int(form.minOrders, 100000),
    maxOrders: int(form.maxOrders, 100000),
    minSpent: form.minSpent.trim() === "" ? undefined : majorToMinor(form.minSpent),
    maxSpent: form.maxSpent.trim() === "" ? undefined : majorToMinor(form.maxSpent),
    lastOrderOlderThanDays: days(form.olderThan),
    lastOrderWithinDays: days(form.within),
    governorates: list(form.governorates),
    productIds: form.productIds.length ? form.productIds : undefined,
    minDeliveryRate: int(form.minRate, 100),
    maxDeliveryRate: int(form.maxRate, 100),
    marketingConsent: form.consent === "" ? undefined : form.consent === "yes",
  };
  // Drop the keys that were left empty, so the stored rules stay readable.
  return Object.fromEntries(Object.entries(rules).filter(([, value]) => value !== undefined)) as SegmentRules;
}

/**
 * The segment editor, in a sheet: the name and a note, then the rules — every
 * field the modal had, saved by the same calls with the same payload. The line
 * that says how many contacts match now stays in sight while the rules change.
 */
function SegmentEditor({
  segment,
  currency,
  onClose,
  onSaved,
}: {
  segment: ContactSegment | "new" | null;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(STRINGS);
  const c = useT(CONTACT_STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const open = segment !== null;
  const existing = segment && segment !== "new" ? segment : null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [form, setForm] = useState<RuleForm>(() => toForm({}));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SegmentPreview | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const formId = useId();
  // Something was typed or chosen: a stray tap outside then asks before the sheet closes.
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? "");
    setDescription(existing?.description ?? "");
    setForm(toForm(existing?.rules ?? {}));
    setError(null);
    setPreview(null);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  useEffect(() => {
    if (!open || products.length) return;
    let cancelled = false;
    apiClient
      .listProducts(workspaceId, { limit: 100 })
      .then((result) => {
        if (!cancelled) setProducts(result.products);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId, products.length]);

  const rules = useMemo(() => toRules(form), [form]);
  const rulesKey = JSON.stringify(rules);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      segmentsPreview(apiClient, workspaceId, rules)
        .then((result) => {
          if (!cancelled) setPreview(result);
        })
        .catch(() => {
          if (!cancelled) setPreview(null);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspaceId, rulesKey]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { name: name.trim(), description: description.trim() || null, rules };
      if (existing) await segmentsUpdate(apiClient, workspaceId, existing.id, payload);
      else await segmentsCreate(apiClient, workspaceId, payload);
      toast.success(t.saved);
      onSaved();
    } catch (err) {
      setError(contactErrorCode(err) === "SEGMENT_NAME_TAKEN" ? c.segmentNameTaken : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const set = <K extends keyof RuleForm>(key: K, value: RuleForm[K]) => {
    setDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const number = (key: "minOrders" | "maxOrders" | "olderThan" | "within" | "minRate" | "maxRate", label: string, max?: number) => (
    <TextField label={label} type="number" inputMode="numeric" min={0} max={max} value={form[key]} onChange={(e) => set(key, e.target.value)} />
  );
  const toggleProduct = (id: string) =>
    set("productIds", form.productIds.includes(id) ? form.productIds.filter((other) => other !== id) : [...form.productIds, id]);
  // A product chosen earlier that is not among the first hundred still counts, and can still be let go of.
  const unknownProducts = form.productIds.filter((id) => !products.some((product) => product.id === id));

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={existing ? t.editTitle : t.createTitle}
      size="lg"
      dirty={dirty}
      busy={busy}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {common.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy || !name.trim()}>
            {busy ? common.saving : common.save}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t.name}
            required
            value={name}
            onChange={(e) => {
              setDirty(true);
              setName(e.target.value);
            }}
            maxLength={120}
          />
          <TextField
            label={t.description}
            value={description}
            onChange={(e) => {
              setDirty(true);
              setDescription(e.target.value);
            }}
            maxLength={300}
          />
        </div>

        {/* How many match right now: it stays in sight while the rules below change. */}
        <p
          role="status"
          className="zimos-segment-count sticky top-0 z-10 rounded-[0.875rem] bg-primary-soft px-3.5 py-2.5 text-sm leading-5 font-medium text-primary-dark tabular-nums dark:text-primary"
        >
          {preview ? fmt(t.matches, { total: preview.total, consenting: preview.consenting }) : t.counting}
        </p>

        <div>
          <h3 className="text-sm leading-5 font-semibold text-ink">{t.rules}</h3>
          <p className="mt-0.5 text-xs leading-5 text-ink-soft">{t.rulesHint}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-sm leading-5 font-medium text-ink">{t.type}</p>
            <Segmented<TypeChoice>
              label={t.type}
              size="sm"
              className="w-full"
              value={form.type || "any"}
              onChange={(next) => set("type", next === "any" ? "" : next)}
              options={[
                { value: "any", label: t.anyShort },
                { value: "customer", label: c.type_customer },
                { value: "lead", label: c.type_lead },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm leading-5 font-medium text-ink">{t.consent}</p>
            <Segmented<ConsentChoice>
              label={t.consent}
              size="sm"
              className="w-full"
              value={form.consent || "any"}
              onChange={(next) => set("consent", next === "any" ? "" : next)}
              options={[
                { value: "any", label: t.consentAny },
                { value: "yes", label: t.consentYes },
                { value: "no", label: t.consentNo },
              ]}
            />
          </div>
          <TextField label={t.includeTags} hint={t.tagsHint} value={form.includeTags} onChange={(e) => set("includeTags", e.target.value)} />
          <TextField label={t.excludeTags} hint={t.tagsHint} value={form.excludeTags} onChange={(e) => set("excludeTags", e.target.value)} />
          {number("minOrders", t.minOrders)}
          {number("maxOrders", t.maxOrders)}
          <TextField label={fmt(t.minSpent, { currency })} inputMode="decimal" dir="ltr" value={form.minSpent} onChange={(e) => set("minSpent", e.target.value)} />
          <TextField label={fmt(t.maxSpent, { currency })} inputMode="decimal" dir="ltr" value={form.maxSpent} onChange={(e) => set("maxSpent", e.target.value)} />
          {number("olderThan", t.olderThan, 3650)}
          {number("within", t.within, 3650)}
          {number("minRate", t.minRate, 100)}
          {number("maxRate", t.maxRate, 100)}
          <TextField
            className="sm:col-span-2"
            label={t.governorates}
            hint={t.governoratesHint}
            value={form.governorates}
            onChange={(e) => set("governorates", e.target.value)}
          />
          {(products.length > 0 || unknownProducts.length > 0) && (
            <div className="space-y-1.5 sm:col-span-2">
              <p className="text-sm leading-5 font-medium text-ink">{t.products}</p>
              {/* Pills to tap, instead of a list that needs Ctrl held down: the same ids are sent. */}
              <div role="group" aria-label={t.products} className="-m-1 flex max-h-48 flex-wrap gap-2 overflow-y-auto overscroll-contain p-1">
                {products.map((product) => {
                  const on = form.productIds.includes(product.id);
                  return (
                    <button key={product.id} type="button" aria-pressed={on} onClick={() => toggleProduct(product.id)} className={cn(PICK, on ? PICK_ON : PICK_OFF)}>
                      <bdi className="min-w-0 truncate">{product.name}</bdi>
                    </button>
                  );
                })}
                {unknownProducts.length > 0 && (
                  <button
                    type="button"
                    aria-pressed
                    onClick={() =>
                      set(
                        "productIds",
                        form.productIds.filter((id) => !unknownProducts.includes(id))
                      )
                    }
                    className={cn(PICK, PICK_ON)}
                  >
                    {fmt(t.otherProducts, { n: unknownProducts.length })}
                  </button>
                )}
              </div>
              <p className="text-xs leading-5 text-ink-soft">{t.productsPickHint}</p>
            </div>
          )}
        </div>
      </form>
    </FormSheet>
  );
}
