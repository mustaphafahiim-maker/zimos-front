import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, UserRound } from "lucide-react";
import { Button } from "@store-builder/ui";
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
    unavailable: "This photo didn't load. Reload the page to try again.",
  },
  ar: {
    fromCustomer: "من العميل",
    photos: "صور العميل",
    openPhoto: "افتح الصورة {n} من {total}",
    photoAlt: "صورة {n} من العميل",
    photoOf: "صورة {n} من {total}",
    previous: "الصورة اللي قبلها",
    next: "الصورة اللي بعدها",
    newTab: "افتحها في تاب جديدة",
    unavailable: "الصورة دي محمّلتش. اعمل تحديث للصفحة وجرّب تاني.",
  },
} satisfies Messages;

/**
 * The reasons a return names, in the words the customer picked them from on
 * the store (handoff 186 wording table) — the same words everywhere returns
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
    damaged: "وصل متكسر",
    defective: "فيه عيب",
    wrong_item: "منتج غلط",
    not_as_described: "مش زي الوصف",
    no_longer_wanted: "مبقتش عايزه",
    arrived_late: "وصل متأخر",
    other: "سبب تاني",
  },
} satisfies { en: Record<ReturnReasonCode, string>; ar: Record<ReturnReasonCode, string> };

/** "From customer": a return the shopper asked for from the store, not one opened here. */
export function ReturnSourceBadge() {
  const t = useT(STRINGS);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-primary-dark">
      <UserRound className="size-3.5 shrink-0" aria-hidden />
      {t.fromCustomer}
    </span>
  );
}

/**
 * The photos a customer attached to their return: thumbnails that open
 * large in a dialog (a sheet on phones), one after another. The links are
 * signed for a few minutes; when one fails after its time is up, `onExpired`
 * asks the list again for fresh links.
 */
export function ReturnPhotos({ photos, onExpired }: { photos: ReturnPhoto[]; onExpired?: () => void }) {
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
    setOpen(index);
  }

  const current = open === null ? null : photos[Math.min(open, total - 1)];
  const PrevIcon = dir === "rtl" ? ChevronRight : ChevronLeft;
  const NextIcon = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <div>
      <span className="text-xs font-medium text-ink-soft">{t.photos}</span>
      <ul className="mt-1 flex flex-wrap gap-2">
        {photos.map((photo, i) => (
          <li key={photo.uploadId}>
            <button
              type="button"
              onClick={() => show(i)}
              aria-label={fmt(t.openPhoto, { n: i + 1, total })}
              className="block size-16 cursor-pointer overflow-hidden rounded-[var(--radius)] bg-paper-sunken ring-1 ring-line transition-shadow hover:ring-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {broken[photo.uploadId] ? (
                <span className="flex size-full items-center justify-center text-ink-soft">
                  <ImageOff className="size-5" aria-hidden />
                </span>
              ) : (
                <img
                  src={photo.url}
                  alt=""
                  loading="lazy"
                  onError={() => failed(photo)}
                  className="size-full object-cover"
                />
              )}
            </button>
          </li>
        ))}
      </ul>

      <Modal
        open={current !== null}
        onClose={() => setOpen(null)}
        title={t.photos}
        description={open !== null && total > 1 ? fmt(t.photoOf, { n: open + 1, total }) : undefined}
        className="sm:max-w-2xl"
        footer={
          current && (
            <>
              <a
                href={current.url}
                target="_blank"
                rel="noopener noreferrer"
                className="me-auto inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius)] px-1 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <ExternalLink className="size-4" aria-hidden />
                {t.newTab}
              </a>
              {total > 1 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-11"
                    aria-label={t.previous}
                    disabled={open === 0}
                    onClick={() => setOpen((i) => (i === null ? i : Math.max(0, i - 1)))}
                  >
                    <PrevIcon className="size-5" aria-hidden />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-11"
                    aria-label={t.next}
                    disabled={open === total - 1}
                    onClick={() => setOpen((i) => (i === null ? i : Math.min(total - 1, i + 1)))}
                  >
                    <NextIcon className="size-5" aria-hidden />
                  </Button>
                </div>
              )}
            </>
          )
        }
      >
        {current &&
          (broken[current.uploadId] ? (
            <p className="flex items-center gap-2 py-6 text-sm text-ink-soft">
              <ImageOff className="size-5" aria-hidden />
              {t.unavailable}
            </p>
          ) : (
            <img
              key={current.url}
              src={current.url}
              alt={fmt(t.photoAlt, { n: (open ?? 0) + 1 })}
              onError={() => failed(current)}
              className="mx-auto max-h-[65dvh] w-auto max-w-full rounded-[var(--radius)] bg-paper-sunken object-contain"
            />
          ))}
      </Modal>
    </div>
  );
}
