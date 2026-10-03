// Imported as `@store-builder/ui/social-links`, apart from the package's main
// entry, so the marketing site takes these files only and none of the
// shadcn components or their dependencies.

export { SocialLinks, type SocialLinksProps } from "./social-links";
export { SOCIAL_LINKS } from "./config";
export {
  SOCIAL_PLATFORMS,
  isSocialPlatform,
  socialHref,
  socialLinkLabel,
  socialListLabel,
  visibleSocialLinks,
  type SocialLinkConfig,
  type SocialLinkItem,
  type SocialLocale,
  type SocialPlatform,
} from "./links";
