import { SOCIAL_LINKS } from "./config";
import { SOCIAL_ICONS } from "./icons";
import {
  socialLinkLabel,
  socialListLabel,
  visibleSocialLinks,
  type SocialLinkConfig,
  type SocialLocale,
} from "./links";

export interface SocialLinksProps {
  locale: SocialLocale;
  /** Defaults to SOCIAL_LINKS (config.ts). A list from the API goes here later. */
  links?: readonly SocialLinkConfig[] | null;
  /** A visible h2 above the icons; hidden together with them. */
  heading?: string;
  headingClassName?: string;
  className?: string;
}

/**
 * ZIMOS's accounts as a row of icon links, 44px touch targets each. Renders
 * nothing when no entry passes the rules in links.ts. Uses only tokens both
 * the marketing site and the dashboard define (`ink-soft`, `line`,
 * `primary`), so it follows each app's palette and dark mode, and adds no
 * hooks, so it works as a server component too.
 *
 * Both apps scan this folder for Tailwind classes (`@source` in their CSS).
 */
export function SocialLinks({ locale, links = SOCIAL_LINKS, heading, headingClassName, className }: SocialLinksProps) {
  const items = visibleSocialLinks(links);
  if (items.length === 0) return null;

  return (
    <div className={className} data-slot="social-links">
      {heading ? <h2 className={headingClassName}>{heading}</h2> : null}
      {/* role="list": Safari drops list semantics from a list styled without markers. */}
      <ul role="list" aria-label={socialListLabel(locale)} className={`flex flex-wrap items-center gap-2${heading ? " mt-3" : ""}`}>
        {items.map((item) => {
          const Icon = SOCIAL_ICONS[item.platform];
          return (
            <li key={item.platform}>
              <a
                href={item.href}
                aria-label={socialLinkLabel(item, locale)}
                {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="inline-flex size-11 items-center justify-center rounded-full border border-line text-ink-soft transition-colors duration-200 hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Icon width={20} height={20} />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
