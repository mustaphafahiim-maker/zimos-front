import { useId, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconArrowDown, IconArrowUp, IconCaretDown, IconDelete, IconDragHandle, IconEye, IconLock, IconPlus } from "@/components/icons";
import { Badge, Button, cn } from "@store-builder/ui";
import {
  CHECKOUT_FORM_CUSTOM_KEYS,
  CHECKOUT_FORM_LOCKED_KEYS,
  resolveCheckoutFormWithBilling,
  storeDesignSaveCheckoutFormWithBilling,
  type CheckoutFormFieldWithFile,
  type CheckoutFormLayout,
  type CheckoutFormWithBilling,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { AccordionSection } from "@/components/Accordion";
import { DataState } from "@/components/DataState";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { Textarea } from "@/components/Textarea";
import { ReadOnlyNotice, SettingsFormFooter } from "./SettingsFormFooter";
import { useSettingsEditor } from "./useSettingsEditor";
import { CheckoutConsentCard } from "./CheckoutConsentCard";
import { CheckoutFormMock } from "./sections/CheckoutFormMock";
import { InputRow, STACK, SelectRow, SettingsSkeleton, TOUCH_FIELDS } from "./sections/parts";

const STRINGS = {
  en: {
    tip: "The fewer the fields, the higher the sales.",
    fieldsTitle: "Form fields",
    fieldsDescription:
      "Choose what shoppers fill in, in which order, and what they must not skip. Name and mobile number are always asked.",
    full_name: "Full name",
    phone: "Mobile number",
    phone_alt: "Alternative number",
    email: "Email",
    country: "Country",
    government: "Governorate",
    city: "City / area",
    address: "Detailed address",
    postal_code: "Postal code",
    sa_national_address: "Saudi national address",
    note: "Order note",
    customField: "Custom field",
    shown: "Shown",
    required: "Required",
    always: "Always asked",
    moveUp: "Move up",
    moveDown: "Move down",
    edit: "Label and help text",
    remove: "Remove field",
    labelAr: "Label (Arabic)",
    labelEn: "Label (English)",
    labelHint: "Leave empty to use the store's built-in label.",
    helpAr: "Help text (Arabic)",
    helpEn: "Help text (English)",
    type: "Answer type",
    typeText: "Free text",
    typeChoice: "Choose from a list",
    typeFile: "Photo upload",
    typeFileHint: "Shoppers attach a photo (JPEG, PNG or WebP). It opens from the order page.",
    options: "Choices (one per line)",
    optionsHint: "A list field with no choices is not shown.",
    addCustom: "Add a custom field",
    customLimit: "You can add up to five custom fields.",
    customNeedsLabel: "Give every custom field a label before saving.",
    optionsTitle: "Form options",
    layout: "Where shoppers fill in the form",
    inline_on_product: "On the product page (fastest for one-product stores)",
    one_step: "On the checkout page only",
    allowCodes: "Discount codes",
    allowCodesHint: "Show the discount code box at checkout.",
    trust: "Trust badges",
    trustHint: "Show the cash-on-delivery, delivery and returns badges on product pages.",
    autoRegion: "Pre-select the shipping region",
    autoRegionHint: "Start the form on the region the shopper chose earlier.",
    autoVariant: "Pre-select a product variant",
    autoVariantHint: "Open product pages with the first available variant chosen.",
    billing: "Ask for a billing address",
    billingHint: "Shoppers whose invoice goes to another address can add it; it is the shipping address unless they untick it.",
    thankYouMessage: "Short thank-you message",
    thankYouMessageHint: "One line shown right after the order is placed. Leave empty for none.",
    saved: "Purchase form saved.",
    drag: "Reorder {name}: drag, or press Space and use the arrow keys",
    shownFor: "Show {name}",
    requiredFor: "{name} is required",
    reorderHint: "Drag a field by its handle to change the order.",
    picture: "The form's picture",
    pictureSummary: "See how the form looks with these settings",
    order: "Order",
  },
  ar: {
    tip: "كل ما الحقول تقل، المبيعات تزيد.",
    fieldsTitle: "حقول الفورم",
    fieldsDescription: "اختار العميل يملا إيه، بأنهي ترتيب، وإيه اللي مينفعش يتساب. الاسم ورقم الموبايل بيتطلبوا دايمًا.",
    full_name: "الاسم بالكامل",
    phone: "رقم الموبايل",
    phone_alt: "رقم بديل",
    email: "البريد الإلكتروني",
    country: "الدولة",
    government: "المحافظة",
    city: "المدينة / المنطقة",
    address: "العنوان بالتفصيل",
    postal_code: "الرمز البريدي",
    sa_national_address: "العنوان الوطني السعودي",
    note: "ملاحظة الطلب",
    customField: "حقل مخصص",
    shown: "ظاهر",
    required: "مطلوب",
    always: "بيتطلب دايمًا",
    moveUp: "حرّكه لفوق",
    moveDown: "حرّكه لتحت",
    edit: "العنوان والنص المساعد",
    remove: "امسح الحقل",
    labelAr: "العنوان (عربي)",
    labelEn: "العنوان (إنجليزي)",
    labelHint: "سيبه فاضي عشان يظهر العنوان الجاهز بتاع المتجر.",
    helpAr: "النص المساعد (عربي)",
    helpEn: "النص المساعد (إنجليزي)",
    type: "نوع الإجابة",
    typeText: "نص حر",
    typeChoice: "اختيار من قائمة",
    typeFile: "رفع صورة",
    typeFileHint: "العميل بيرفع صورة (JPEG أو PNG أو WebP) وبتفتحها من صفحة الأوردر.",
    options: "الاختيارات (اختيار في كل سطر)",
    optionsHint: "حقل القائمة من غير اختيارات مش بيظهر.",
    addCustom: "ضيف حقل مخصص",
    customLimit: "تقدر تضيف لحد خمس حقول مخصصة.",
    customNeedsLabel: "اكتب عنوان لكل حقل مخصص قبل ما تحفظ.",
    optionsTitle: "خيارات الفورم",
    layout: "العميل يملا الفورم فين",
    inline_on_product: "في صفحة المنتج (الأسرع لمتاجر المنتج الواحد)",
    one_step: "في صفحة الدفع بس",
    allowCodes: "أكواد الخصم",
    allowCodesHint: "اعرض خانة كود الخصم في صفحة الدفع.",
    trust: "شارات الثقة",
    trustHint: "اعرض شارات الدفع عند الاستلام والتوصيل والاسترجاع في صفحات المنتجات.",
    autoRegion: "اختار منطقة الشحن لوحده",
    autoRegionHint: "الفورم يبدأ بالمنطقة اللي العميل اختارها قبل كده.",
    autoVariant: "اختار نوع المنتج لوحده",
    autoVariantHint: "صفحة المنتج تفتح وأول نوع متاح متحدد.",
    billing: "اطلب عنوان الفاتورة",
    billingHint: "العميل اللي فاتورته على عنوان تاني يقدر يكتبه؛ ولو ما غيّرش حاجة بيبقى نفس عنوان الشحن.",
    thankYouMessage: "رسالة شكر قصيرة",
    thankYouMessageHint: "سطر واحد بيظهر أول ما الأوردر يتسجل. سيبه فاضي لو مش عايز.",
    saved: "اتحفظ فورم الطلب.",
    drag: "رتّب {name}: اسحبه، أو دوس مسافة وحرّكه بالأسهم",
    shownFor: "اعرض {name}",
    requiredFor: "{name} مطلوب",
    reorderHint: "اسحب الحقل من العلامة اللي في أوله عشان تغيّر الترتيب.",
    picture: "صورة الفورم",
    pictureSummary: "شوف شكل الفورم بالإعدادات دي",
    order: "الترتيب",
  },
} satisfies Messages;

const LAYOUTS: CheckoutFormLayout[] = ["inline_on_product", "one_step"];

/** The store's built-in name of a field in one language (the row shows the Arabic and the English one side by side). */
function builtInName(language: "ar" | "en", field: CheckoutFormFieldWithFile): string {
  const names = STRINGS[language] as Record<string, string>;
  return field.custom ? names.customField : (names[field.key] ?? field.key);
}

export function CheckoutFormTab() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const editor = useSettingsEditor<CheckoutFormWithBilling>(
    (settings) => resolveCheckoutFormWithBilling(settings.checkout_settings),
    (draft) => storeDesignSaveCheckoutFormWithBilling(apiClient, workspaceId, draft),
    t.saved
  );
  const { draft, setDraft, editable, saving } = editor;
  const [open, setOpen] = useState<string | null>(null);
  const locked = !editable || saving;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const patchField = (key: string, patch: Partial<CheckoutFormFieldWithFile>) =>
    setDraft((prev) => ({ ...prev, fields: prev.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)) }));

  // The order is the order of the array, as it always was: the buttons swap neighbours…
  function move(index: number, delta: number) {
    setDraft((prev) => {
      const fields = [...prev.fields];
      const target = index + delta;
      if (target < 0 || target >= fields.length) return prev;
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...prev, fields };
    });
  }

  // …and a drag lifts one field out and puts it down where it was dropped.
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    setDraft((prev) => {
      const from = prev.fields.findIndex((f) => f.key === active.id);
      const to = prev.fields.findIndex((f) => f.key === over.id);
      if (from === -1 || to === -1) return prev;
      return { ...prev, fields: arrayMove(prev.fields, from, to) };
    });
  }

  const freeCustomKey = CHECKOUT_FORM_CUSTOM_KEYS.find((key) => !draft.fields.some((f) => f.key === key));

  function addCustom() {
    if (!freeCustomKey) return;
    setDraft((prev) => ({
      ...prev,
      fields: [
        ...prev.fields,
        {
          key: freeCustomKey,
          label: { ar: "", en: "" },
          helpText: { ar: "", en: "" },
          position: prev.fields.length + 1,
          enabled: true,
          required: false,
          custom: true,
          type: "text",
          options: [],
        },
      ],
    }));
    setOpen(freeCustomKey);
  }

  const nameOf = (f: CheckoutFormFieldWithFile) =>
    f.label[locale] || f.label.ar || f.label.en || (f.custom ? t.customField : t[f.key as keyof typeof t]);
  const unlabelledCustom = draft.fields.some((f) => f.custom && !f.label.ar && !f.label.en);

  return (
    <DataState loading={!editor.ready} error={null} skeleton={<SettingsSkeleton groups={2} rows={5} />}>
      <div className={STACK}>
        <ReadOnlyNotice editable={editable} />

        {/* The list, and beside it on a wide screen a still picture of the form it makes. */}
        <div className="grid min-w-0 items-start gap-[var(--bento-gap)] xl:grid-cols-[minmax(0,1fr)_13.5rem]">
          <SettingsGroup
            title={t.fieldsTitle}
            description={t.fieldsDescription}
            footer={
              <>
                <span className="block">{t.tip}</span>
                {editable && <span className="block">{t.reorderHint}</span>}
              </>
            }
          >
            <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onDragEnd}>
              <SortableContext items={draft.fields.map((f) => f.key)} strategy={verticalListSortingStrategy}>
                <ul role="list">
                  {draft.fields.map((f, index) => (
                    <FieldRow
                      key={f.key}
                      field={f}
                      index={index}
                      count={draft.fields.length}
                      expanded={open === f.key}
                      locked={locked}
                      onToggleOpen={() => setOpen(open === f.key ? null : f.key)}
                      onPatch={(patch) => patchField(f.key, patch)}
                      onMove={(delta) => move(index, delta)}
                      onRemove={() => setDraft((prev) => ({ ...prev, fields: prev.fields.filter((x) => x.key !== f.key) }))}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>

            {editable && (
              <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
                <Button variant="outline" className="min-h-11 rounded-full px-4 sm:min-h-9" disabled={saving || !freeCustomKey} onClick={addCustom}>
                  <IconPlus className="size-4" aria-hidden />
                  {t.addCustom}
                </Button>
                {!freeCustomKey && <span className="text-[13px] text-ink-soft">{t.customLimit}</span>}
              </div>
            )}
          </SettingsGroup>

          <CheckoutFormMock form={draft} nameOf={nameOf} className="sticky top-24 hidden xl:block" />
        </div>

        {/* Narrower screens: the same picture, one tap away. */}
        <AccordionSection title={t.picture} summary={t.pictureSummary} icon={IconEye} persistKey="store-settings:checkout:picture" className="xl:hidden">
          <CheckoutFormMock form={draft} nameOf={nameOf} className="mx-auto max-w-xs" />
        </AccordionSection>

        <SettingsGroup title={t.optionsTitle}>
          <SelectRow
            label={t.layout}
            stacked
            value={draft.layout}
            disabled={locked}
            onChange={(e) => setDraft((prev) => ({ ...prev, layout: e.target.value as CheckoutFormLayout }))}
          >
            {LAYOUTS.map((layout) => (
              <option key={layout} value={layout}>
                {t[layout]}
              </option>
            ))}
          </SelectRow>
          <SettingsSwitch
            label={t.allowCodes}
            hint={t.allowCodesHint}
            checked={draft.allow_discount_codes}
            disabled={locked}
            onChange={(v) => setDraft((prev) => ({ ...prev, allow_discount_codes: v }))}
          />
          <SettingsSwitch
            label={t.trust}
            hint={t.trustHint}
            checked={draft.show_trust_badges}
            disabled={locked}
            onChange={(v) => setDraft((prev) => ({ ...prev, show_trust_badges: v }))}
          />
          <SettingsSwitch
            label={t.autoRegion}
            hint={t.autoRegionHint}
            checked={draft.auto_select_region}
            disabled={locked}
            onChange={(v) => setDraft((prev) => ({ ...prev, auto_select_region: v }))}
          />
          <SettingsSwitch
            label={t.autoVariant}
            hint={t.autoVariantHint}
            checked={draft.auto_select_variant}
            disabled={locked}
            onChange={(v) => setDraft((prev) => ({ ...prev, auto_select_variant: v }))}
          />
          <SettingsSwitch
            label={t.billing}
            hint={t.billingHint}
            checked={draft.billing_address === "on"}
            disabled={locked}
            onChange={(v) => setDraft((prev) => ({ ...prev, billing_address: v ? "on" : "off" }))}
          />
          <InputRow
            label={t.thankYouMessage}
            hint={t.thankYouMessageHint}
            stacked
            dir="auto"
            maxLength={500}
            disabled={locked}
            value={draft.thank_you_message ?? ""}
            onChange={(e) => setDraft((prev) => ({ ...prev, thank_you_message: e.target.value }))}
          />
        </SettingsGroup>

        {/* The marketing and terms boxes of the checkout (handoff 374): saved on their own. */}
        <CheckoutConsentCard key={workspaceId} />

        <SettingsFormFooter
          editable={editable}
          dirty={editor.dirty}
          saving={saving}
          error={editor.error}
          // A custom field without a name cannot be saved: the edits stay unsaved, and the bar says why.
          blocked={unlabelledCustom ? t.customNeedsLabel : null}
          onSave={() => void editor.save()}
          onReset={editor.reset}
        />
      </div>
    </DataState>
  );
}

/** A small switch with its word beside it, for the two per-field settings on a row. 44px to the thumb. */
function MiniSwitch({
  label,
  name,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  /** Read out instead of the bare word: «اعرض المحافظة». */
  name: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={cn("relative inline-flex min-h-11 items-center gap-2 select-none", disabled ? "cursor-default" : "cursor-pointer")}>
      <input
        type="checkbox"
        role="switch"
        aria-label={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-6 w-10 shrink-0 rounded-full bg-line-strong transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:opacity-50 after:absolute after:start-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow-[0_1px_3px_rgb(0_0_0/0.3)] after:transition-transform after:duration-[var(--dur-pop)] after:ease-[var(--ease-pop)] after:content-[''] peer-checked:after:translate-x-4 motion-reduce:transition-none motion-reduce:after:transition-none rtl:peer-checked:after:-translate-x-4"
      />
      <span aria-hidden className="text-[13px] font-medium text-ink peer-disabled:text-ink-soft">
        {label}
      </span>
    </label>
  );
}

/**
 * One field of the order form: a handle to drag it by, its name in Arabic and
 * in English side by side (press to open its label and help text), and its
 * two switches — shown, required — on the row. Name and mobile number are
 * always asked: a lock stands where their switches would be.
 */
function FieldRow({
  field: f,
  index,
  count,
  expanded,
  locked,
  onToggleOpen,
  onPatch,
  onMove,
  onRemove,
}: {
  field: CheckoutFormFieldWithFile;
  index: number;
  count: number;
  expanded: boolean;
  locked: boolean;
  onToggleOpen: () => void;
  onPatch: (patch: Partial<CheckoutFormFieldWithFile>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const panelId = useId();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: f.key,
    disabled: locked,
  });
  const fixed = CHECKOUT_FORM_LOCKED_KEYS.includes(f.key);
  const arName = f.label.ar || builtInName("ar", f);
  const enName = f.label.en || builtInName("en", f);
  const name = locale === "ar" ? arName : enName;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative border-t border-line first:border-t-0",
        // The lifted row is a card of its own over the list.
        isDragging && "z-10 rounded-[1rem] border-transparent bg-paper-raised shadow-[var(--shadow-raised)] ring-1 ring-line"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0 py-1 ps-1 pe-3">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          disabled={locked}
          aria-label={fmt(t.drag, { name })}
          title={t.order}
          className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
        >
          <IconDragHandle className="size-5" aria-hidden />
        </button>

        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-h-11 min-w-0 flex-1 basis-48 cursor-pointer items-center gap-2 rounded-[0.75rem] text-start focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span lang="ar" dir="rtl" className={cn("truncate text-sm font-medium", f.enabled ? "text-ink" : "text-ink-soft")}>
              {arName}
            </span>
            <span aria-hidden className="text-ink-soft">
              ·
            </span>
            <span lang="en" dir="ltr" className="truncate text-[13px] text-ink-soft">
              {enName}
            </span>
          </span>
          {f.custom && (
            <Badge variant="secondary" className="shrink-0">
              {t.customField}
            </Badge>
          )}
          <IconCaretDown
            className={cn("size-4 shrink-0 text-ink-soft transition-transform duration-[var(--dur-fade)] motion-reduce:transition-none", expanded && "rotate-180")}
            weight="bold"
            aria-hidden
          />
          <span className="sr-only">{t.edit}</span>
        </button>

        {fixed ? (
          <span className="flex min-h-11 shrink-0 items-center gap-1.5 ps-11 text-[13px] text-ink-soft sm:ps-2">
            <IconLock className="size-3.5" aria-hidden />
            {t.always}
          </span>
        ) : (
          <div className="flex shrink-0 items-center gap-4 ps-11 sm:ps-2">
            <MiniSwitch
              label={t.shown}
              name={fmt(t.shownFor, { name })}
              checked={f.enabled}
              disabled={locked}
              onChange={(enabled) => onPatch({ enabled, required: enabled && f.required })}
            />
            {f.key !== "note" && (
              <MiniSwitch
                label={t.required}
                name={fmt(t.requiredFor, { name })}
                checked={f.required}
                disabled={locked || !f.enabled}
                onChange={(required) => onPatch({ required })}
              />
            )}
          </div>
        )}
      </div>

      {expanded && (
        <div id={panelId} className={`mx-3 mb-3 space-y-3 rounded-[1rem] bg-paper-sunken p-3 ${TOUCH_FIELDS}`}>
          {/* Arabic and English side by side, at every width: the two names are one decision. */}
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t.labelAr}
              dir="rtl"
              lang="ar"
              maxLength={80}
              placeholder={builtInName("ar", f)}
              value={f.label.ar}
              disabled={locked}
              onChange={(e) => onPatch({ label: { ...f.label, ar: e.target.value } })}
            />
            <TextField
              label={t.labelEn}
              dir="ltr"
              lang="en"
              maxLength={80}
              placeholder={builtInName("en", f)}
              value={f.label.en}
              disabled={locked}
              onChange={(e) => onPatch({ label: { ...f.label, en: e.target.value } })}
            />
          </div>
          {!f.custom && <p className="text-xs text-ink-soft">{t.labelHint}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label={t.helpAr}
              dir="rtl"
              lang="ar"
              maxLength={200}
              value={f.helpText.ar}
              disabled={locked}
              onChange={(e) => onPatch({ helpText: { ...f.helpText, ar: e.target.value } })}
            />
            <TextField
              label={t.helpEn}
              dir="ltr"
              lang="en"
              maxLength={200}
              value={f.helpText.en}
              disabled={locked}
              onChange={(e) => onPatch({ helpText: { ...f.helpText, en: e.target.value } })}
            />
          </div>
          {f.custom && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t.type} hint={f.type === "file" ? t.typeFileHint : undefined}>
                {({ id }) => (
                  <Select
                    id={id}
                    value={f.type ?? "text"}
                    disabled={locked}
                    onChange={(e) =>
                      onPatch({
                        type: e.target.value === "choice" ? "choice" : e.target.value === "file" ? "file" : "text",
                      })
                    }
                  >
                    <option value="text">{t.typeText}</option>
                    <option value="choice">{t.typeChoice}</option>
                    <option value="file">{t.typeFile}</option>
                  </Select>
                )}
              </Field>
              {f.type === "choice" && (
                <Field label={t.options} hint={t.optionsHint}>
                  {({ id }) => (
                    <Textarea
                      id={id}
                      rows={4}
                      dir="auto"
                      disabled={locked}
                      value={(f.options ?? []).join("\n")}
                      onChange={(e) => onPatch({ options: e.target.value.split("\n").slice(0, 20) })}
                    />
                  )}
                </Field>
              )}
            </div>
          )}

          {/* The order without dragging, and — for a field the merchant added — the way to remove it. */}
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <Button variant="outline" className="min-h-11 rounded-full px-4 sm:min-h-9" disabled={locked || index === 0} onClick={() => onMove(-1)}>
              <IconArrowUp className="size-4" aria-hidden />
              {t.moveUp}
            </Button>
            <Button variant="outline" className="min-h-11 rounded-full px-4 sm:min-h-9" disabled={locked || index === count - 1} onClick={() => onMove(1)}>
              <IconArrowDown className="size-4" aria-hidden />
              {t.moveDown}
            </Button>
            {f.custom && (
              <Button variant="ghost" className="ms-auto min-h-11 rounded-full px-4 text-danger hover:bg-danger-soft hover:text-danger sm:min-h-9" disabled={locked} onClick={onRemove}>
                <IconDelete className="size-4" aria-hidden />
                {t.remove}
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
