import { useEffect, useState } from "react";
import { fetchPublicPlatformSettings, socialLinksOf } from "@store-builder/ui/platform-info";
import { SOCIAL_LINKS, type SocialLinkConfig } from "@store-builder/ui/social-links";
import { apiBaseUrl } from "@/lib/apiClient";
import { PLATFORM_SETTINGS_ENABLED } from "@/lib/features";

/**
 * ZIMOS's social accounts for the support page. Off (VITE_PLATFORM_SETTINGS_ENABLED):
 * the list in the code, as before. On: the list saved in the console, or the
 * code's list when it was never saved or the API fails; `null` while it is
 * loading, so the page never shows one list and then swaps it for another.
 */
export function usePlatformSocialLinks(enabled: boolean = PLATFORM_SETTINGS_ENABLED): readonly SocialLinkConfig[] | null {
  const [links, setLinks] = useState<readonly SocialLinkConfig[] | null>(enabled ? null : SOCIAL_LINKS);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void fetchPublicPlatformSettings(apiBaseUrl).then((settings) => {
      if (live) setLinks(socialLinksOf(settings));
    });
    return () => {
      live = false;
    };
  }, [enabled]);

  return links;
}
