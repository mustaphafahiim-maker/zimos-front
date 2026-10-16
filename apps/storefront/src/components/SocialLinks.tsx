import type { SocialLinkKey } from "@store-builder/api-client";

const NAMES: Record<SocialLinkKey, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
  snapchat: "Snapchat",
  x: "X",
};

/** Two-letter marks in a ring: recognisable without shipping seven brand logos. */
const MARKS: Record<SocialLinkKey, string> = {
  facebook: "f",
  instagram: "ig",
  tiktok: "tt",
  whatsapp: "wa",
  youtube: "yt",
  snapchat: "sc",
  x: "x",
};

/** The store's social links (settings → general), as a row of round links. */
export function SocialLinks({ links }: { links: Partial<Record<SocialLinkKey, string>> }) {
  const entries = (Object.keys(NAMES) as SocialLinkKey[]).filter((key) => links[key]);
  if (entries.length === 0) return null;
  return (
    <ul className="flex flex-wrap items-center justify-center gap-2">
      {entries.map((key) => (
        <li key={key}>
          <a
            href={links[key]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={NAMES[key]}
            title={NAMES[key]}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-xs font-bold uppercase text-ink-soft transition-colors hover:border-primary hover:text-primary"
          >
            <span aria-hidden>{MARKS[key]}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
