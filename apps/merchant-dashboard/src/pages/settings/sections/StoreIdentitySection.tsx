import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useSaveThemeSettings } from "@/lib/themeSettingsSave";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { ACCEPTED_IMAGE_ACCEPT, compressImageIfNeeded, validateImageFile } from "@/lib/media";
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY, normalizeHex, readThemeColor } from "@/lib/brandColors";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { ColorField } from "@/components/ColorField";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsRow } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { SettingsCard } from "./SettingsCard";

const STRINGS = {
  en: {
    profileSaved: "Store identity saved.",
    name: "Store name",
    nameHint: "Shown on your store, on invoices and in messages to customers.",
    logo: "Logo",
    logoAlt: "Store logo",
    logoNone: "None",
    logoResizing: "Resizing…",
    logoUploading: "Uploading…",
    logoUpload: "Upload logo",
    logoChange: "Change logo",
    logoFormats: "PNG, JPEG, GIF or WEBP, up to 10 MB.",
    remove: "Remove",
    tagline: "Tagline",
    taglineHint: "Optional — a short line shown under your store name.",
    coloursTitle: "Store colours",
    coloursHint: "Used for your storefront header, buttons and links.",
    primary: "Primary",
    primaryHint: "Buttons, links and highlights.",
    secondary: "Secondary",
    secondaryHint: "Accents and badges.",
    preview: "Preview",
    previewAddToCart: "Add to cart",
    previewSale: "Sale",
    previewDetails: "View details",
    save: "Save",
    saving: "Saving…",
    discard: "Discard",
  },
  ar: {
    profileSaved: "اتحفظت هوية المتجر.",
    name: "اسم المتجر",
    nameHint: "بيظهر في متجرك وعلى الفواتير وفي الرسايل اللي بتوصل العميل.",
    logo: "اللوجو",
    logoAlt: "لوجو المتجر",
    logoNone: "مفيش",
    logoResizing: "بنصغّر الصورة…",
    logoUploading: "بنرفع…",
    logoUpload: "ارفع لوجو",
    logoChange: "غيّر اللوجو",
    logoFormats: "PNG أو JPEG أو GIF أو WEBP، لحد 10 ميجا.",
    remove: "شيله",
    tagline: "جملة تعريف",
    taglineHint: "اختياري — سطر قصير بيظهر تحت اسم متجرك.",
    coloursTitle: "ألوان المتجر",
    coloursHint: "بتتستخدم في الشريط اللي فوق والأزرار واللينكات في متجرك.",
    primary: "اللون الأساسي",
    primaryHint: "الأزرار واللينكات والحاجات البارزة.",
    secondary: "اللون التاني",
    secondaryHint: "علامات التمييز والشارات.",
    preview: "معاينة",
    previewAddToCart: "أضف للسلة",
    previewSale: "تخفيض",
    previewDetails: "شوف التفاصيل",
    save: "حفظ",
    saving: "بنحفظ…",
    discard: "تجاهل",
  },
} satisfies Messages;

interface Snapshot {
  name: string;
  tagline: string;
  logoUrl: string | null;
  primary: string;
  secondary: string;
}

/**
 * Settings → «هوية المتجر»: the store's name, logo, tagline and its two
 * colours. One save for all of it (PATCH /workspaces/:id through
 * `useSaveThemeSettings`, exactly as before); the shared SaveBar shows while
 * anything differs from what is saved, and the page asks before the edit is
 * left behind.
 */
export function StoreIdentitySection() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const saveThemeSettings = useSaveThemeSettings();
  const toast = useToast();
  const nameId = useId();
  const taglineId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  // What the colour fields opened with: a colour is only written once the
  // merchant changes it here, so saving the name or logo never pins the
  // platform default over a store theme's own accent.
  const [initialColors] = useState(() => ({
    primary: readThemeColor(currentWorkspace?.themeSettings, "primaryColor", DEFAULT_PRIMARY),
    secondary: readThemeColor(currentWorkspace?.themeSettings, "secondaryColor", DEFAULT_SECONDARY),
  }));
  // What is saved now: the SaveBar shows while the form differs from it.
  const [saved, setSaved] = useState<Snapshot>(() => ({
    name: currentWorkspace?.name ?? "",
    tagline: currentWorkspace?.tagline ?? "",
    logoUrl: currentWorkspace?.logoUrl ?? null,
    primary: initialColors.primary,
    secondary: initialColors.secondary,
  }));
  const [name, setName] = useState(saved.name);
  const [tagline, setTagline] = useState(saved.tagline);
  const [logoUrl, setLogoUrl] = useState<string | null>(saved.logoUrl);
  const [logoStage, setLogoStage] = useState<"preparing" | "uploading" | null>(null);
  const uploading = logoStage !== null;
  const [primaryColor, setPrimaryColor] = useState(saved.primary);
  const [secondaryColor, setSecondaryColor] = useState(saved.secondary);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const colorsValid = Boolean(normalizeHex(primaryColor) && normalizeHex(secondaryColor));

  const dirty =
    name !== saved.name ||
    tagline !== saved.tagline ||
    logoUrl !== saved.logoUrl ||
    primaryColor !== saved.primary ||
    secondaryColor !== saved.secondary;
  useReportDirty(dirty);

  async function onLogoFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again after a failure
    if (!file) return;
    setFormError(null);
    try {
      // Resize first if it is over the 5 MB cap, so a big logo export uploads
      // instead of being rejected.
      setLogoStage("preparing");
      const prepared = await compressImageIfNeeded(file);
      const problem = validateImageFile(prepared);
      if (problem) {
        setFormError(problem);
        return;
      }
      setLogoStage("uploading");
      const media = await apiClient.uploadMedia(workspaceId, prepared);
      setLogoUrl(media.url);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setLogoStage(null);
    }
  }

  function discard() {
    setName(saved.name);
    setTagline(saved.tagline);
    setLogoUrl(saved.logoUrl);
    setPrimaryColor(saved.primary);
    setSecondaryColor(saved.secondary);
    setFormError(null);
    setFieldErrors({});
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || uploading || !name.trim() || !colorsValid) return;
    setFormError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      const primary = normalizeHex(primaryColor) ?? DEFAULT_PRIMARY;
      const secondary = normalizeHex(secondaryColor) ?? DEFAULT_SECONDARY;
      await saveThemeSettings((current) => {
        // Merge, never replace: themeSettings is a shared blob and may already
        // carry keys owned by other parts of the product.
        const themeSettings: Record<string, unknown> = { ...current };
        if (primary !== initialColors.primary) {
          themeSettings.primaryColor = primary;
          // The merchant's own colour now, no longer one a template carried over.
          delete themeSettings.primaryColorSource;
        }
        if (secondary !== initialColors.secondary) themeSettings.secondaryColor = secondary;
        return { name: name.trim(), tagline: tagline.trim() || null, logoUrl, themeSettings };
      });
      setSaved({ name, tagline, logoUrl, primary: primaryColor, secondary: secondaryColor });
      toast.success(t.profileSaved);
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const primaryShown = normalizeHex(primaryColor) ?? DEFAULT_PRIMARY;
  const secondaryShown = normalizeHex(secondaryColor) ?? DEFAULT_SECONDARY;

  return (
    <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
      <SettingsGroup>
        <SettingsRow
          label={t.name}
          hint={t.nameHint}
          htmlFor={nameId}
          error={fieldErrors.name}
          control={
            <Input
              id={nameId}
              required
              value={name}
              aria-invalid={fieldErrors.name ? true : undefined}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full text-base sm:text-sm"
            />
          }
        />
        <SettingsRow
          label={t.tagline}
          hint={t.taglineHint}
          htmlFor={taglineId}
          error={fieldErrors.tagline}
          control={
            <Input
              id={taglineId}
              value={tagline}
              aria-invalid={fieldErrors.tagline ? true : undefined}
              onChange={(e) => setTagline(e.target.value)}
              className="h-11 w-full text-base sm:text-sm"
            />
          }
        />
        <SettingsRow
          label={t.logo}
          hint={t.logoFormats}
          control={
            <div className="flex flex-wrap items-center justify-end gap-2">
              {logoUrl ? (
                <img src={logoUrl} alt={t.logoAlt} className="size-12 rounded-xl bg-paper object-contain ring-1 ring-line" />
              ) : (
                <div className="flex size-12 items-center justify-center rounded-xl border border-dashed border-line-strong text-[11px] text-ink-soft">
                  {t.logoNone}
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_IMAGE_ACCEPT}
                className="sr-only"
                aria-label={t.logoUpload}
                tabIndex={-1}
                disabled={uploading}
                onChange={onLogoFile}
              />
              <Button type="button" variant="outline" className="min-h-11" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {logoStage === "preparing" ? t.logoResizing : logoStage === "uploading" ? t.logoUploading : logoUrl ? t.logoChange : t.logoUpload}
              </Button>
              {logoUrl && (
                <Button type="button" variant="ghost" className="min-h-11" disabled={uploading} onClick={() => setLogoUrl(null)}>
                  {t.remove}
                </Button>
              )}
            </div>
          }
        />
      </SettingsGroup>

      <SettingsCard title={t.coloursTitle} description={t.coloursHint}>
        <div className="grid gap-5 sm:grid-cols-2">
          <ColorField label={t.primary} hint={t.primaryHint} value={primaryColor} onChange={setPrimaryColor} />
          <ColorField label={t.secondary} hint={t.secondaryHint} value={secondaryColor} onChange={setSecondaryColor} />
        </div>
        <div className="mt-4">
          <p className="text-[13px] leading-5 font-medium text-ink-soft">{t.preview}</p>
          <div
            className="mt-1.5 flex flex-wrap items-center gap-3 rounded-[0.875rem] p-3 ring-1 ring-line"
            style={{ backgroundColor: `${primaryShown}14` }}
          >
            <span className="rounded-full px-3.5 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: primaryShown }}>
              {t.previewAddToCart}
            </span>
            <span className="rounded-full px-2.5 py-1 text-xs font-medium text-white" style={{ backgroundColor: secondaryShown }}>
              {t.previewSale}
            </span>
            <span className="text-sm font-medium" style={{ color: primaryShown }}>
              {t.previewDetails}
            </span>
          </div>
        </div>
      </SettingsCard>

      {formError && <Alert variant="danger">{formError}</Alert>}

      <SaveBar
        dirty={dirty}
        saving={saving}
        disabled={uploading || !name.trim() || !colorsValid}
        saveLabel={t.save}
        savingLabel={t.saving}
        discardLabel={t.discard}
        onDiscard={discard}
      />
    </form>
  );
}
