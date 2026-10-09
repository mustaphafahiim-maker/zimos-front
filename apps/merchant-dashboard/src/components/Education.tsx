import { useEffect, useState } from "react";
import { IconChat, IconGuide, IconPlayCircle, IconSend, IconSupport } from "@/components/icons";
import { Card, CardDescription, CardHeader, CardTitle } from "@store-builder/ui";
import { educationLinksGet, type EducationLinks, type TutorialTopic } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    tutorial: "Watch the tutorial",
    helpTitle: "Help center",
    helpDesc: "Step-by-step guides for every part of your store.",
    telegramTitle: "Updates on Telegram",
    telegramDesc: "New features and tips as they come out.",
    chatTitle: "Talk to support",
    chatDesc: "Ask the ZIMOS team anything.",
    learn: "Learn ZIMOS",
  },
  ar: {
    tutorial: "شاهد الشرح",
    helpTitle: "مركز المساعدة",
    helpDesc: "شروحات خطوة بخطوة لكل جزء في متجرك.",
    telegramTitle: "التحديثات على تيليجرام",
    telegramDesc: "المميزات الجديدة والنصائح أول بأول.",
    chatTitle: "تواصل مع الدعم",
    chatDesc: "اسأل فريق ZIMOS عن أي شيء.",
    learn: "تعلّم ZIMOS",
  },
} satisfies Messages;

/**
 * Education (SPEC §18.6, §15.1): ZIMOS's help center, Telegram channel,
 * support chat and tutorial videos, set by the platform team in the console
 * (backend platformAdmin/educationLinks.js). Anything not set is simply not
 * shown. Loaded once per page load and shared.
 */

let cached: Promise<EducationLinks | null> | null = null;

function load(): Promise<EducationLinks | null> {
  if (!cached) cached = educationLinksGet(apiClient).catch(() => null);
  return cached;
}

export function useEducationLinks(): EducationLinks | null {
  const [links, setLinks] = useState<EducationLinks | null>(null);
  useEffect(() => {
    let live = true;
    void load().then((found) => live && setLinks(found));
    return () => {
      live = false;
    };
  }, []);
  return links;
}

/** "Watch the tutorial" for one page, when the platform team has set a video for it. */
export function TutorialLink({ topic }: { topic: TutorialTopic }) {
  const t = useT(STRINGS);
  const url = useEducationLinks()?.tutorials[topic];
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
      <IconPlayCircle className="size-4" aria-hidden />
      {t.tutorial}
    </a>
  );
}

/** The home page's cards: help center, Telegram, support chat — the ones that are set. */
export function HelpCards() {
  const t = useT(STRINGS);
  const links = useEducationLinks();
  const cards = [
    links?.helpCenterUrl && { url: links.helpCenterUrl, title: t.helpTitle, desc: t.helpDesc, Icon: IconGuide },
    links?.telegramUrl && { url: links.telegramUrl, title: t.telegramTitle, desc: t.telegramDesc, Icon: IconSend },
    links?.supportChatUrl && { url: links.supportChatUrl, title: t.chatTitle, desc: t.chatDesc, Icon: IconChat },
  ].filter(Boolean) as Array<{ url: string; title: string; desc: string; Icon: typeof IconSupport }>;
  if (cards.length === 0) return null;
  return (
    <section aria-label={t.learn} className="mt-8">
      <h2 className="mb-3 text-base font-semibold text-ink">{t.learn}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ url, title, desc, Icon }) => (
          <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="size-4 text-primary" aria-hidden />
                  {title}
                </CardTitle>
                <CardDescription>{desc}</CardDescription>
              </CardHeader>
            </Card>
          </a>
        ))}
      </div>
    </section>
  );
}
