import type { StoreAnnouncement } from "@/lib/storeAnnouncement";
import { StoreLink } from "@/components/StoreRoute";
import { ArrowIcon } from "./Icons";
import { container } from "./ui";

/**
 * One line above the masthead, in the merchant's words: a delivery note, a
 * promotion, a holiday closure. Drawn only when the public store payload
 * carries one (lib/storeAnnouncement) — there is no default text — so most
 * stores never see it and lose no height to it.
 *
 * The merchant's own bar colours apply when they set them; otherwise it is
 * the brand primary, which already carries a contrast-picked foreground.
 */
export function AnnouncementBar({ announcement, label }: { announcement: StoreAnnouncement; label: string }) {
  const style =
    announcement.background || announcement.color
      ? {
          ...(announcement.background ? { backgroundColor: announcement.background } : {}),
          ...(announcement.color ? { color: announcement.color } : {}),
        }
      : undefined;

  const text = (
    <span className="line-clamp-2 text-center text-xs font-medium leading-snug sm:text-sm">{announcement.text}</span>
  );

  return (
    <div role="region" aria-label={label} className="bg-primary text-on-primary" style={style}>
      <div className={`${container} flex min-h-9 items-center justify-center py-1.5`}>
        {announcement.href ? (
          <StoreLink
            href={announcement.href}
            // The ring takes the bar's own text colour: the brand outline would vanish on a brand background.
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            style={{ color: "inherit" }}
          >
            {text}
            <ArrowIcon size={14} className="shrink-0 rtl:rotate-180" />
          </StoreLink>
        ) : (
          text
        )}
      </div>
    </div>
  );
}
