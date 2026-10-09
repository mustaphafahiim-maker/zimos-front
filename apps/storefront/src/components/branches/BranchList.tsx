"use client";

import { useEffect, useMemo, useState } from "react";
import { storefrontBranches, type StorefrontBranch } from "@store-builder/api-client";
import { PhoneIcon, WhatsAppIcon } from "@/components/Icons";
import { btnPrimary, btnSecondary, card } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { whatsappNumber } from "@/lib/egypt";
import { branchCopy, branchText } from "@/lib/storeBranches";
import { useStore } from "@/lib/StoreContext";

/** Stroke glyphs in the storefront's own icon style (components/Icons.tsx keeps its base private). */
function Glyph({ size = 18, children }: { size?: number; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}
const PinGlyph = ({ size }: { size?: number }) => (
  <Glyph size={size}>
    <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </Glyph>
);
const ClockGlyph = ({ size }: { size?: number }) => (
  <Glyph size={size}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Glyph>
);
const TargetGlyph = ({ size }: { size?: number }) => (
  <Glyph size={size}>
    <circle cx="12" cy="12" r="6.5" />
    <circle cx="12" cy="12" r="1.6" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
  </Glyph>
);
const RouteGlyph = ({ size }: { size?: number }) => (
  <Glyph size={size}>
    <path d="M12 3.5 20.5 12 12 20.5 3.5 12Z" />
    <path d="M9.5 14v-2.5h5M12.5 9.5l2 2-2 2" />
  </Glyph>
);

/** Whether this document may ask for the shopper's location at all (a Permissions-Policy can rule it out). */
function locationAllowed(): boolean {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return false;
  const policy = (document as Document & { featurePolicy?: { allowsFeature?: (name: string) => boolean } }).featurePolicy;
  try {
    return policy?.allowsFeature ? policy.allowsFeature("geolocation") : true;
  } catch {
    return true;
  }
}

/** About 100 m: plenty to rank branches by distance, and it says less about where the shopper stands. */
const coarse = (value: number) => Math.round(value * 1000) / 1000;

/**
 * The branches of the «فروعنا» page (frontend-handoff 233): a card per branch
 * with its address, hours and note, «اتصل», «واتساب» and «الاتجاهات».
 * «أقرب فرع ليا» asks the browser for the shopper's location — only when it
 * is pressed — and reads the list again nearest first, with each distance.
 * A refusal, a timeout or a browser without location all end the same quiet
 * way: one line of text, and the list as it was.
 */
export function BranchList({ initial }: { initial: StorefrontBranch[] }) {
  const { locale, store } = useStore();
  const c = branchCopy(locale);
  const client = useMemo(() => createStorefrontApiClient({ locale }), [locale]);
  const [list, setList] = useState<{ branches: StorefrontBranch[]; nearestId: string | null }>({ branches: initial, nearestId: null });
  const [status, setStatus] = useState<"idle" | "asking" | "sorted" | "unavailable">("idle");
  // Decided after mount: the server cannot know what the browser allows.
  const [canAsk, setCanAsk] = useState(false);
  useEffect(() => setCanAsk(locationAllowed()), []);

  const hasPins = initial.some((branch) => branch.lat !== null && branch.lng !== null);
  const storeRef = store?.id ?? store?.workspaceId ?? "";

  function findNearest() {
    if (status === "asking" || !storeRef) return;
    setStatus("asking");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const near = { lat: coarse(position.coords.latitude), lng: coarse(position.coords.longitude) };
        storefrontBranches(client, storeRef, near)
          .then((answer) => {
            if (!answer) return setStatus("unavailable");
            setList({ branches: answer.branches, nearestId: answer.nearest?.id ?? null });
            setStatus("sorted");
          })
          .catch(() => setStatus("unavailable"));
      },
      () => setStatus("unavailable"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  }

  if (list.branches.length === 0) {
    return <p className={`${card} mt-6 px-5 py-10 text-center text-sm text-ink-soft`}>{c.empty}</p>;
  }

  return (
    <>
      {canAsk && hasPins && (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="button" onClick={findNearest} disabled={status === "asking"} className={btnSecondary}>
            <TargetGlyph />
            {status === "asking" ? c.locating : c.nearest}
          </button>
          <p aria-live="polite" className="min-w-0 text-sm text-ink-soft empty:hidden">
            {status === "sorted" ? c.sorted : status === "unavailable" ? c.noLocation : ""}
          </p>
        </div>
      )}

      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {list.branches.map((branch) => {
          const hours = branchText(branch.hours, locale);
          const note = branchText(branch.note, locale);
          const phone = branch.phone?.trim() || null;
          const wa = branch.whatsapp ? whatsappNumber(branch.whatsapp) : null;
          const nearest = branch.id === list.nearestId;
          return (
            <li key={branch.id} className={`${card} flex flex-col p-5 sm:p-6 ${nearest ? "border-primary" : ""}`.trimEnd()}>
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <h2 className="min-w-0 text-lg font-semibold text-ink">
                  <bdi>{branch.name}</bdi>
                </h2>
                {(nearest || branch.pickup || branch.distanceKm !== null) && (
                  <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                    {nearest && <span className="rounded-full bg-primary px-2.5 py-1 text-on-primary">{c.nearestBadge}</span>}
                    {branch.distanceKm !== null && <span className="rounded-full bg-primary-soft px-2.5 py-1 text-primary">{c.distance(branch.distanceKm)}</span>}
                    {branch.pickup && <span className="rounded-full bg-success-soft px-2.5 py-1 text-success">{c.pickup}</span>}
                  </p>
                )}
              </div>

              <div className="mt-3 flex-1 space-y-2.5 text-sm text-ink-soft">
                {branch.address && (
                  <p className="flex items-start gap-2">
                    <span className="mt-0.5 text-ink-soft">
                      <PinGlyph />
                    </span>
                    <bdi className="min-w-0 text-ink">{branch.address}</bdi>
                  </p>
                )}
                {hours && (
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-ink-soft">
                      <ClockGlyph />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-ink-soft">{c.hours}</p>
                      <p className="whitespace-pre-line text-ink">{hours}</p>
                    </div>
                  </div>
                )}
                {note && <p className="whitespace-pre-line">{note}</p>}
              </div>

              {(phone || wa || branch.directionsUrl) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {branch.directionsUrl && (
                    <a
                      href={branch.directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={c.directionsTo(branch.name)}
                      className={`${btnPrimary} flex-1 whitespace-nowrap`}
                    >
                      <RouteGlyph />
                      {c.directions}
                    </a>
                  )}
                  {phone && (
                    <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} aria-label={c.callBranch(branch.name)} className={`${btnSecondary} flex-1 whitespace-nowrap`}>
                      <PhoneIcon size={18} />
                      {c.call}
                      <bdi dir="ltr" className="font-normal text-ink-soft">
                        {phone}
                      </bdi>
                    </a>
                  )}
                  {wa && (
                    <a
                      href={`https://wa.me/${wa}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={c.whatsappBranch(branch.name)}
                      className={`${btnSecondary} flex-1 whitespace-nowrap`}
                    >
                      <WhatsAppIcon size={18} />
                      {c.whatsapp}
                    </a>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
