import { useCallback, useMemo } from "react";
import type { WebAnalyticsFilterKey } from "@store-builder/api-client";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { countryName, flagOf } from "@/lib/webAnalytics";
import { safeDecode, type TrafficDim } from "./model";
import { STORE_STRINGS } from "./strings";

/**
 * A raw value of the web analytics (a path, a country code, a device key) as
 * it is shown: its words, the direction they are written in — a path or a
 * domain is always left to right, a page title follows its own first letter —
 * and a flag for a country.
 */
export interface ShownValue {
  text: string;
  dir: "ltr" | "auto";
  flag?: string;
}

/** A shown value: the flag (decoration) and the words in their own direction. */
export function ValueText({ value }: { value: ShownValue }) {
  return (
    <>
      {value.flag && (
        <span aria-hidden className="me-1.5">
          {value.flag}
        </span>
      )}
      <bdi dir={value.dir}>{value.text}</bdi>
    </>
  );
}

/**
 * The names of the tab's breakdowns and filters, and how each raw value reads:
 * a channel and a device in words, a country by its name in the dashboard's
 * language with its flag, a page path decoded.
 */
export function useStoreLabels() {
  const t = useT(STORE_STRINGS);
  const { intlLocale } = useLocale();

  return useMemo(() => {
    const dimLabel: Record<TrafficDim, string> = {
      path: t.dim_path,
      title: t.dim_title,
      referrer: t.dim_referrer,
      channel: t.dim_channel,
      utm_source: t.dim_utm_source,
      utm_campaign: t.dim_utm_campaign,
      device: t.dim_device,
      browser: t.dim_browser,
      os: t.dim_os,
      screen: t.dim_screen,
      language: t.dim_language,
      country: t.dim_country,
      region: t.dim_region,
      city: t.dim_city,
    };
    const filterLabel: Record<WebAnalyticsFilterKey, string> = {
      url: t.f_url,
      referrer: t.f_referrer,
      title: t.f_title,
      browser: t.f_browser,
      os: t.f_os,
      device: t.f_device,
      country: t.f_country,
      region: t.f_region,
      city: t.f_city,
      language: t.f_language,
      screen: t.f_screen,
      event: t.f_event,
      hostname: t.f_hostname,
      tag: t.f_tag,
      utm_source: t.f_utm_source,
      utm_medium: t.f_utm_medium,
      utm_campaign: t.f_utm_campaign,
      utm_content: t.f_utm_content,
      utm_term: t.f_utm_term,
    };
    // The channels the API sorts a visit into (web analytics, "channel" metric).
    const channels: Record<string, string> = {
      direct: t.channel_direct,
      paidAds: t.channel_paidAds,
      referral: t.channel_referral,
      affiliate: t.channel_affiliate,
      sms: t.channel_sms,
      llm: t.channel_llm,
      organicSearch: t.channel_organicSearch,
      paidSearch: t.channel_paidSearch,
      organicSocial: t.channel_organicSocial,
      paidSocial: t.channel_paidSocial,
      email: t.channel_email,
      organicShopping: t.channel_organicShopping,
      paidShopping: t.channel_paidShopping,
      organicVideo: t.channel_organicVideo,
      paidVideo: t.channel_paidVideo,
    };
    const devices: Record<string, string> = {
      mobile: t.device_mobile,
      laptop: t.device_laptop,
      desktop: t.device_desktop,
      tablet: t.device_tablet,
      unknown: t.unknownValue,
    };

    const device = (raw: string): string => devices[raw] ?? raw;

    const language = (code: string): string => {
      try {
        return new Intl.DisplayNames([intlLocale], { type: "language" }).of(code) ?? code;
      } catch {
        return code;
      }
    };

    /** How a raw value of a breakdown, or of a filter, is shown. */
    function shown(kind: TrafficDim | WebAnalyticsFilterKey, raw: string): ShownValue {
      if (raw === "") return { text: t.unknownValue, dir: "auto" };
      switch (kind) {
        case "path":
        case "url":
          return { text: safeDecode(raw), dir: "ltr" };
        case "referrer":
          return raw === "direct" ? { text: t.direct, dir: "auto" } : { text: raw, dir: "ltr" };
        case "channel":
          return { text: channels[raw] ?? raw, dir: "auto" };
        case "device":
          return { text: device(raw), dir: "auto" };
        case "country":
          return { text: countryName(raw, intlLocale), dir: "auto", flag: flagOf(raw) || undefined };
        case "language":
          return { text: language(raw), dir: "auto" };
        case "browser":
        case "os":
        case "screen":
        case "hostname":
          return { text: raw, dir: "ltr" };
        default:
          // A page title, a UTM value, a region, a city, an event, a tag: as written.
          return { text: raw, dir: "auto" };
      }
    }

    return { dimLabel, filterLabel, shown, device, direct: t.direct };
  }, [t, intlLocale]);
}

/** Seconds as «١ د ٣٢ ث» / "1m 32s" in the dashboard's language; "—" when there is no visit to time. */
export function useDurationText() {
  const t = useT(STORE_STRINGS);
  return useCallback(
    (seconds: number | null | undefined): string => {
      if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
      const whole = Math.max(0, Math.round(seconds));
      const hours = Math.floor(whole / 3600);
      const minutes = Math.floor((whole % 3600) / 60);
      if (hours > 0) return fmt(t.durHours, { h: hours, m: minutes });
      if (minutes > 0) return fmt(t.durMinutes, { m: minutes, s: whole % 60 });
      return fmt(t.durSeconds, { s: whole });
    },
    [t]
  );
}
