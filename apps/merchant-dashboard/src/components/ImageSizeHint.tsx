import { MEDIA_IMAGE_MAX_MB } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { hint: "Images up to {mb} MB" },
  ar: { hint: "حتى {mb} ميجابايت للصورة" },
} satisfies Messages;

/**
 * «حتى 10 ميجابايت للصورة» beside an image upload (handoff 400): the media
 * library takes JPEG, PNG, WebP and GIF up to 10 MB; lib/media.ts checks the
 * same number before a file is sent.
 */
export function ImageSizeHint({ className }: { className?: string }) {
  const t = useT(STRINGS);
  return (
    <p data-slot="image-size-hint" className={cn("text-xs leading-5 text-ink-soft", className)}>
      {fmt(t.hint, { mb: MEDIA_IMAGE_MAX_MB })}
    </p>
  );
}
