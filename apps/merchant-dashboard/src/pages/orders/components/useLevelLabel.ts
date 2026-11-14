import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    level_city: "City",
    level_district: "District",
    level_governorate: "Governorate",
    level_province: "Province",
    level_region: "Region",
    level_zone: "Zone",
    level_area: "Area",
    level_neighborhood: "Neighborhood",
  },
  ar: {
    level_city: "المدينة",
    level_district: "المنطقة",
    level_governorate: "المحافظة",
    level_province: "المحافظة",
    level_region: "الإقليم",
    level_zone: "النطاق",
    level_area: "الحي",
    level_neighborhood: "الحي",
  },
} satisfies Messages;

/** A level name from the courier ("governorate") in the active language; unknown ones as sent. */
export function useLevelLabel() {
  const t = useT(STRINGS);
  return (level: string) => {
    const key = `level_${level.toLowerCase()}` as keyof (typeof STRINGS)["en"];
    if (key in t) return t[key];
    return level ? level.charAt(0).toUpperCase() + level.slice(1).replace(/_/g, " ") : level;
  };
}

