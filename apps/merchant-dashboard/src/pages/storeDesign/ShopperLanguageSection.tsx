import { useState } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Section } from "@/components/Section";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { useSaveThemeSettings } from "@/lib/themeSettingsSave";

const STRINGS = {
  en: {
    title: "Shoppers' language",
    description: "The language your store opens in, and whether shoppers can switch it.",
    opensIn: "Store opens in",
    opensInHint: "A shopper's own choice wins. Anything you haven't translated shows as you wrote it.",
    ar: "Arabic",
    en: "English",
    button: "Show the language button",
    buttonHint: "A button in your store's header and phone menu that switches between Arabic and English.",
    ownHeader: "Your store's current header has its own switch: website editor → Header.",
    saved: "Saved.",
  },
  ar: {
    title: "لغة المشترين",
    description: "اللغة التي يفتح بها متجرك، وهل يستطيع المشتري تغييرها.",
    opensIn: "يفتح المتجر بـ",
    opensInHint: "اختيار المشتري نفسه يتقدّم على هذا. وما لم تترجمه يظهر كما كتبته.",
    ar: "العربية",
    en: "الإنجليزية",
    button: "إظهار زر اللغة",
    buttonHint: "زر في رأس متجرك وقائمة الجوال للتبديل بين العربية والإنجليزية.",
    ownHeader: "رأس متجرك الحالي له زر خاص به: محرر الموقع ← الرأس.",
    saved: "تم الحفظ.",
  },
} satisfies Messages;

type Blob = Record<string, unknown>;

/**
 * What a shopper sees first and what they may switch, saved in themeSettings
 * as `shopperDisplay` (read by the storefront's lib/shopperDisplay, and by the
 * API for the language it answers in):
 *
 *   locale         "ar" | "en": the language the store opens in for a shopper who hasn't picked one
 *   localeSwitch   the language button in a template's header and phone menu
 *
 * Built to take more of the same kind later (a colour mode and its switch).
 * A store that never saved it reads as Arabic and no button: exactly how
 * every store worked before.
 */
interface ShopperDisplay {
  locale: "ar" | "en";
  localeSwitch: boolean;
}

function readShopperDisplay(themeSettings: unknown): ShopperDisplay {
  const settings = themeSettings && typeof themeSettings === "object" && !Array.isArray(themeSettings) ? (themeSettings as Blob) : {};
  const raw = settings.shopperDisplay;
  const display = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Blob) : {};
  return { locale: display.locale === "en" ? "en" : "ar", localeSwitch: display.localeSwitch === true };
}

/** The settings with one part of shopperDisplay changed; whatever else is in it is kept. */
function withShopperDisplay(themeSettings: Blob, change: Partial<ShopperDisplay>): Blob {
  const raw = themeSettings.shopperDisplay;
  const kept = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Blob) : {};
  return { ...themeSettings, shopperDisplay: { ...kept, ...readShopperDisplay(themeSettings), ...change } };
}

/** Store settings → Languages: the language the store opens in, and the language button. Each change saves at once. */
export function ShopperLanguageSection() {
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace } = useWorkspace();
  const save = useSaveThemeSettings();
  const [busy, setBusy] = useState(false);

  const themeSettings = currentWorkspace?.themeSettings;
  const display = readShopperDisplay(themeSettings);
  // The button sits in an imported template's header; any other header has its own switch in the editor.
  const xsLook = (themeSettings as Blob | undefined)?.xsLook;
  const templateHeader = typeof xsLook === "string" && xsLook.trim() !== "";

  async function change(next: Partial<ShopperDisplay>) {
    setBusy(true);
    try {
      // Built on the server's copy, so nothing another screen saved meanwhile is lost (lib/themeSettingsSave).
      await save((current) => {
        const was = readShopperDisplay(current);
        if (Object.entries(next).every(([key, value]) => was[key as keyof ShopperDisplay] === value)) return null;
        return { themeSettings: withShopperDisplay(current, next) };
      });
      toast.success(t.saved);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={t.title} description={t.description}>
      <div className="divide-y divide-line" data-slot="shopper-language">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{t.opensIn}</p>
            <p className="mt-0.5 text-xs text-ink-soft">{t.opensInHint}</p>
          </div>
          <Segmented
            size="sm"
            value={display.locale}
            onChange={(locale) => {
              if (!busy) void change({ locale });
            }}
            label={t.opensIn}
            options={[
              { value: "ar", label: t.ar },
              { value: "en", label: t.en },
            ]}
          />
        </div>
        <label className="flex cursor-pointer items-start justify-between gap-3 pt-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink">{t.button}</span>
            <span className="mt-0.5 block text-xs text-ink-soft">{templateHeader ? t.buttonHint : `${t.buttonHint} ${t.ownHeader}`}</span>
          </span>
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-primary"
            checked={display.localeSwitch}
            disabled={busy}
            onChange={(e) => void change({ localeSwitch: e.target.checked })}
          />
        </label>
      </div>
    </Section>
  );
}
