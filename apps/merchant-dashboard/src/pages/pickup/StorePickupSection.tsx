import { useId, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { IconInventory, IconPacked, IconPlace } from "@/components/icons";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  PICKUP_TEXT_MAX,
  pickupSettingsGet,
  pickupSettingsSave,
  stockLocationsList,
  type PickupLocationSettings,
  type PickupSettings,
  type StockLocation,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { canManageShipping } from "@/lib/fulfilmentAccess";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { PICKUP_STRINGS, type PickupStrings } from "./pickupStrings";

interface PlaceDraft {
  enabled: boolean;
  instructionsAr: string;
  instructionsEn: string;
  hoursAr: string;
  hoursEn: string;
}

interface Draft {
  enabled: boolean;
  places: Record<string, PlaceDraft>;
}

const EMPTY_PLACE: PlaceDraft = { enabled: false, instructionsAr: "", instructionsEn: "", hoursAr: "", hoursEn: "" };

/** One draft row per location the store has now; settings of a location that is gone are dropped. */
function toDraft(settings: PickupSettings, locations: StockLocation[]): Draft {
  const places: Record<string, PlaceDraft> = {};
  for (const location of locations) {
    const saved = settings.locations?.[location.id];
    places[location.id] = saved
      ? {
          enabled: saved.enabled === true,
          instructionsAr: saved.instructions?.ar ?? "",
          instructionsEn: saved.instructions?.en ?? "",
          hoursAr: saved.hours?.ar ?? "",
          hoursEn: saved.hours?.en ?? "",
        }
      : EMPTY_PLACE;
  }
  return { enabled: settings.enabled === true, places };
}

const clip = (text: string) => text.trim().slice(0, PICKUP_TEXT_MAX);

/** A place that was never set up (off, no text) is left out of the body. */
function toBody(draft: Draft): PickupSettings {
  const locations: Record<string, PickupLocationSettings> = {};
  for (const [id, place] of Object.entries(draft.places)) {
    const instructions = { ar: clip(place.instructionsAr), en: clip(place.instructionsEn) };
    const hours = { ar: clip(place.hoursAr), en: clip(place.hoursEn) };
    const hasInstructions = Boolean(instructions.ar || instructions.en);
    const hasHours = Boolean(hours.ar || hours.en);
    if (!place.enabled && !hasInstructions && !hasHours) continue;
    locations[id] = { enabled: place.enabled, instructions: hasInstructions ? instructions : null, hours: hasHours ? hours : null };
  }
  return { enabled: draft.enabled, locations };
}

/**
 * Shipping → «الاستلام من الفرع» (handoff 225; read orders.view, save
 * shipping.manage): whether shoppers may collect their order in store, and
 * for each of the store's stock locations (Inventory → Locations, item 206)
 * whether it is a pickup place, with its instructions and opening hours in
 * Arabic and English. One save sends the whole setting; with pickup on, at
 * least one place has to be on.
 */
export function StorePickupSection() {
  const workspaceId = useWorkspaceId();
  const t = useT(PICKUP_STRINGS);
  const settings = useAsync(() => pickupSettingsGet(apiClient, workspaceId), [workspaceId]);
  // The places are the store's stock locations; a role without inventory.view cannot read (or choose) them.
  const locations = useAsync(
    () =>
      stockLocationsList(apiClient, workspaceId).then(
        (r) => ({ list: r.locations, denied: false }),
        (err) => {
          if (isPermissionError(err)) return { list: [] as StockLocation[], denied: true };
          throw err;
        }
      ),
    [workspaceId]
  );
  const loading = (settings.loading && !settings.data) || (locations.loading && !locations.data);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">{t.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">{t.description}</p>
        </div>
        <Button asChild variant="outline" className="min-h-11 gap-1.5 rounded-full px-4">
          <Link to="/orders/pickups">
            <IconPacked className="size-4" aria-hidden />
            {t.openQueue}
          </Link>
        </Button>
      </div>
      <DataState
        loading={loading}
        error={(settings.data ? null : settings.error) ?? (locations.data ? null : locations.error)}
        onRetry={() => {
          if (settings.error) void settings.refresh();
          if (locations.error) void locations.refresh();
        }}
      >
        {settings.data && locations.data && (
          <PickupForm
            key={JSON.stringify([settings.data, locations.data.list.map((l) => [l.id, l.name, l.address, l.isActive])])}
            initial={settings.data}
            locations={locations.data.list}
            locationsDenied={locations.data.denied}
            onSaved={(next) => settings.setData(next)}
          />
        )}
      </DataState>
    </section>
  );
}

function PickupForm({
  initial,
  locations,
  locationsDenied,
  onSaved,
}: {
  initial: PickupSettings;
  locations: StockLocation[];
  locationsDenied: boolean;
  onSaved: (next: PickupSettings) => void;
}) {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const t = useT(PICKUP_STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const ids = useId();
  // Without the list of locations the body cannot be rebuilt, so nothing is editable.
  const canManage = canManageShipping(currentWorkspace?.role) && !locationsDenied;

  const saved = useMemo(() => toDraft(initial, locations), [initial, locations]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(toBody(draft)) !== JSON.stringify(toBody(saved));
  useReportDirty(dirty);
  const locked = saving || !canManage;

  function patchPlace(id: string, change: Partial<PlaceDraft>) {
    setDraft((d) => ({ ...d, places: { ...d.places, [id]: { ...(d.places[id] ?? EMPTY_PLACE), ...change } } }));
    setProblem(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !canManage) return;
    const body = toBody(draft);
    if (body.enabled && !Object.values(body.locations).some((l) => l.enabled)) {
      setProblem(t.errNoPlace);
      document.getElementById(`${ids}-places`)?.scrollIntoView({ block: "center" });
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      const next = await pickupSettingsSave(apiClient, workspaceId, body);
      toast.success(t.saved);
      onSaved(next);
    } catch (err) {
      setProblem(isPermissionError(err) ? t.noManage : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {locationsDenied ? <Alert>{t.locationsDenied}</Alert> : !canManage && <Alert>{t.noManage}</Alert>}

      <SettingsGroup>
        <SettingsSwitch
          label={t.toggle}
          hint={draft.enabled ? t.hintOn : t.hintOff}
          checked={draft.enabled}
          disabled={locked}
          onChange={(enabled) => {
            setDraft((d) => ({ ...d, enabled }));
            setProblem(null);
          }}
        />
      </SettingsGroup>

      {!locationsDenied && (
        <div id={`${ids}-places`} className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-ink">{t.placesTitle}</h3>
              <p className="mt-0.5 max-w-2xl text-xs text-ink-soft">{t.placesHint}</p>
            </div>
            <Link to="/inventory" className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-fine:min-h-9">
              <IconInventory className="size-4" aria-hidden />
              {t.manageLocations}
            </Link>
          </div>

          {locations.length === 0 ? (
            <EmptyState
              icon={<IconInventory aria-hidden />}
              title={t.noLocationsTitle}
              description={t.noLocationsBody}
              action={
                <Button asChild variant="outline" className="min-h-11 rounded-full px-5">
                  <Link to="/inventory">{t.manageLocations}</Link>
                </Button>
              }
            />
          ) : (
            locations.map((location) => (
              <PlaceCard
                key={location.id}
                ids={`${ids}-${location.id}`}
                location={location}
                place={draft.places[location.id] ?? EMPTY_PLACE}
                locked={locked}
                t={t}
                onChange={(change) => patchPlace(location.id, change)}
              />
            ))
          )}
        </div>
      )}

      {problem && !dirty && <Alert variant="danger">{problem}</Alert>}

      <SaveBar
        dirty={dirty && canManage}
        saving={saving}
        saveLabel={t.save}
        savingLabel={t.saving}
        discardLabel={t.discard}
        message={problem ?? undefined}
        onDiscard={() => {
          setDraft(saved);
          setProblem(null);
        }}
      />
    </form>
  );
}

function PlaceCard({
  ids,
  location,
  place,
  locked,
  t,
  onChange,
}: {
  ids: string;
  location: StockLocation;
  place: PlaceDraft;
  locked: boolean;
  t: PickupStrings;
  onChange: (change: Partial<PlaceDraft>) => void;
}) {
  const texts: Array<{ key: keyof PlaceDraft; lang: "ar" | "en"; group: "instructions" | "hours"; placeholder: string }> = [
    { key: "instructionsAr", lang: "ar", group: "instructions", placeholder: t.instructionsPlaceholderAr },
    { key: "instructionsEn", lang: "en", group: "instructions", placeholder: t.instructionsPlaceholderEn },
    { key: "hoursAr", lang: "ar", group: "hours", placeholder: t.hoursPlaceholderAr },
    { key: "hoursEn", lang: "en", group: "hours", placeholder: t.hoursPlaceholderEn },
  ];
  const field = (key: keyof PlaceDraft) => {
    const spec = texts.find((x) => x.key === key)!;
    const langName = spec.lang === "ar" ? t.langAr : t.langEn;
    return (
      <div className="space-y-1">
        <label htmlFor={`${ids}-${key}`} className="block text-xs font-medium text-ink-soft">
          {langName}
        </label>
        <Textarea
          id={`${ids}-${key}`}
          dir={spec.lang === "ar" ? "rtl" : "ltr"}
          lang={spec.lang}
          rows={2}
          maxLength={PICKUP_TEXT_MAX}
          value={place[key] as string}
          placeholder={spec.placeholder}
          disabled={locked}
          aria-label={fmt(spec.group === "instructions" ? t.instructionsFor : t.hoursFor, { name: location.name, lang: langName })}
          onChange={(e) => onChange({ [key]: e.target.value } as Partial<PlaceDraft>)}
          className="min-h-[64px] text-base md:text-sm"
        />
      </div>
    );
  };

  return (
    <SettingsGroup className={cn(!location.isActive && "opacity-80")}>
      <SettingsSwitch
        label={location.name}
        hint={place.enabled ? t.placeOn : t.placeOff}
        checked={place.enabled}
        disabled={locked}
        onChange={(enabled) => onChange({ enabled })}
      />
      {(location.address || place.enabled || !location.isActive) && (
        <div className="border-t border-line px-4 py-3">
          {location.address ? (
            <p className="flex items-start gap-1.5 text-sm leading-6 text-ink-soft">
              <IconPlace className="mt-1 size-4 shrink-0" aria-hidden />
              <bdi>{location.address}</bdi>
            </p>
          ) : (
            place.enabled && <p className="text-[13px] leading-5 font-medium text-accent-dark">{t.noAddress}</p>
          )}
          {!location.isActive && <p className="mt-1 text-[13px] leading-5 font-medium text-accent-dark">{t.inactivePlace}</p>}

          {place.enabled && (
            <div className="mt-4 space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-ink">{t.instructions}</legend>
                <p className="text-xs text-ink-soft">{t.instructionsHint}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {field("instructionsAr")}
                  {field("instructionsEn")}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-ink">{t.hours}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {field("hoursAr")}
                  {field("hoursEn")}
                </div>
              </fieldset>
            </div>
          )}
        </div>
      )}
    </SettingsGroup>
  );
}
