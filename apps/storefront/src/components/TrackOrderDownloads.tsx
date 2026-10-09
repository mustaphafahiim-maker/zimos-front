"use client";

import type { TrackDownload, TrackResult } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { StoreLink } from "./StoreRoute";
import { focusRing } from "./ui";

const STRINGS = {
  en: { title: "Your digital products", open: "Open" },
  ar: { title: "منتجاتك الرقمية", open: "افتح" },
};

/** Download links of the digital products in a paid order (tracking result `downloads`). */
export function TrackOrderDownloads({ result }: { result: TrackResult }) {
  const { intlLocale } = useStore();
  const downloads = (result as TrackResult & { downloads?: TrackDownload[] }).downloads ?? [];
  if (downloads.length === 0) return null;
  const t = intlLocale.startsWith("ar") ? STRINGS.ar : STRINGS.en;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
      <ul className="mt-2 space-y-2">
        {downloads.map((download) => (
          <li key={download.token} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-paper py-0.5 ps-3 pe-1 text-sm text-ink">
            <bdi className="min-w-0 truncate">{download.productName}</bdi>
            {/* A full thumb-sized target, not a word of text. */}
            <StoreLink
              href={`/downloads/${download.token}`}
              className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-3 font-semibold text-primary hover:underline ${focusRing}`}
            >
              {t.open}
            </StoreLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
