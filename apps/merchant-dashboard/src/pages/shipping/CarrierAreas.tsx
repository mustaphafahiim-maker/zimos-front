import { useMemo, useState } from "react";
import { Button, Input } from "@store-builder/ui";
import {
  carrierRegionReset,
  carrierRegionSet,
  carrierRegionsList,
  carrierRegionsRematch,
  type CarrierAreaNode,
  type CarrierRegion,
  type CarrierRegionList,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { FilterTabs } from "@/components/FilterTabs";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useLevelLabel } from "@/pages/orders/components/useLevelLabel";
import { placeName } from "./carriers";

const STRINGS = {
  en: {
    title: "Delivery areas",
    hint: "Where each governorate and city is on {name}'s own list. Orders from a matched area are booked without asking you.",
    review: "Review areas",
    dialogTitle: "{name} delivery areas",
    dialogHint:
      "Areas are matched to {name}'s list by name. Change any that are wrong, and choose the ones that are missing — orders from a missing area wait for you to pick the place when booking.",
    summary:
      "{matched} of {cities} areas matched · {missing} missing · {manual} set by you",
    all: "All",
    missingTab: "Missing",
    manualTab: "Set by you",
    filterLabel: "Filter areas",
    search: "Search areas",
    nothing: "No areas match.",
    auto: "Matched by name",
    manual: "Set by you",
    missing: "Not found on {name}'s list",
    change: "Change",
    choose: "Choose",
    reset: "Use the matched one",
    save: "Save",
    cancel: "Cancel",
    chooseLevel: "Choose {level}",
    saved: "{area} is now {place} on {name}.",
    resetDone: "{area} is back to the matched place.",
    rematch: "Match again",
    rematched: "Matched {matched} of {places} places by name.",
    close: "Close",
    listFailed: "{name}'s list could not be loaded.",
  },
  ar: {
    title: "مناطق التوصيل",
    hint: "مكان كل محافظة ومدينة في قائمة {name}. الأوردرات من منطقة مربوطة تُحجز بدون أن نسألك.",
    review: "مراجعة المناطق",
    dialogTitle: "مناطق التوصيل مع {name}",
    dialogHint:
      "تُربط المناطق بقائمة {name} بالاسم. غيّر أي ربط خاطئ واختر المناطق الناقصة — أوردرات المنطقة الناقصة تنتظر أن تختار المكان عند الحجز.",
    summary:
      "{matched} من {cities} منطقة مربوطة · {missing} ناقصة · {manual} اخترتها بنفسك",
    all: "الكل",
    missingTab: "الناقصة",
    manualTab: "اخترتها بنفسك",
    filterLabel: "تصفية المناطق",
    search: "ابحث عن منطقة",
    nothing: "لا توجد مناطق مطابقة.",
    auto: "مربوطة بالاسم",
    manual: "اخترتها بنفسك",
    missing: "غير موجودة في قائمة {name}",
    change: "تغيير",
    choose: "اختيار",
    reset: "استخدام الربط التلقائي",
    save: "حفظ",
    cancel: "إلغاء",
    chooseLevel: "اختر {level}",
    saved: "{area} أصبحت {place} مع {name}.",
    resetDone: "عادت {area} إلى الربط التلقائي.",
    rematch: "إعادة الربط",
    rematched: "تم ربط {matched} من {places} مكان بالاسم.",
    close: "إغلاق",
    listFailed: "تعذّر تحميل قائمة {name}.",
  },
};

type Filter = "all" | "missing" | "manual";

/** The "Delivery areas" row under a connected courier, and its dialog. */
export function CarrierAreas({
  carrierCode,
  name,
  canManage,
  onForbidden,
}: {
  carrierCode: string;
  name: string;
  canManage: boolean;
  onForbidden: (err: unknown) => boolean;
}) {
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{t.title}</p>
        <p className="text-sm text-ink-soft">{fmt(t.hint, { name })}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={() => setOpen(true)}
      >
        {t.review}
      </Button>
      {open && (
        <CarrierAreasDialog
          carrierCode={carrierCode}
          name={name}
          canManage={canManage}
          onForbidden={onForbidden}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function CarrierAreasDialog({
  carrierCode,
  name,
  canManage,
  onForbidden,
  onClose,
}: {
  carrierCode: string;
  name: string;
  canManage: boolean;
  onForbidden: (err: unknown) => boolean;
  onClose: () => void;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(
    () => carrierRegionsList(apiClient, workspaceId, carrierCode),
    [workspaceId, carrierCode],
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const regionName = (r: CarrierRegion) =>
    locale === "ar" ? r.nameAr : r.nameEn;

  const groups = useMemo(() => {
    const data = list.data;
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    const shown = (r: CarrierRegion) =>
      r.level === "city" &&
      (filter === "all" ||
        (filter === "missing" && !r.mapping) ||
        (filter === "manual" && r.mapping?.source === "manual")) &&
      (!needle ||
        r.nameAr.toLowerCase().includes(needle) ||
        r.nameEn.toLowerCase().includes(needle));
    return data.regions
      .filter((r) => r.level === "governorate")
      .map((top) => ({
        top,
        cities: data.regions.filter(
          (r) => r.parentCode === top.code && shown(r),
        ),
      }))
      .filter((g) => g.cities.length > 0);
  }, [list.data, filter, query]);

  function fail(err: unknown) {
    if (!onForbidden(err)) toast.error(errorMessage(err));
  }

  async function rematch() {
    setBusy(true);
    try {
      const result = await carrierRegionsRematch(
        apiClient,
        workspaceId,
        carrierCode,
      );
      toast.success(
        fmt(t.rematched, { matched: result.matched, places: result.places }),
      );
      await list.refresh({ silent: true });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function reset(region: CarrierRegion) {
    setBusy(true);
    try {
      await carrierRegionReset(
        apiClient,
        workspaceId,
        carrierCode,
        region.code,
      );
      toast.success(fmt(t.resetDone, { area: regionName(region) }));
      await list.refresh({ silent: true });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  const counts = list.data?.counts;
  return (
    <Modal
      open
      onClose={onClose}
      title={fmt(t.dialogTitle, { name })}
      description={fmt(t.dialogHint, { name })}
      className="max-w-3xl"
      footer={
        <>
          {canManage && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || list.loading}
              onClick={rematch}
            >
              {t.rematch}
            </Button>
          )}
          <Button type="button" onClick={onClose}>
            {t.close}
          </Button>
        </>
      }
    >
      <DataState
        loading={list.loading}
        error={list.error}
        onRetry={() => void list.refresh()}
      >
        {counts && (
          <p className="mb-3 text-sm text-ink-soft">
            {fmt(t.summary, {
              matched: counts.auto + counts.manual,
              cities: counts.cities,
              missing: counts.missing,
              manual: counts.manual,
            })}
          </p>
        )}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <FilterTabs<Filter>
            label={t.filterLabel}
            value={filter}
            onChange={setFilter}
            tabs={[
              { value: "all", label: t.all },
              {
                value: "missing",
                label: `${t.missingTab} (${counts?.missing ?? 0})`,
              },
              {
                value: "manual",
                label: `${t.manualTab} (${counts?.manual ?? 0})`,
              },
            ]}
          />
          <Input
            type="search"
            aria-label={t.search}
            placeholder={t.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1"
          />
        </div>
        <div className="max-h-[55vh] overflow-y-auto pe-1">
          {groups.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-soft">
              {t.nothing}
            </p>
          )}
          {groups.map(({ top, cities }) => (
            <section key={top.code} className="mb-4">
              <h3 className="sticky top-0 bg-paper-raised py-1 text-xs font-semibold text-ink-soft">
                {regionName(top)}
              </h3>
              <ul className="divide-y divide-line">
                {cities.map((r) => (
                  <li key={r.code} className="py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-ink">{regionName(r)}</p>
                        <p
                          className={
                            r.mapping
                              ? "text-xs text-ink-soft"
                              : "text-xs text-danger"
                          }
                        >
                          {r.mapping
                            ? r.mapping.path
                                .map((p) => placeName(p, locale))
                                .join(" › ")
                            : fmt(t.missing, { name })}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {r.mapping && (
                          <StatusBadge
                            value={r.mapping.source}
                            tone={
                              r.mapping.source === "manual" ? "info" : "neutral"
                            }
                            text={
                              r.mapping.source === "manual" ? t.manual : t.auto
                            }
                          />
                        )}
                        {canManage && editing !== r.code && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => setEditing(r.code)}
                          >
                            {r.mapping ? t.change : t.choose}
                          </Button>
                        )}
                        {canManage &&
                          r.mapping?.source === "manual" &&
                          editing !== r.code && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => reset(r)}
                            >
                              {t.reset}
                            </Button>
                          )}
                      </div>
                    </div>
                    {editing === r.code && list.data && (
                      <AreaEditor
                        carrierCode={carrierCode}
                        name={name}
                        region={r}
                        levels={list.data.levels}
                        onCancel={() => setEditing(null)}
                        onSaved={async (place) => {
                          toast.success(
                            fmt(t.saved, { area: regionName(r), place, name }),
                          );
                          setEditing(null);
                          await list.refresh({ silent: true });
                        }}
                        onError={fail}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DataState>
    </Modal>
  );
}

/** The courier's list as one tree: city/district couriers answer cities with `districts`. */
async function courierTree(
  workspaceId: string,
  carrierCode: string,
  levels: CarrierRegionList["levels"],
) {
  const usable = (n: { dropOffAvailable?: boolean }) =>
    n.dropOffAvailable !== false;
  if (levels.length === 2 && levels[0] === "city" && levels[1] === "district") {
    const cities = await apiClient.listCarrierCities(workspaceId, carrierCode);
    return cities.filter(usable).map<CarrierAreaNode>((c) => ({
      id: c.id,
      name: c.name,
      nameAr: c.nameAr,
      children: (c.districts ?? [])
        .filter(usable)
        .map((d) => ({ id: d.id, name: d.name, nameAr: d.nameAr })),
    }));
  }
  const prune = (nodes: CarrierAreaNode[]): CarrierAreaNode[] =>
    nodes
      .filter(usable)
      .map((n) => ({
        ...n,
        children: n.children ? prune(n.children) : undefined,
      }));
  return prune(
    (await apiClient.listCarrierAddressTree(workspaceId, carrierCode)).nodes,
  );
}

function AreaEditor({
  carrierCode,
  name,
  region,
  levels,
  onCancel,
  onSaved,
  onError,
}: {
  carrierCode: string;
  name: string;
  region: CarrierRegion;
  levels: string[];
  onCancel: () => void;
  onSaved: (place: string) => Promise<void>;
  onError: (err: unknown) => void;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const levelLabel = useLevelLabel();
  const workspaceId = useWorkspaceId();
  const tree = useAsync(
    () => courierTree(workspaceId, carrierCode, levels),
    [workspaceId, carrierCode, levels.join(">")],
  );
  const [path, setPath] = useState<string[]>(
    () => region.mapping?.path.map((p) => p.id) ?? [],
  );
  const [saving, setSaving] = useState(false);

  // The options of each level: the top list, then the children of what is chosen above.
  const options: CarrierAreaNode[][] = [];
  const chosen: CarrierAreaNode[] = [];
  let nodes: CarrierAreaNode[] | undefined = tree.data ?? undefined;
  for (let i = 0; i < levels.length && nodes; i += 1) {
    options.push(nodes);
    const node: CarrierAreaNode | undefined = nodes.find(
      (n) => n.id === path[i],
    );
    if (!node) break;
    chosen.push(node);
    nodes = node.children;
  }
  const complete = chosen.length === levels.length;

  async function save() {
    setSaving(true);
    try {
      await carrierRegionSet(
        apiClient,
        workspaceId,
        carrierCode,
        region.code,
        chosen.map((n) => n.id),
      );
      await onSaved(chosen.map((n) => placeName(n, locale)).join(" › "));
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 rounded-[0.625rem] border border-line bg-paper p-3">
      {tree.error ? (
        <p className="text-sm text-danger">{fmt(t.listFailed, { name })}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {levels.map((level, i) => (
            <Select
              key={level}
              aria-label={fmt(t.chooseLevel, { level: levelLabel(level) })}
              value={path[i] ?? ""}
              disabled={tree.loading || saving || !options[i]}
              onChange={(e) => setPath([...path.slice(0, i), e.target.value])}
            >
              <option value="">
                {fmt(t.chooseLevel, { level: levelLabel(level) })}
              </option>
              {(options[i] ?? []).map((n) => (
                <option key={n.id} value={n.id}>
                  {placeName(n, locale)}
                </option>
              ))}
            </Select>
          ))}
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={saving}
        >
          {t.cancel}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={!complete || saving}
        >
          {t.save}
        </Button>
      </div>
    </div>
  );
}
