import { useState } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  storeDesignSaveLanguages,
  translationsList,
  translationsOverview,
  translationsSave,
  type ContentEntity,
  type StoreLocale,
  type TranslatableEntity,
  type TranslationItem,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { IconLanguage } from "@/components/icons";
import { AccordionSection } from "@/components/Accordion";
import { DataState } from "@/components/DataState";
import { FilterTabs } from "@/components/FilterTabs";
import { Select } from "@/components/Select";
import { SettingsGroup, SettingsRow, SettingsSwitch } from "@/components/settings";
import { useReportDirty, useUnsavedGuard } from "@/lib/useUnsavedGuard";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { ContentTranslationRows } from "./ContentTranslationRows";
import { AiTranslateButton } from "./AiTranslateButton";
import { STACK, SettingsSkeleton } from "./sections/parts";

const STRINGS = {
  en: {
    title: "Languages",
    description: "Offer your store in more than one language. Shoppers switch language in the store; anything you have not translated shows in your store's own language.",
    yourLanguage: "Store language",
    offer: "Offer",
    done: "{pct}% translated",
    fields: "{done} of {total} texts",
    ar: "Arabic",
    en: "English",
    fr: "French",
    es: "Spanish",
    it: "Italian",
    de: "German",
    interfaceNote: "The store's own buttons and labels are available in Arabic and English today; other languages translate your products, collections, pages and funnels.",
    translate: "Translate your content",
    translateDescription: "Write each text in the chosen language. Leave a box empty to keep the original. Pages and funnels show what is published.",
    language: "Language",
    products: "Products",
    collections: "Collections",
    pages: "Pages",
    funnels: "Funnels",
    productDetails: "Product details",
    storeTexts: "Store texts",
    kind: "What to translate",
    original: "Original",
    name: "Name",
    descriptionField: "Description",
    save: "Save",
    saved: "Translation saved.",
    languagesSaved: "Languages saved.",
    noLanguage: "Switch on another language above to start translating.",
    nothing: "Nothing to translate here yet.",
    progress: "{pct}% translated · {done} of {total} texts",
    translateSummary: "Into {language}: products, collections, pages, funnels and store texts",
  },
  ar: {
    title: "اللغات",
    description: "اعرض متجرك بأكثر من لغة. المشتري يغيّر اللغة من المتجر؛ وما لم تترجمه يظهر بلغة متجرك الأصلية.",
    yourLanguage: "لغة المتجر",
    offer: "تفعيل",
    done: "تمت ترجمة {pct}%",
    fields: "{done} من {total} نص",
    ar: "العربية",
    en: "الإنجليزية",
    fr: "الفرنسية",
    es: "الإسبانية",
    it: "الإيطالية",
    de: "الألمانية",
    interfaceNote: "أزرار وعناوين المتجر نفسها متاحة بالعربية والإنجليزية حاليًا؛ اللغات الأخرى تترجم منتجاتك وتصنيفاتك وصفحاتك ومسارات البيع.",
    translate: "ترجمة محتواك",
    translateDescription: "اكتب كل نص باللغة المختارة. اترك الخانة فارغة للإبقاء على الأصل. الصفحات ومسارات البيع بتظهر زي ما هي منشورة.",
    language: "اللغة",
    products: "المنتجات",
    collections: "التصنيفات",
    pages: "الصفحات",
    funnels: "مسارات البيع",
    productDetails: "تفاصيل المنتجات",
    storeTexts: "نصوص المتجر",
    kind: "ما الذي تترجمه",
    original: "الأصل",
    name: "الاسم",
    descriptionField: "الوصف",
    save: "حفظ",
    saved: "اتحفظت الترجمة.",
    languagesSaved: "تم حفظ اللغات.",
    noLanguage: "فعّل لغة أخرى بالأعلى لتبدأ الترجمة.",
    nothing: "مفيش حاجة تتترجم هنا لسه.",
    progress: "اتترجم {pct}% · {done} من {total} نص",
    translateSummary: "لـ{language}: المنتجات والتصنيفات والصفحات ومسارات البيع ونصوص المتجر",
  },
} satisfies Messages;

export function LanguagesTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { refresh } = useWorkspace();
  const overview = useAsync(() => translationsOverview(apiClient, workspaceId), [workspaceId]);
  const [busy, setBusy] = useState(false);
  const [locale, setLocale] = useState<StoreLocale | "">("");
  const [kind, setKind] = useState<TranslatableEntity | ContentEntity>("product");
  // Bumped after an AI fill, so the rows below read their translations again.
  const [version, setVersion] = useState(0);

  const data = overview.data;
  const extra = (data?.languages ?? []).filter((l) => !l.isDefault);
  const active: StoreLocale | "" = extra.some((l) => l.locale === locale) ? locale : (extra[0]?.locale ?? "");

  // Changing the language or the kind of content swaps the rows below: with a translation typed and not saved, ask first.
  const { confirmLeave } = useUnsavedGuard();
  async function changeLocale(next: StoreLocale) {
    if (next !== active && (await confirmLeave())) setLocale(next);
  }
  async function changeKind(next: TranslatableEntity | ContentEntity) {
    if (next !== kind && (await confirmLeave())) setKind(next);
  }

  /** Saves at once, as before; `undoable` offers to take it back (the same save with the language put back). */
  async function toggle(code: StoreLocale, on: boolean, undoable = true) {
    if (!data) return;
    setBusy(true);
    try {
      const current = extra.map((l) => l.locale);
      const next = on ? [...new Set([...current, code])] : current.filter((l) => l !== code);
      await storeDesignSaveLanguages(apiClient, workspaceId, next);
      if (undoable) toast.undo(t.languagesSaved, () => toggle(code, !on, false));
      else toast.success(t.languagesSaved);
      await overview.refresh({ silent: true });
      void refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DataState loading={overview.loading} error={overview.error} onRetry={() => void overview.refresh()} skeleton={<SettingsSkeleton groups={1} rows={6} />}>
      {data && (
        <div className={STACK}>
          {/* Each language is a switch that saves at once; an offered one says how much of the store is translated. */}
          <SettingsGroup description={t.description} footer={t.interfaceNote}>
            {data.available.map((code) => {
              const row = data.languages.find((l) => l.locale === code);
              const progress = row ? fmt(t.progress, { pct: row.percent, done: row.translatedFields, total: data.totalFields }) : undefined;
              if (code === data.defaultLocale) {
                return (
                  <SettingsRow
                    key={code}
                    label={t[code]}
                    hint={progress}
                    control={<span className="text-sm text-ink-soft">{t.yourLanguage}</span>}
                  />
                );
              }
              return (
                <SettingsSwitch
                  key={code}
                  label={t[code]}
                  hint={progress}
                  checked={!!row}
                  disabled={busy}
                  onChange={(on) => void toggle(code, on)}
                />
              );
            })}
          </SettingsGroup>

          {/* The long part: folded once it is known, and kept mounted so a translation being typed survives a fold. */}
          <AccordionSection
            title={t.translate}
            icon={IconLanguage}
            summary={active === "" ? t.noLanguage : fmt(t.translateSummary, { language: t[active] })}
            defaultOpen={active !== ""}
            persistKey="store-settings:languages:translate"
            keepMounted
          >
            <p className="mb-3 text-[13px] leading-5 text-ink-soft">{t.translateDescription}</p>
            {active === "" ? (
              <Alert>{t.noLanguage}</Alert>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    aria-label={t.language}
                    className="min-h-11 w-auto text-base sm:text-sm"
                    value={active}
                    onChange={(e) => void changeLocale(e.target.value as StoreLocale)}
                  >
                    {extra.map((l) => (
                      <option key={l.locale} value={l.locale}>
                        {t[l.locale]}
                      </option>
                    ))}
                  </Select>
                  <AiTranslateButton
                    locale={active}
                    kind={kind}
                    onDone={() => {
                      setVersion((v) => v + 1);
                      void overview.refresh({ silent: true });
                    }}
                  />
                </div>
                {/* Six kinds of content on one line that scrolls by itself on a phone, never the page. */}
                <div className="-mx-1 max-w-full overflow-x-auto px-1 pb-1">
                  <FilterTabs
                    label={t.kind}
                    value={kind}
                    onChange={(next) => void changeKind(next)}
                    className="flex-nowrap"
                    buttonClassName="min-h-11 whitespace-nowrap sm:min-h-9"
                    tabs={[
                      { value: "product", label: t.products },
                      { value: "collection", label: t.collections },
                      { value: "page", label: t.pages },
                      { value: "funnel", label: t.funnels },
                      { value: "product_details", label: t.productDetails },
                      { value: "store_text", label: t.storeTexts },
                    ]}
                  />
                </div>
                {kind !== "product" && kind !== "collection" ? (
                  <ContentTranslationRows
                    key={`${active}:${kind}:${version}`}
                    locale={active}
                    kind={kind}
                    onSaved={() => void overview.refresh({ silent: true })}
                  />
                ) : (
                  <TranslationRows
                    key={`${active}:${kind}:${version}`}
                    locale={active}
                    kind={kind}
                    onSaved={() => void overview.refresh({ silent: true })}
                  />
                )}
              </div>
            )}
          </AccordionSection>
        </div>
      )}
    </DataState>
  );
}

function TranslationRows({ locale, kind, onSaved }: { locale: StoreLocale; kind: TranslatableEntity; onSaved: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const items = useAsync(() => translationsList(apiClient, workspaceId, kind, locale), [workspaceId, kind, locale]);
  const [drafts, setDrafts] = useState<Record<string, { name?: string; description?: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  // A translation typed and not saved yet: a switch of section, language or kind asks first.
  useReportDirty(Object.keys(drafts).length > 0);

  async function save(item: TranslationItem) {
    const draft = drafts[item.entityId];
    if (!draft) return;
    setSaving(item.entityId);
    try {
      const saved = await translationsSave(apiClient, workspaceId, { entityType: kind, entityId: item.entityId, locale, fields: draft });
      if (saved) items.setData((prev) => (prev ?? []).map((i) => (i.entityId === saved.entityId ? saved : i)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[item.entityId];
        return next;
      });
      toast.success(t.saved);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <DataState
      loading={items.loading}
      error={items.error}
      empty={(items.data ?? []).length === 0}
      emptyMessage={t.nothing}
      onRetry={() => void items.refresh()}
    >
      <ul className="divide-y divide-line">
        {(items.data ?? []).map((item) => {
          const draft = drafts[item.entityId];
          const value = (field: "name" | "description") => draft?.[field] ?? item.translation[field];
          const edit = (field: "name" | "description", text: string) =>
            setDrafts((prev) => ({ ...prev, [item.entityId]: { ...prev[item.entityId], [field]: text } }));
          return (
            <li key={item.entityId} className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{t.original}</p>
                <p className="mt-1 text-sm font-medium text-ink" dir="auto">
                  {item.source.name}
                </p>
                {item.source.description && (
                  <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-ink-soft" dir="auto">
                    {item.source.description}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Input
                  aria-label={`${t.name} — ${item.source.name}`}
                  placeholder={t.name}
                  dir="auto"
                  maxLength={300}
                  value={value("name")}
                  onChange={(e) => edit("name", e.target.value)}
                />
                {item.source.description && (
                  <Textarea
                    aria-label={`${t.descriptionField} — ${item.source.name}`}
                    placeholder={t.descriptionField}
                    dir="auto"
                    rows={3}
                    value={value("description")}
                    onChange={(e) => edit("description", e.target.value)}
                  />
                )}
                <div className="flex justify-end">
                  <Button className="min-h-11 rounded-full px-5 sm:min-h-9" disabled={!draft || saving === item.entityId} onClick={() => void save(item)}>
                    {t.save}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </DataState>
  );
}
