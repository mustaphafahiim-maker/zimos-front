import { useSearchParams } from "react-router-dom";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { SectionTabs } from "@/components/SectionTabs";

const STRINGS = {
  en: { label: "Shipping sections", rates: "Shipping prices", places: "Places", options: "Shipping options", carriers: "Shipping companies", taxes: "Taxes" },
  ar: { label: "أقسام الشحن", rates: "أسعار الشحن", places: "المناطق", options: "خيارات الشحن", carriers: "شركات الشحن", taxes: "الضرائب" },
} satisfies Messages;

const TABS = ["rates", "places", "options", "carriers", "taxes"] as const;
export type ShippingTab = (typeof TABS)[number];

/** The shipping page's tabs (SPEC §12.5), kept in the URL (?tab=) so a link opens the right one. */
export function useShippingTab(): [ShippingTab, (tab: ShippingTab) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: ShippingTab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as ShippingTab) : "rates";
  const set = (next: ShippingTab) =>
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next === "rates") out.delete("tab");
        else out.set("tab", next);
        return out;
      },
      { replace: true }
    );
  return [tab, set];
}

export function ShippingTabsBar({ value, onChange }: { value: ShippingTab; onChange: (tab: ShippingTab) => void }) {
  const t = useT(STRINGS);
  return <SectionTabs label={t.label} value={value} onChange={onChange} tabs={TABS.map((key) => ({ value: key, label: t[key] }))} />;
}
