import { useState } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  storeDesignSaveLanguages,
  translationsList,
  translationsOverview,
  translationsSave,
  type StoreLocale,
  type TranslatableEntity,
  type TranslationItem,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { FilterTabs } from "@/components/FilterTabs";
import { Section } from "@/components/Section";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Languages",
    description: "Offer your store in more than one language. Shoppers switch language in the store; anything you have not translated shows in your store's own language.",
    yourLanguage: "Store language",
    offer: "Offer",
    done: "{pct}% translated",
    fields: "{done} of {total} names and descriptions",
    ar: "Arabic",
    en: "English",
    fr: "French",
    es: "Spanish",
    it: "Italian",
    de: "German",
    interfaceNote: "The store's own buttons and labels are available in Arabic and English today; other languages translate your products and collections.",
    translate: "Translate your content",
    translateDescription: "Write each name and description in the chosen language. Leave a box empty to keep the original.",
    language: "Language",
    products: "Products",
    collections: "Collections",
    kind: "What to translate",
    original: "Original",
    name: "Name",
    descriptionField: "Description",
    save: "Save",
    saved: "Translation saved.",
    languagesSaved: "Languages saved.",
    noLanguage: "Switch on another language above to start translating.",
    nothing: "Nothing to translate here yet.",
  },
  ar: {
    title: "اللغات",
    description: "اعرض متجرك بأكثر من لغة. المشتري يغيّر اللغة من المتجر؛ وما لم تترجمه يظهر بلغة متجرك الأصلية.",
    yourLanguage: "لغة المتجر",
    offer: "تفعيل",
    done: "تمت ترجمة {pct}%",
    fields: "{done} من {total} اسم ووصف",
    ar: "العربية",
    en: "الإنجليزية",
    fr: "الفرنسية",
    es: "الإسبانية",
    it: "الإيطالية",
    de: "الألمانية",
    interfaceNote: "أزرار وعناوين المتجر نفسها متاحة بالعربية والإنجليزية حاليًا؛ اللغات الأخرى تترجم منتجاتك وتصنيفاتك.",
    translate: "ترجمة محتواك",
    translateDescription: "اكتب كل اسم ووصف باللغة المختارة. اترك الخانة فارغة للإبقاء على الأصل.",
    language: "اللغة",
    products: "المنتجات",
    collections: "التصنيفات",
    kind: "ما الذي تترجمه",
    original: "الأصل",
    name: "الاسم",
    descriptionField: "الوصف",
    save: "حفظ",
    saved: "تم حفظ الترجمة.",
    languagesSaved: "تم حفظ اللغات.",
    noLanguage: "فعّل لغة أخرى بالأعلى لتبدأ الترجمة.",
    nothing: "لا يوجد ما يُترجم هنا بعد.",
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
  const [kind, setKind] = useState<TranslatableEntity>("product");

  const data = overview.data;
  const extra = (data?.languages ?? []).filter((l) => !l.isDefault);
  const active: StoreLocale | "" = extra.some((l) => l.locale === locale) ? locale : (extra[0]?.locale ?? "");

  async function toggle(code: StoreLocale, on: boolean) {
    if (!data) return;
    setBusy(true);
    try {
      const current = extra.map((l) => l.locale);
      const next = on ? [...new Set([...current, code])] : current.filter((l) => l !== code);
      await storeDesignSaveLanguages(apiClient, workspaceId, next);
      toast.success(t.languagesSaved);
      await overview.refresh({ silent: true });
      void refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DataState loading={overview.loading} error={overview.error} onRetry={() => void overview.refresh()}>
      {data && (
        <div className="space-y-5">
          <Section title={t.title} description={t.description}>
            <ul className="divide-y divide-line">
              {data.available.map((code) => {
                const row = data.languages.find((l) => l.locale === code);
                const isDefault = code === data.defaultLocale;
                return (
                  <li key={code} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        {t[code]}
                        {isDefault && <span className="ms-2 text-xs font-normal text-ink-soft">{t.yourLanguage}</span>}
                      </p>
                      {row && (
                        <>
                          <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-line" aria-hidden>
                            <div className="h-full rounded-full bg-primary" style={{ width: `${row.percent}%` }} />
                          </div>
                          <p className="mt-1 text-xs text-ink-soft">
                            {t.done.replace("{pct}", String(row.percent))} ·{" "}
                            {t.fields.replace("{done}", String(row.translatedFields)).replace("{total}", String(data.totalFields))}
                          </p>
                        </>
                      )}
                    </div>
                    {!isDefault && (
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          className="size-5 accent-primary"
                          checked={!!row}
                          disabled={busy}
                          onChange={(e) => void toggle(code, e.target.checked)}
                        />
                        {t.offer}
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-ink-soft">{t.interfaceNote}</p>
          </Section>

          <Section title={t.translate} description={t.translateDescription}>
            {active === "" ? (
              <Alert>{t.noLanguage}</Alert>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    aria-label={t.language}
                    className="w-auto"
                    value={active}
                    onChange={(e) => setLocale(e.target.value as StoreLocale)}
                  >
                    {extra.map((l) => (
                      <option key={l.locale} value={l.locale}>
                        {t[l.locale]}
                      </option>
                    ))}
                  </Select>
                  <FilterTabs
                    label={t.kind}
                    value={kind}
                    onChange={setKind}
                    tabs={[
                      { value: "product", label: t.products },
                      { value: "collection", label: t.collections },
                    ]}
                  />
                </div>
                <TranslationRows
                  key={`${active}:${kind}`}
                  locale={active}
                  kind={kind}
                  onSaved={() => void overview.refresh({ silent: true })}
                />
              </div>
            )}
          </Section>
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
                  <Button size="sm" disabled={!draft || saving === item.entityId} onClick={() => void save(item)}>
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
