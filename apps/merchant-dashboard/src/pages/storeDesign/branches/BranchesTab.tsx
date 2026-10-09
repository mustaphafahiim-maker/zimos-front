import { useEffect, useId, useState, type ClipboardEvent } from "react";
import { Link } from "react-router-dom";
import { IconExternal, IconInfo, IconPlace, IconStore } from "@/components/icons";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  STORE_LOCATOR_PHONE_MAX,
  STORE_LOCATOR_TEXT_MAX,
  stockLocationsList,
  storeLocatorGet,
  storeLocatorSave,
  type StockLocation,
  type StoreLocatorBranchSettings,
  type StoreLocatorSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { fmt, useT } from "@/i18n/LocaleContext";
import { AccordionSection } from "@/components/Accordion";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsLinkRow, SettingsSwitch } from "@/components/settings";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { BRANCH_STRINGS, coordinateOf, pastedPin } from "./branchStrings";
import { GroupBlock, STACK, SettingsSkeleton, TOUCH_FIELDS } from "../sections/parts";

interface BranchDraft {
  visible: boolean;
  phone: string;
  whatsapp: string;
  hoursAr: string;
  hoursEn: string;
  noteAr: string;
  noteEn: string;
  lat: string;
  lng: string;
}

interface Draft {
  enabled: boolean;
  branches: Record<string, BranchDraft>;
}

type PinErrors = Partial<Record<"lat" | "lng", string>>;

const EMPTY_BRANCH: BranchDraft = { visible: false, phone: "", whatsapp: "", hoursAr: "", hoursEn: "", noteAr: "", noteEn: "", lat: "", lng: "" };

/** The saved setting as the form holds it: one entry per location the store has now. */
function draftOf(settings: StoreLocatorSettings, locations: StockLocation[]): Draft {
  const branches: Record<string, BranchDraft> = {};
  for (const location of locations) {
    const saved = settings.branches?.[location.id];
    branches[location.id] = saved
      ? {
          visible: saved.visible === true,
          phone: saved.phone ?? "",
          whatsapp: saved.whatsapp ?? "",
          hoursAr: saved.hours?.ar ?? "",
          hoursEn: saved.hours?.en ?? "",
          noteAr: saved.note?.ar ?? "",
          noteEn: saved.note?.en ?? "",
          lat: typeof saved.lat === "number" ? String(saved.lat) : "",
          lng: typeof saved.lng === "number" ? String(saved.lng) : "",
        }
      : EMPTY_BRANCH;
  }
  return { enabled: settings.enabled === true, branches };
}

const texts = (ar: string, en: string) => (ar.trim() || en.trim() ? { ar: ar.trim(), en: en.trim() } : null);

/** What PUT /store-locator takes. A location that is neither shown nor filled in is left out; so is one the store no longer has. */
function bodyOf(draft: Draft, locations: StockLocation[]): StoreLocatorSettings {
  const branches: Record<string, StoreLocatorBranchSettings> = {};
  for (const location of locations) {
    const b = draft.branches[location.id] ?? EMPTY_BRANCH;
    const lat = coordinateOf(b.lat);
    const lng = coordinateOf(b.lng);
    const entry: StoreLocatorBranchSettings = {
      visible: b.visible,
      phone: b.phone.trim() || null,
      whatsapp: b.whatsapp.trim() || null,
      hours: texts(b.hoursAr, b.hoursEn),
      note: texts(b.noteAr, b.noteEn),
      // Together or not at all, as the API asks.
      lat: lat !== null && lng !== null ? lat : null,
      lng: lat !== null && lng !== null ? lng : null,
    };
    const blank = !entry.visible && !entry.phone && !entry.whatsapp && !entry.hours && !entry.note && entry.lat === null;
    if (!blank) branches[location.id] = entry;
  }
  return { enabled: draft.enabled, branches };
}

/**
 * Store settings → Our branches (frontend-handoff 233, website.edit): whether
 * the store shows its «فروعنا» page, and for each stock location (Inventory →
 * Locations) whether it is listed there, with its phone, WhatsApp, opening
 * hours, note and map pin. One save for the whole setting, as the API replaces
 * it whole. A role without website.edit gets DataState's no-permission card
 * from the first GET.
 */
export function BranchesTab() {
  const workspaceId = useWorkspaceId();
  const loaded = useAsync(async () => {
    const [settings, list] = await Promise.all([storeLocatorGet(apiClient, workspaceId), stockLocationsList(apiClient, workspaceId)]);
    return { settings, locations: list.locations };
  }, [workspaceId]);

  return (
    <DataState loading={loaded.loading && !loaded.data} error={loaded.error} onRetry={() => void loaded.refresh()} skeleton={<SettingsSkeleton />}>
      {loaded.data && (
        <BranchesForm
          settings={loaded.data.settings}
          locations={loaded.data.locations}
          onSaved={(settings) => loaded.setData((prev) => ({ locations: prev?.locations ?? [], settings }))}
        />
      )}
    </DataState>
  );
}

function BranchesForm({
  settings,
  locations,
  onSaved,
}: {
  settings: StoreLocatorSettings;
  locations: StockLocation[];
  onSaved: (settings: StoreLocatorSettings) => void;
}) {
  const t = useT(BRANCH_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const ids = useId();
  const [draft, setDraft] = useState<Draft>(() => draftOf(settings, locations));
  const [pinErrors, setPinErrors] = useState<Record<string, PinErrors>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A save brings the server's view back.
  useEffect(() => {
    setDraft(draftOf(settings, locations));
    setPinErrors({});
  }, [settings, locations]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(settings, locations));
  useReportDirty(dirty);

  const setBranch = (id: string, patch: Partial<BranchDraft>) => {
    setDraft((prev) => ({ ...prev, branches: { ...prev.branches, [id]: { ...(prev.branches[id] ?? EMPTY_BRANCH), ...patch } } }));
    // What was wrong is being put right: the message goes until the next save says otherwise.
    setError(null);
    if ("lat" in patch || "lng" in patch) setPinErrors((prev) => ({ ...prev, [id]: {} }));
  };

  /** The pins of the branches on show: both numbers or neither, each in its range. */
  function checkPins(): Record<string, PinErrors> {
    const found: Record<string, PinErrors> = {};
    for (const location of locations) {
      const b = draft.branches[location.id];
      if (!b?.visible || (!b.lat.trim() && !b.lng.trim())) continue;
      const problems: PinErrors = {};
      const lat = coordinateOf(b.lat);
      const lng = coordinateOf(b.lng);
      if (!b.lat.trim()) problems.lat = t.pinBoth;
      else if (lat === null || lat < -90 || lat > 90) problems.lat = t.latRange;
      if (!b.lng.trim()) problems.lng = t.pinBoth;
      else if (lng === null || lng < -180 || lng > 180) problems.lng = t.lngRange;
      if (problems.lat || problems.lng) found[location.id] = problems;
    }
    return found;
  }

  async function save() {
    if (saving) return;
    const found = checkPins();
    setPinErrors(found);
    const firstBad = locations.find((l) => found[l.id]);
    if (firstBad) {
      setError(fmt(t.fixFirst, { name: firstBad.name }));
      document.getElementById(`${ids}-${firstBad.id}-${found[firstBad.id].lat ? "lat" : "lng"}`)?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await storeLocatorSave(apiClient, workspaceId, bodyOf(draft, locations));
      onSaved(next);
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setDraft(draftOf(settings, locations));
    setPinErrors({});
    setError(null);
  }

  const shown = locations.filter((l) => draft.branches[l.id]?.visible).length;
  const pageUrl = `${STOREFRONT_URL}/store/${workspaceId}/branches`;

  return (
    <div className={STACK}>
      <SettingsGroup
        description={t.description}
        footer={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge value={settings.enabled ? "on" : "off"} tone={settings.enabled ? "success" : "neutral"} text={settings.enabled ? t.on : t.off} />
            {!settings.enabled && draft.enabled && <span>{t.pageNote}</span>}
          </span>
        }
      >
        <SettingsSwitch
          label={t.enabled}
          hint={t.enabledHint}
          checked={draft.enabled}
          disabled={saving}
          onChange={(enabled) => {
            setDraft((prev) => ({ ...prev, enabled }));
            setError(null);
          }}
        />
        {draft.enabled && locations.length > 0 && shown === 0 && (
          <GroupBlock>
            <p className="flex items-start gap-2 text-sm text-accent-dark" role="status">
              <IconInfo className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t.noneVisible}
            </p>
          </GroupBlock>
        )}
        {settings.enabled && <SettingsLinkRow to={pageUrl} label={t.openPage} icon={IconExternal} tone="orange" />}
        <SettingsLinkRow to="/inventory/locations" label={t.openLocations} hint={t.fromInventory} icon={IconStore} tone="gray" />
      </SettingsGroup>

      {locations.length === 0 ? (
        <EmptyState
          icon={<IconStore aria-hidden />}
          title={t.emptyTitle}
          description={t.emptyHint}
          action={
            <Button asChild className="min-h-11 rounded-full px-5">
              <Link to="/inventory/locations">{t.addLocation}</Link>
            </Button>
          }
        />
      ) : (
        locations.map((location) => (
          <BranchCard
            key={location.id}
            idBase={`${ids}-${location.id}`}
            location={location}
            branch={draft.branches[location.id] ?? EMPTY_BRANCH}
            errors={pinErrors[location.id] ?? {}}
            disabled={saving}
            onChange={(patch) => setBranch(location.id, patch)}
          />
        ))
      )}

      {error && !dirty && <Alert variant="danger">{error}</Alert>}
      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={() => void save()}
        onDiscard={discard}
        message={
          error ? (
            <span role="alert" className="text-danger">
              {error}
            </span>
          ) : undefined
        }
      />
    </div>
  );
}

/** One location: whether it is listed, and — once it is — what the shopper is told about it. */
function BranchCard({
  idBase,
  location,
  branch,
  errors,
  disabled,
  onChange,
}: {
  idBase: string;
  location: StockLocation;
  branch: BranchDraft;
  errors: PinErrors;
  disabled: boolean;
  onChange: (patch: Partial<BranchDraft>) => void;
}) {
  const t = useT(BRANCH_STRINGS);
  const lat = coordinateOf(branch.lat);
  const lng = coordinateOf(branch.lng);
  const pinned = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const count = (value: string) => fmt(t.counter, { n: value.length, max: STORE_LOCATOR_TEXT_MAX });

  /** Google Maps copies "30.0444, 31.2357": pasted into either box, the pair fills both. */
  function onPinPaste(e: ClipboardEvent<HTMLInputElement>) {
    const pair = pastedPin(e.clipboardData.getData("text"));
    if (!pair) return;
    e.preventDefault();
    onChange(pair);
  }

  return (
    // One location folds to a row: its name, its address, and — without opening it — whether it is listed.
    // Kept mounted, so what was typed for a branch survives a fold.
    <AccordionSection
      title={location.name}
      icon={IconStore}
      summary={location.address?.trim() || t.noAddress}
      defaultOpen={branch.visible}
      persistKey={`store-settings:branches:${location.id}`}
      keepMounted
      actions={
        <label className={`relative flex min-h-11 items-center gap-2 pe-2 text-[13px] font-medium text-ink ${disabled ? "cursor-default" : "cursor-pointer"}`}>
          <input
            type="checkbox"
            role="switch"
            className="peer sr-only"
            checked={branch.visible}
            disabled={disabled}
            aria-label={fmt(t.visibleFor, { name: location.name })}
            onChange={(e) => onChange({ visible: e.target.checked })}
          />
          <span aria-hidden className="max-sm:sr-only">
            {t.visible}
          </span>
          <span
            aria-hidden
            className="relative h-7 w-12 shrink-0 rounded-full bg-line-strong transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:opacity-55 after:absolute after:start-0.5 after:top-0.5 after:size-6 after:rounded-full after:bg-white after:shadow-[0_1px_3px_rgb(0_0_0/0.3)] after:transition-transform after:duration-[var(--dur-pop)] after:ease-[var(--ease-pop)] after:content-[''] peer-checked:after:translate-x-5 motion-reduce:transition-none motion-reduce:after:transition-none rtl:peer-checked:after:-translate-x-5"
          />
        </label>
      }
    >
      {!branch.visible && <p className="text-[13px] leading-5 text-ink-soft">{t.hiddenNote}</p>}
      {!location.isActive && (
        <p className="mb-3 flex items-start gap-2 rounded-[var(--radius)] bg-accent-soft px-3 py-2.5 text-sm text-accent-dark">
          <IconInfo className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t.inactive}
        </p>
      )}
      {branch.visible && (
        <div className={`space-y-4 ${TOUCH_FIELDS}`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.phone}>
              {(props) => (
                <Input
                  {...props}
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  autoComplete="off"
                  maxLength={STORE_LOCATOR_PHONE_MAX}
                  value={branch.phone}
                  onChange={(e) => onChange({ phone: e.target.value })}
                  disabled={disabled}
                  className="min-h-11 text-start"
                />
              )}
            </Field>
            <Field label={t.whatsapp} hint={t.whatsappHint}>
              {(props) => (
                <Input
                  {...props}
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  autoComplete="off"
                  maxLength={STORE_LOCATOR_PHONE_MAX}
                  value={branch.whatsapp}
                  onChange={(e) => onChange({ whatsapp: e.target.value })}
                  disabled={disabled}
                  className="min-h-11 text-start"
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.hoursAr} hint={`${t.hoursHint} (${count(branch.hoursAr)})`}>
              {(props) => (
                <Textarea
                  {...props}
                  rows={3}
                  dir="rtl"
                  maxLength={STORE_LOCATOR_TEXT_MAX}
                  value={branch.hoursAr}
                  onChange={(e) => onChange({ hoursAr: e.target.value })}
                  disabled={disabled}
                  className="text-base sm:text-sm"
                />
              )}
            </Field>
            <Field label={t.hoursEn} hint={count(branch.hoursEn)}>
              {(props) => (
                <Textarea
                  {...props}
                  rows={3}
                  dir="ltr"
                  maxLength={STORE_LOCATOR_TEXT_MAX}
                  value={branch.hoursEn}
                  onChange={(e) => onChange({ hoursEn: e.target.value })}
                  disabled={disabled}
                  className="text-start text-base sm:text-sm"
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.noteAr} hint={`${t.noteHint} (${count(branch.noteAr)})`}>
              {(props) => (
                <Textarea
                  {...props}
                  rows={2}
                  dir="rtl"
                  maxLength={STORE_LOCATOR_TEXT_MAX}
                  value={branch.noteAr}
                  onChange={(e) => onChange({ noteAr: e.target.value })}
                  disabled={disabled}
                  className="min-h-[60px] text-base sm:text-sm"
                />
              )}
            </Field>
            <Field label={t.noteEn} hint={count(branch.noteEn)}>
              {(props) => (
                <Textarea
                  {...props}
                  rows={2}
                  dir="ltr"
                  maxLength={STORE_LOCATOR_TEXT_MAX}
                  value={branch.noteEn}
                  onChange={(e) => onChange({ noteEn: e.target.value })}
                  disabled={disabled}
                  className="min-h-[60px] text-start text-base sm:text-sm"
                />
              )}
            </Field>
          </div>

          <div role="group" aria-labelledby={`${idBase}-pin`} className="space-y-3 rounded-[var(--radius)] bg-paper-sunken p-3">
            <p id={`${idBase}-pin`} className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <IconPlace className="size-4 shrink-0 text-ink-soft" aria-hidden />
              {t.pin}
            </p>
            <p className="text-xs text-ink-soft">{t.pinHelp}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor={`${idBase}-lat`} className="block text-sm font-medium text-ink">
                  {t.lat}
                </label>
                <Input
                  id={`${idBase}-lat`}
                  dir="ltr"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={24}
                  placeholder="30.0444"
                  value={branch.lat}
                  aria-invalid={errors.lat ? true : undefined}
                  aria-describedby={errors.lat ? `${idBase}-lat-error` : undefined}
                  onPaste={onPinPaste}
                  onChange={(e) => onChange({ lat: e.target.value })}
                  disabled={disabled}
                  className={`min-h-11 bg-paper-raised text-start tabular-nums${errors.lat ? " border-danger focus-visible:ring-danger/30" : ""}`}
                />
                {errors.lat && (
                  <p id={`${idBase}-lat-error`} className="text-xs font-medium text-danger">
                    {errors.lat}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`${idBase}-lng`} className="block text-sm font-medium text-ink">
                  {t.lng}
                </label>
                <Input
                  id={`${idBase}-lng`}
                  dir="ltr"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={24}
                  placeholder="31.2357"
                  value={branch.lng}
                  aria-invalid={errors.lng ? true : undefined}
                  aria-describedby={errors.lng ? `${idBase}-lng-error` : undefined}
                  onPaste={onPinPaste}
                  onChange={(e) => onChange({ lng: e.target.value })}
                  disabled={disabled}
                  className={`min-h-11 bg-paper-raised text-start tabular-nums${errors.lng ? " border-danger focus-visible:ring-danger/30" : ""}`}
                />
                {errors.lng && (
                  <p id={`${idBase}-lng-error`} className="text-xs font-medium text-danger">
                    {errors.lng}
                  </p>
                )}
              </div>
            </div>
            {pinned ? (
              <a
                href={`https://www.google.com/maps?q=${lat},${lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline md:min-h-0"
              >
                <IconExternal className="size-4" aria-hidden />
                {t.checkPin}
              </a>
            ) : (
              !branch.lat.trim() && !branch.lng.trim() && <p className="text-xs text-ink-soft">{t.noPin}</p>
            )}
          </div>
        </div>
      )}
    </AccordionSection>
  );
}
