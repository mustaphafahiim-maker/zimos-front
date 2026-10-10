import { useEffect, useRef, useState } from "react";
import { IconCaretLeft, IconCaretRight, IconClose, IconExternal, IconImageMissing, IconUser } from "@/components/icons";
import { Button, cn } from "@store-builder/ui";
import type { ReturnPhoto, ReturnReasonCode } from "@store-builder/api-client";
import { Modal } from "@/components/Modal";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    fromCustomer: "From customer",
    photos: "Customer's photos",
    openPhoto: "Open photo {n} of {total}",
    photoAlt: "Photo {n} from the customer",
    photoOf: "Photo {n} of {total}",
    previous: "Previous photo",
    next: "Next photo",
    newTab: "Open in a new tab",
    closePhoto: "Close the photo",
    unavailable: "This photo didn't load. Reload the page to try again.",
  },
  ar: {
    fromCustomer: "من العميل",
    photos: "صور العميل",
    openPhoto: "فتح الصورة {n} من {total}",
    photoAlt: "صورة {n} من العميل",
    photoOf: "صورة {n} من {total}",
    previous: "الصورة السابقة",
    next: "الصورة التالية",
    newTab: "فتحها في تبويب جديد",
    closePhoto: "إغلاق الصورة",
    unavailable: "تعذّر تحميل هذه الصورة. حدّث الصفحة وحاول مرة أخرى.",
  },
} satisfies Messages;

/**
 * The reasons a return names, in the words the customer picked them from on
 * the store: the same words everywhere returns
 * show, so the merchant reads what the customer chose.
 */
export const RETURN_REASON_TEXT = {
  en: {
    damaged: "Damaged",
    defective: "Defective",
    wrong_item: "Wrong item",
    not_as_described: "Not as described",
    no_longer_wanted: "No longer wanted",
    arrived_late: "Arrived late",
    other: "Other",
  },
  ar: {
    damaged: "وصل تالفًا",
    defective: "به عيب",
    wrong_item: "منتج خاطئ",
    not_as_described: "لا يطابق الوصف",
    no_longer_wanted: "لم يعد مطلوبًا",
    arrived_late: "وصل متأخرًا",
    other: "سبب آخر",
  },
} satisfies { en: Record<ReturnReasonCode, string>; ar: Record<ReturnReasonCode, string> };

/** "From customer": a return the shopper asked for from the store, not one opened here. */
export function ReturnSourceBadge() {
  const t = useT(STRINGS);
  return (
    <span
      data-slot="return-source"
      className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-primary-dark"
    >
      <IconUser className="size-3.5 shrink-0" aria-hidden />
      {t.fromCustomer}
    </span>
  );
}

/** A round 44px button of the viewer: previous, next, close. */
const VIEWER_BUTTON = "size-11 rounded-full";

/**
 * The photos a customer attached to their return: thumbnails that open large,
 * one after another. The links are signed for a few minutes; when one fails
 * after its time is up, `onExpired` asks the list again for fresh links.
 *
 * By default a photo opens in a dialog (a sheet on phones) — the order page
 * uses it that way. With `inline` it grows in place instead, above the
 * thumbnails: inside Quick Look a second sheet over the first would hide the
 * return the merchant is deciding on.
 */
export function ReturnPhotos({ photos, onExpired, inline = false }: { photos: ReturnPhoto[]; onExpired?: () => void; inline?: boolean }) {
  const t = useT(STRINGS);
  const { dir } = useLocale();
  const [open, setOpen] = useState<number | null>(null);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  // One refresh per set of links: a photo that fails with fresh links stays failed.
  const asked = useRef<string | null>(null);
  const linksKey = photos.map((p) => p.url).join("|");

  useEffect(() => {
    setBroken({});
  }, [linksKey]);

  if (photos.length === 0) return null;
  const total = photos.length;

  function failed(photo: ReturnPhoto) {
    const stale = new Date(photo.expiresAt).getTime() <= Date.now();
    if (stale && onExpired && asked.current !== linksKey) {
      asked.current = linksKey;
      onExpired();
      return;
    }
    setBroken((prev) => ({ ...prev, [photo.uploadId]: true }));
  }

  /** Before opening, links past their time are swapped for fresh ones. */
  function show(index: number) {
    const stale = photos.some((p) => new Date(p.expiresAt).getTime() <= Date.now() + 5000);
    if (stale && onExpired && asked.current !== linksKey) {
      asked.current = linksKey;
      onExpired();
    }
    // In place, a second press on the open thumbnail folds it back.
    setOpen((was) => (inline && was === index ? null : index));
  }

  const at = open === null ? null : Math.min(open, total - 1);
  const current = at === null ? null : (photos[at] ?? null);
  const PrevIcon = dir === "rtl" ? IconCaretRight : IconCaretLeft;
  const NextIcon = dir === "rtl" ? IconCaretLeft : IconCaretRight;

  const picture = (frame: string) =>
    current &&
    (broken[current.uploadId] ? (
      <p className="flex items-center gap-2 px-4 py-6 text-sm text-ink-soft">
        <IconImageMissing className="size-5 shrink-0" aria-hidden />
        {t.unavailable}
      </p>
    ) : (
      <img
        key={current.url}
        src={current.url}
        alt={fmt(t.photoAlt, { n: (at ?? 0) + 1 })}
        onError={() => failed(current)}
        className={cn("mx-auto w-auto max-w-full object-contain", frame)}
      />
    ));

  const newTab = current && (
    <a
      href={current.url}
      target="_blank"
      rel="noopener noreferrer"
      className="me-auto inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <IconExternal className="size-4" aria-hidden />
      {t.newTab}
    </a>
  );

  const steps = total > 1 && (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="icon"
        className={VIEWER_BUTTON}
        aria-label={t.previous}
        disabled={at === 0}
        onClick={() => setOpen((i) => (i === null ? i : Math.max(0, i - 1)))}
      >
        <PrevIcon className="size-5" aria-hidden />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={VIEWER_BUTTON}
        aria-label={t.next}
        disabled={at === total - 1}
        onClick={() => setOpen((i) => (i === null ? i : Math.min(total - 1, i + 1)))}
      >
        <NextIcon className="size-5" aria-hidden />
      </Button>
    </div>
  );

  return (
    <div data-slot="return-photos">
      <span className="text-xs font-medium text-ink-soft">{t.photos}</span>

      {inline && current && at !== null && (
        <figure
          data-slot="return-photo-stage"
          className="mt-2 overflow-hidden rounded-[1.25rem] bg-paper-sunken ring-1 ring-line motion-safe:animate-[returns-photo-in_var(--dur-fade)_var(--ease-out)_both]"
        >
          <div className="flex min-h-40 items-center justify-center">{picture("max-h-[48dvh]")}</div>
          <figcaption className="flex flex-wrap items-center gap-2 border-t border-line px-2 py-2">
            {newTab}
            {total > 1 && (
              <span aria-live="polite" className="px-1 text-xs text-ink-soft tabular-nums">
                {fmt(t.photoOf, { n: at + 1, total })}
              </span>
            )}
            {steps}
            <Button variant="outline" size="icon" className={VIEWER_BUTTON} aria-label={t.closePhoto} onClick={() => setOpen(null)}>
              <IconClose className="size-4" aria-hidden />
            </Button>
          </figcaption>
        </figure>
      )}

      <ul className="mt-2 flex flex-wrap gap-2">
        {photos.map((photo, i) => (
          <li key={photo.uploadId}>
            <button
              type="button"
              onClick={() => show(i)}
              aria-label={fmt(t.openPhoto, { n: i + 1, total })}
              aria-pressed={inline ? at === i : undefined}
              className="zimos-return-photo block size-16 cursor-pointer overflow-hidden rounded-2xl bg-paper-sunken ring-1 ring-line transition-[scale,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:ring-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] aria-pressed:ring-2 aria-pressed:ring-primary motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              {broken[photo.uploadId] ? (
                <span className="flex size-full items-center justify-center text-ink-soft">
                  <IconImageMissing className="size-5" aria-hidden />
                </span>
              ) : (
                <img src={photo.url} alt="" loading="lazy" onError={() => failed(photo)} className="size-full object-cover" />
              )}
            </button>
          </li>
        ))}
      </ul>

      {!inline && (
        <Modal
          open={current !== null}
          onClose={() => setOpen(null)}
          title={t.photos}
          description={at !== null && total > 1 ? fmt(t.photoOf, { n: at + 1, total }) : undefined}
          className="sm:max-w-2xl"
          footer={
            current && (
              <>
                {newTab}
                {steps}
              </>
            )
          }
        >
          {picture("max-h-[65dvh] rounded-[var(--radius)] bg-paper-sunken")}
        </Modal>
      )}
    </div>
  );
}
