import { useMemo, useState, type FormEvent } from "react";
import { ChevronLeft, Download, Eye, EyeOff, FileUp, MapPinned, Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import {
  storePlacesCopyPlatform,
  storePlacesCreate,
  storePlacesDelete,
  storePlacesImport,
  storePlacesList,
  storePlacesSavePrices,
  storePlacesUpdate,
  type StorePlace,
  type StorePlaceImportResult,
  type StorePlaceLevel,
  type StorePlaceList,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Places",
    description: "Your own list of regions, cities and areas. The checkout asks the customer to pick from it, and each place can have its own shipping price.",
    country: "Country",
    EG: "Egypt",
    SA: "Saudi Arabia",
    counts: "{regions} regions · {cities} cities · {areas} areas",
    region: "Region",
    city: "City",
    area: "Area",
    regions: "Regions",
    cities: "Cities",
    areas: "Areas",
    addRegion: "Add region",
    addCity: "Add city",
    addArea: "Add area",
    nameAr: "Name in Arabic",
    nameEn: "Name in English (optional)",
    add: "Add",
    importSheet: "Import sheet",
    fromPlatform: "Start from the platform list",
    copied: "{n} places added from the platform list.",
    emptyTitle: "No places yet",
    emptyBody: "Import a sheet or start from the platform list, then add your areas and their shipping prices.",
    pickRegion: "Pick a region to see its cities.",
    pickCity: "Pick a city to see its areas.",
    noneHere: "Nothing here yet.",
    shippingPrice: "Shipping price",
    usesParent: "Uses {name}'s price",
    usesGovernorate: "Uses the governorate price",
    hidden: "Hidden from checkout",
    hide: "Hide from checkout",
    show: "Show at checkout",
    rename: "Rename",
    delete: "Delete",
    deleteTitle: "Delete {name}?",
    deleteRegion: "Deleting a region deletes its cities and areas.",
    deleteCity: "Deleting a city deletes its areas.",
    deleteArea: "The area is removed from the checkout list.",
    renameTitle: "Rename {name}",
    save: "Save",
    pricesChanged: "{n} prices changed",
    savePrices: "Save prices",
    discard: "Discard",
    pricesSaved: "Prices saved",
    badPrice: "Type a price like 45 or 45.50, or leave it empty.",
    back: "Back",
    importTitle: "Import places from a sheet",
    importHint: "A CSV or Excel file (up to 2MB, 5000 rows) with the columns region_ar, region_en, city_ar, city_en, area_ar, area_en and, optionally, shipping (the price of the row's deepest place, e.g. 45).",
    sample: "Download a sample sheet",
    file: "File",
    merge: "Add to the list",
    replace: "Replace the list",
    replaceWarn: "Replace deletes every place of this country first.",
    importNow: "Import",
    importing: "Importing…",
    imported: "{created} places added, {priced} prices set.",
    rowErrors: "Rows that were skipped",
    row: "Row {n}",
    close: "Close",
    max: "Up to {n} places per country",
  },
  ar: {
    title: "المناطق",
    description: "قايمة المحافظات والمدن والمناطق بتاعتك. صفحة الطلب بتخلّي العميل يختار منها، وكل منطقة ممكن يبقى ليها سعر شحن لوحدها.",
    country: "الدولة",
    EG: "مصر",
    SA: "السعودية",
    counts: "{regions} محافظة · {cities} مدينة · {areas} منطقة",
    region: "المحافظة",
    city: "المدينة",
    area: "المنطقة",
    regions: "المحافظات",
    cities: "المدن",
    areas: "المناطق",
    addRegion: "إضافة محافظة",
    addCity: "إضافة مدينة",
    addArea: "إضافة منطقة",
    nameAr: "الاسم بالعربي",
    nameEn: "الاسم بالإنجليزي (اختياري)",
    add: "ضيف",
    importSheet: "استيراد شيت",
    fromPlatform: "ابدأ من قائمة المنصة",
    copied: "اتضاف {n} مكان من قائمة المنصة.",
    emptyTitle: "مفيش مناطق لسه",
    emptyBody: "استورد شيت أو ابدأ من قائمة المنصة، وبعدين ضيف مناطقك وأسعار الشحن بتاعتها.",
    pickRegion: "اختار محافظة عشان تشوف مدنها.",
    pickCity: "اختار مدينة عشان تشوف مناطقها.",
    noneHere: "لسه مفيش حاجة هنا.",
    shippingPrice: "سعر الشحن",
    usesParent: "بياخد سعر {name}",
    usesGovernorate: "بياخد سعر المحافظة",
    hidden: "مخفية من صفحة الطلب",
    hide: "اخفيها من صفحة الطلب",
    show: "اظهرها في صفحة الطلب",
    rename: "تغيير الاسم",
    delete: "حذف",
    deleteTitle: "حذف {name}؟",
    deleteRegion: "حذف المحافظة بيحذف مدنها ومناطقها.",
    deleteCity: "حذف المدينة بيحذف مناطقها.",
    deleteArea: "المنطقة هتتشال من قايمة صفحة الطلب.",
    renameTitle: "تغيير اسم {name}",
    save: "حفظ",
    pricesChanged: "{n} سعر اتغيّر",
    savePrices: "احفظ الأسعار",
    discard: "تجاهل",
    pricesSaved: "الأسعار اتحفظت",
    badPrice: "اكتب سعر زي 45 أو 45.50، أو سيبه فاضي.",
    back: "رجوع",
    importTitle: "استيراد المناطق من شيت",
    importHint: "ملف CSV أو Excel (لحد 2 ميجا و5000 صف) فيه الأعمدة region_ar و region_en و city_ar و city_en و area_ar و area_en، واختياري shipping (سعر شحن آخر مكان في الصف، زي 45).",
    sample: "نزّل شيت مثال",
    file: "الملف",
    merge: "إضافة للقائمة",
    replace: "استبدال القائمة",
    replaceWarn: "الاستبدال بيمسح كل مناطق الدولة دي الأول.",
    importNow: "استورد",
    importing: "بنستورد…",
    imported: "اتضاف {created} مكان، واتحدد {priced} سعر.",
    rowErrors: "صفوف اتسابت",
    row: "صف {n}",
    close: "إغلاق",
    max: "لحد {n} مكان لكل دولة",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

const COUNTRIES = ["EG", "SA"] as const;

const SAMPLE_CSV =
  "region_ar,region_en,city_ar,city_en,area_ar,area_en,shipping\n" +
  "القاهرة,Cairo,مدينة نصر,Nasr City,الحي العاشر,10th District,45\n" +
  "القاهرة,Cairo,مدينة نصر,Nasr City,مكرم عبيد,Makram Ebeid,45\n" +
  "الجيزة,Giza,الدقي,Dokki,,,50\n";

/**
 * Shipping → Places (frontend-handoff 163 + 164): the store's own regions →
 * cities → areas, each with an optional shipping price. Three columns on a
 * wide screen; on a phone one level at a time with a way back. Prices are
 * typed inline and saved together.
 */
export function StorePlacesSection() {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";

  const [country, setCountry] = useState<(typeof COUNTRIES)[number]>("EG");
  const list = useAsync<StorePlaceList>(() => storePlacesList(apiClient, workspaceId, country), [workspaceId, country]);
  const places = list.data?.places ?? [];

  const [regionId, setRegionId] = useState<string | null>(null);
  const [cityId, setCityId] = useState<string | null>(null);
  // Which column a phone shows.
  const [phoneLevel, setPhoneLevel] = useState<StorePlaceLevel>("region");

  // Prices typed but not saved yet: place id → major-unit text ("" clears).
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingPrices, setSavingPrices] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<StorePlace | null>(null);
  const [renaming, setRenaming] = useState<StorePlace | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const region = places.find((p) => p.id === regionId) ?? null;
  const cities = region?.children ?? [];
  const city = cities.find((p) => p.id === cityId) ?? null;
  const areas = city?.children ?? [];

  /** The price a place shows: the typed draft, else the saved one (minor units, or null). */
  const priceOf = (place: StorePlace): number | null => {
    if (place.id in draft) {
      const text = draft[place.id].trim();
      if (text === "") return null;
      const minor = majorToMinor(text);
      return Number.isFinite(minor) ? minor : place.shippingAmount;
    }
    return place.shippingAmount;
  };

  const dirtyIds = Object.keys(draft);
  const invalidIds = useMemo(
    () => dirtyIds.filter((id) => draft[id].trim() !== "" && !Number.isFinite(majorToMinor(draft[id].trim()))),
    [draft] // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const reload = () => list.refresh({ silent: true });

  const add = (level: StorePlaceLevel, parentId: string | null, nameAr: string, nameEn: string) =>
    run(async () => {
      await storePlacesCreate(apiClient, workspaceId, {
        country,
        level,
        parentId,
        nameAr,
        ...(nameEn ? { nameEn } : {}),
      });
      await reload();
    });

  const toggleHidden = (place: StorePlace) =>
    run(async () => {
      await storePlacesUpdate(apiClient, workspaceId, place.id, { hidden: !place.hidden });
      await reload();
    });

  async function savePrices() {
    if (invalidIds.length > 0) return;
    setSavingPrices(true);
    setError(null);
    try {
      await storePlacesSavePrices(
        apiClient,
        workspaceId,
        dirtyIds.map((id) => {
          const text = draft[id].trim();
          return { id, shippingAmount: text === "" ? null : majorToMinor(text) };
        })
      );
      setDraft({});
      toast.success(t.pricesSaved);
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingPrices(false);
    }
  }

  const copyPlatform = () =>
    run(async () => {
      const result = await storePlacesCopyPlatform(apiClient, workspaceId, country);
      toast.success(fmt(t.copied, { n: result.created }));
      await reload();
    });

  const counts = list.data?.counts;
  const empty = Boolean(list.data) && places.length === 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">{t.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">{t.description}</p>
          {counts && !empty && (
            <p className="mt-1 text-xs text-ink-soft">
              {fmt(t.counts, { regions: counts.region, cities: counts.city, areas: counts.area })}
              {list.data && ` · ${fmt(t.max, { n: list.data.max })}`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="places-country">
            {t.country}
          </label>
          <Select
            id="places-country"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value as (typeof COUNTRIES)[number]);
              setRegionId(null);
              setCityId(null);
              setPhoneLevel("region");
              setDraft({});
            }}
            className="h-11 w-auto"
          >
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {t[c]}
              </option>
            ))}
          </Select>
          <Button variant="outline" className="min-h-11" onClick={() => setImportOpen(true)}>
            <FileUp aria-hidden />
            {t.importSheet}
          </Button>
          {!empty && (
            <Button variant="outline" className="min-h-11" onClick={copyPlatform} disabled={busy}>
              {t.fromPlatform}
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <DataState loading={list.loading && !list.data} error={list.error} onRetry={() => list.refresh()}>
        {empty ? (
          <EmptyState
            icon={<MapPinned aria-hidden />}
            title={t.emptyTitle}
            description={t.emptyBody}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button className="min-h-11" onClick={copyPlatform} disabled={busy}>
                  {t.fromPlatform}
                </Button>
                <Button variant="outline" className="min-h-11" onClick={() => setImportOpen(true)}>
                  <FileUp aria-hidden />
                  {t.importSheet}
                </Button>
              </div>
            }
          />
        ) : (
          <>
            {/* Phone: where you are, and a way back up. */}
            {phoneLevel !== "region" && (
              <nav className="flex items-center gap-1 text-sm text-ink-soft lg:hidden" aria-label={t.back}>
                <button type="button" className="min-h-11 cursor-pointer px-1 hover:text-ink" onClick={() => setPhoneLevel("region")}>
                  {t.regions}
                </button>
                {region && (
                  <>
                    <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden />
                    <button
                      type="button"
                      className={cn("min-h-11 cursor-pointer px-1 hover:text-ink", phoneLevel === "city" && "font-semibold text-ink")}
                      onClick={() => setPhoneLevel("city")}
                    >
                      <bdi>{region.nameAr}</bdi>
                    </button>
                  </>
                )}
                {city && phoneLevel === "area" && (
                  <>
                    <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden />
                    <span className="font-semibold text-ink">
                      <bdi>{city.nameAr}</bdi>
                    </span>
                  </>
                )}
              </nav>
            )}

            <div className="grid gap-[var(--bento-gap)] lg:grid-cols-3">
              <PlaceColumn
                t={t}
                className={phoneLevel === "region" ? "" : "hidden lg:flex"}
                title={t.regions}
                addLabel={t.addRegion}
                items={places}
                selectedId={regionId}
                onSelect={(p) => {
                  setRegionId(p.id);
                  setCityId(null);
                  setPhoneLevel("city");
                }}
                inherited={() => t.usesGovernorate}
                priceOf={priceOf}
                draft={draft}
                setDraft={setDraft}
                currency={currency}
                busy={busy}
                onAdd={(ar, en) => add("region", null, ar, en)}
                onToggleHidden={toggleHidden}
                onRename={setRenaming}
                onDelete={setDeleting}
              />
              <PlaceColumn
                t={t}
                className={phoneLevel === "city" ? "" : "hidden lg:flex"}
                title={t.cities}
                addLabel={t.addCity}
                items={cities}
                parent={region}
                pickHint={t.pickRegion}
                selectedId={cityId}
                onSelect={(p) => {
                  setCityId(p.id);
                  setPhoneLevel("area");
                }}
                inherited={() =>
                  region && priceOf(region) !== null
                    ? `${fmt(t.usesParent, { name: region.nameAr })}: ${formatMoney(priceOf(region), currency)}`
                    : t.usesGovernorate
                }
                priceOf={priceOf}
                draft={draft}
                setDraft={setDraft}
                currency={currency}
                busy={busy}
                onAdd={(ar, en) => region && add("city", region.id, ar, en)}
                onToggleHidden={toggleHidden}
                onRename={setRenaming}
                onDelete={setDeleting}
              />
              <PlaceColumn
                t={t}
                className={phoneLevel === "area" ? "" : "hidden lg:flex"}
                title={t.areas}
                addLabel={t.addArea}
                items={areas}
                parent={city}
                pickHint={t.pickCity}
                inherited={() => {
                  const from = city && priceOf(city) !== null ? city : region && priceOf(region) !== null ? region : null;
                  return from ? `${fmt(t.usesParent, { name: from.nameAr })}: ${formatMoney(priceOf(from), currency)}` : t.usesGovernorate;
                }}
                priceOf={priceOf}
                draft={draft}
                setDraft={setDraft}
                currency={currency}
                busy={busy}
                onAdd={(ar, en) => city && add("area", city.id, ar, en)}
                onToggleHidden={toggleHidden}
                onRename={setRenaming}
                onDelete={setDeleting}
              />
            </div>
          </>
        )}
      </DataState>

      {/* Unsaved prices: one bar, above the phone tab bar. */}
      {dirtyIds.length > 0 && (
        <div className="sticky bottom-20 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] bg-ink p-3 text-paper-raised shadow-[var(--shadow-pop)] md:bottom-4">
          <span className="text-sm font-medium">
            {invalidIds.length > 0 ? t.badPrice : fmt(t.pricesChanged, { n: dirtyIds.length })}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" className="min-h-11 text-paper-raised hover:bg-paper-raised/10" onClick={() => setDraft({})} disabled={savingPrices}>
              {t.discard}
            </Button>
            <Button className="min-h-11" onClick={() => void savePrices()} disabled={savingPrices || invalidIds.length > 0}>
              {t.savePrices}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        destructive
        title={deleting ? fmt(t.deleteTitle, { name: deleting.nameAr }) : ""}
        description={
          deleting?.level === "region" ? t.deleteRegion : deleting?.level === "city" ? t.deleteCity : t.deleteArea
        }
        confirmLabel={t.delete}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await storePlacesDelete(apiClient, workspaceId, deleting.id);
          if (deleting.id === regionId) {
            setRegionId(null);
            setCityId(null);
            setPhoneLevel("region");
          } else if (deleting.id === cityId) {
            setCityId(null);
            setPhoneLevel("city");
          }
          setDeleting(null);
          await reload();
        }}
      />

      <RenameModal
        place={renaming}
        t={t}
        onClose={() => setRenaming(null)}
        onSave={async (nameAr, nameEn) => {
          if (!renaming) return;
          await storePlacesUpdate(apiClient, workspaceId, renaming.id, { nameAr, nameEn: nameEn || nameAr });
          setRenaming(null);
          await reload();
        }}
      />

      <ImportModal
        open={importOpen}
        country={country}
        t={t}
        onClose={() => setImportOpen(false)}
        onImported={() => void reload()}
      />
    </section>
  );
}

function PlaceColumn({
  t,
  className,
  title,
  addLabel,
  items,
  parent,
  pickHint,
  selectedId,
  onSelect,
  inherited,
  priceOf,
  draft,
  setDraft,
  currency,
  busy,
  onAdd,
  onToggleHidden,
  onRename,
  onDelete,
}: {
  t: Strings;
  className?: string;
  title: string;
  addLabel: string;
  items: StorePlace[];
  /** The place this column lists the children of; undefined for regions, null when none is picked. */
  parent?: StorePlace | null;
  pickHint?: string;
  selectedId?: string | null;
  onSelect?: (place: StorePlace) => void;
  /** What an unpriced row falls back to, in words. */
  inherited: () => string;
  priceOf: (place: StorePlace) => number | null;
  draft: Record<string, string>;
  setDraft: (update: (prev: Record<string, string>) => Record<string, string>) => void;
  currency: string;
  busy: boolean;
  onAdd: (nameAr: string, nameEn: string) => void;
  onToggleHidden: (place: StorePlace) => void;
  onRename: (place: StorePlace) => void;
  onDelete: (place: StorePlace) => void;
}) {
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const waitingForParent = parent === null;
  const fallback = inherited();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!nameAr.trim()) return;
    onAdd(nameAr.trim(), nameEn.trim());
    setNameAr("");
    setNameEn("");
  }

  return (
    <div className={cn("flex min-w-0 flex-col rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h3 className="text-[15px] font-semibold text-ink">
          {title}
          {parent && (
            <span className="ms-1.5 font-normal text-ink-soft">
              · <bdi>{parent.nameAr}</bdi>
            </span>
          )}
        </h3>
        <span className="text-xs text-ink-soft tabular-nums">{waitingForParent ? "" : items.length}</span>
      </div>

      {waitingForParent ? (
        <p className="px-4 py-8 text-center text-sm text-ink-soft">{pickHint}</p>
      ) : (
        <>
          <ul className="max-h-[28rem] flex-1 divide-y divide-line overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-soft">{t.noneHere}</li>}
            {items.map((place) => {
              const selected = place.id === selectedId;
              const typed = place.id in draft ? draft[place.id] : minorToMajorInput(place.shippingAmount);
              const price = priceOf(place);
              return (
                <li key={place.id} className={cn("px-3 py-2", selected && "bg-primary-soft")}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelect?.(place)}
                      disabled={!onSelect}
                      aria-pressed={onSelect ? selected : undefined}
                      className={cn(
                        "flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center rounded-lg px-1 text-start",
                        onSelect && "cursor-pointer",
                        place.hidden && "opacity-60"
                      )}
                    >
                      <span className={cn("truncate text-sm font-medium text-ink", selected && "text-primary-dark")}>
                        <bdi>{place.nameAr}</bdi>
                        {place.children && place.children.length > 0 && (
                          <span className="ms-1.5 text-xs font-normal text-ink-soft tabular-nums">({place.children.length})</span>
                        )}
                      </span>
                      <span className="truncate text-xs text-ink-soft">
                        {place.nameEn !== place.nameAr && <bdi dir="ltr">{place.nameEn}</bdi>}
                        {place.hidden && <span className="ms-1 font-medium text-accent-dark">· {t.hidden}</span>}
                      </span>
                    </button>
                    <div className="relative w-28 shrink-0">
                      <label className="sr-only" htmlFor={`price-${place.id}`}>
                        {t.shippingPrice} — {place.nameAr}
                      </label>
                      <Input
                        id={`price-${place.id}`}
                        inputMode="decimal"
                        dir="ltr"
                        value={typed}
                        placeholder={currency}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDraft((prev) => ({ ...prev, [place.id]: value }));
                        }}
                        className={cn("h-10 text-end tabular-nums", place.id in draft && "border-primary")}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 ps-1">
                    <span className="truncate text-[11px] text-ink-soft">
                      {price === null ? fallback : `${t.shippingPrice}: ${formatMoney(price, currency)}`}
                    </span>
                    <span className="flex shrink-0 items-center">
                      <IconButton label={place.hidden ? t.show : t.hide} onClick={() => onToggleHidden(place)} disabled={busy}>
                        {place.hidden ? <EyeOff /> : <Eye />}
                      </IconButton>
                      <IconButton label={t.rename} onClick={() => onRename(place)} disabled={busy}>
                        <Pencil />
                      </IconButton>
                      <IconButton label={t.delete} onClick={() => onDelete(place)} disabled={busy} danger>
                        <Trash2 />
                      </IconButton>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <form onSubmit={submit} className="space-y-2 border-t border-line p-3">
            <div className="grid grid-cols-2 gap-2">
              <Input aria-label={t.nameAr} placeholder={t.nameAr} value={nameAr} onChange={(e) => setNameAr(e.target.value)} className="h-10" />
              <Input aria-label={t.nameEn} placeholder={t.nameEn} value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="h-10" dir="ltr" />
            </div>
            <Button type="submit" variant="outline" className="min-h-10 w-full" disabled={busy || !nameAr.trim()}>
              <Plus aria-hidden />
              {addLabel}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-9 cursor-pointer items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-paper-sunken hover:text-ink disabled:opacity-50 [&>svg]:size-4",
        danger && "hover:bg-danger-soft hover:text-danger"
      )}
    >
      {children}
    </button>
  );
}

function RenameModal({
  place,
  t,
  onClose,
  onSave,
}: {
  place: StorePlace | null;
  t: Strings;
  onClose: () => void;
  onSave: (nameAr: string, nameEn: string) => Promise<void>;
}) {
  const errorMessage = useErrorMessage();
  const [state, setState] = useState<{ id: string | null; ar: string; en: string }>({ id: null, ar: "", en: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Fresh names each time another place opens.
  if (place && state.id !== place.id) setState({ id: place.id, ar: place.nameAr, en: place.nameEn });

  return (
    <Modal
      open={place !== null}
      onClose={onClose}
      title={place ? fmt(t.renameTitle, { name: place.nameAr }) : ""}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t.close}
          </Button>
          <Button
            disabled={saving || !state.ar.trim()}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await onSave(state.ar.trim(), state.en.trim());
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setSaving(false);
              }
            }}
          >
            {t.save}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert variant="danger">{error}</Alert>}
        <label className="block space-y-1 text-sm">
          <span className="text-ink">{t.nameAr}</span>
          <Input value={state.ar} onChange={(e) => setState((s) => ({ ...s, ar: e.target.value }))} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-ink">{t.nameEn}</span>
          <Input dir="ltr" value={state.en} onChange={(e) => setState((s) => ({ ...s, en: e.target.value }))} />
        </label>
      </div>
    </Modal>
  );
}

function ImportModal({
  open,
  country,
  t,
  onClose,
  onImported,
}: {
  open: boolean;
  country: string;
  t: Strings;
  onClose: () => void;
  onImported: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StorePlaceImportResult | null>(null);
  const sampleHref = useMemo(() => `data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + SAMPLE_CSV)}`, []);

  function close() {
    setFile(null);
    setMode("merge");
    setError(null);
    setResult(null);
    onClose();
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const answer = await storePlacesImport(apiClient, workspaceId, file, country, mode);
      setResult(answer);
      onImported();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={t.importTitle}
      footer={
        result ? (
          <Button onClick={close}>{t.close}</Button>
        ) : (
          <>
            <Button variant="outline" onClick={close} disabled={busy}>
              {t.close}
            </Button>
            <Button onClick={() => void submit()} disabled={busy || !file}>
              {busy ? t.importing : t.importNow}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3 text-sm">
          <Alert variant="success">{fmt(t.imported, { created: result.created, priced: result.priced ?? 0 })}</Alert>
          {result.errors.length > 0 && (
            <div>
              <p className="mb-1 font-medium text-ink">{t.rowErrors}</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg bg-paper-sunken p-3 text-xs">
                {result.errors.map((e) => (
                  <li key={`${e.row}-${e.message}`}>
                    <span className="font-medium text-ink">{fmt(t.row, { n: e.row })}</span> — {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <p className="text-ink-soft">{t.importHint}</p>
          <a href={sampleHref} download="places-sample.csv" className="inline-flex min-h-11 items-center gap-1.5 font-medium text-primary-dark hover:underline">
            <Download className="size-4" aria-hidden />
            {t.sample}
          </a>
          <label className="block space-y-1">
            <span className="font-medium text-ink">{t.file}</span>
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-ink file:me-3 file:min-h-10 file:cursor-pointer file:rounded-[var(--radius)] file:border-0 file:bg-primary-soft file:px-3 file:text-primary-dark"
            />
          </label>
          <fieldset className="space-y-2">
            {(["merge", "replace"] as const).map((m) => (
              <label key={m} className="flex min-h-11 cursor-pointer items-center gap-2">
                <input type="radio" name="places-import-mode" className="size-4 accent-primary" checked={mode === m} onChange={() => setMode(m)} />
                <span className="text-ink">{t[m]}</span>
              </label>
            ))}
            {mode === "replace" && <p className="text-xs font-medium text-danger">{t.replaceWarn}</p>}
          </fieldset>
          {error && <Alert variant="danger">{error}</Alert>}
        </div>
      )}
    </Modal>
  );
}
