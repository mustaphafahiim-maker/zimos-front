/**
 * The shared social links (packages/ui/src/social-links), tested here because
 * the dashboard is the workspace that has vitest. The marketing footer and
 * contact page render the same component with the same config.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  SOCIAL_LINKS,
  SOCIAL_PLATFORMS,
  SocialLinks,
  socialHref,
  visibleSocialLinks,
  type SocialLinkConfig,
  type SocialLocale,
  type SocialPlatform,
} from "@store-builder/ui/social-links";
import { api } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SupportPage } from "./SupportPage";

const entry = (platform: SocialPlatform, url: string | null, order = 1, enabled = true): SocialLinkConfig => ({
  platform,
  url,
  enabled,
  order,
});

function renderLinks(links: readonly SocialLinkConfig[] | null, locale: SocialLocale = "en", heading?: string) {
  return render(<SocialLinks locale={locale} links={links} heading={heading} />);
}

const hrefs = () => screen.queryAllByRole("link").map((a) => a.getAttribute("href"));

const VALID: Record<SocialPlatform, string> = {
  instagram: "https://instagram.com/zimos.co",
  facebook: "https://facebook.com/zimos.co",
  tiktok: "https://www.tiktok.com/@zimos.co",
  x: "https://x.com/ZimosCo",
  whatsapp: "https://wa.me/201501921444",
  email: "mailto:zimossupport@gmail.com",
};

describe("the shipped config", () => {
  it("shows Instagram, Facebook, TikTok, WhatsApp, X and email, in that order", () => {
    render(<SocialLinks locale="en" />);

    expect(hrefs()).toEqual([
      "https://instagram.com/zimos.co",
      "https://facebook.com/zimos.co",
      "https://www.tiktok.com/@zimos.co",
      "https://wa.me/201501921444",
      "https://x.com/ZimosCo",
      "mailto:zimossupport@gmail.com",
    ]);
  });

  it("every entry is enabled and passes the rules, so none is silently dropped", () => {
    expect(SOCIAL_LINKS.every((link) => link.enabled)).toBe(true);
    expect(visibleSocialLinks(SOCIAL_LINKS)).toHaveLength(SOCIAL_LINKS.length);
  });
});

describe("nothing to show, nothing rendered", () => {
  it("an empty list, or no list, renders nothing", () => {
    expect(renderLinks([]).container).toBeEmptyDOMElement();
    expect(renderLinks(null).container).toBeEmptyDOMElement();
  });

  it("only disabled entries: nothing, the heading included", () => {
    const { container } = renderLinks(
      SOCIAL_PLATFORMS.map((platform, i) => entry(platform, VALID[platform], i, false)),
      "en",
      "Follow us"
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("only entries without a usable link: nothing, the heading included", () => {
    const { container } = renderLinks(
      [entry("whatsapp", null), entry("instagram", ""), entry("x", "   "), entry("facebook", "http://facebook.com/zimos.co")],
      "en",
      "Follow us"
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("one usable entry is enough to show the heading and that link", () => {
    renderLinks([entry("whatsapp", null), entry("x", VALID.x)], "en", "Follow us");
    expect(screen.getByRole("heading", { level: 2, name: "Follow us" })).toBeInTheDocument();
    expect(hrefs()).toEqual([VALID.x]);
  });

  it("an unknown platform is skipped", () => {
    renderLinks([{ platform: "myspace", url: "https://myspace.com/zimos", enabled: true, order: 1 } as unknown as SocialLinkConfig]);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("https only, and mailto for the email entry only", () => {
  const notHttps = [
    "http://instagram.com/zimos.co",
    "ftp://instagram.com/zimos.co",
    "//instagram.com/zimos.co",
    "instagram.com/zimos.co",
    "/zimos.co",
    "ws://instagram.com/zimos.co",
  ];

  it.each(notHttps)("refuses %s", (url) => {
    expect(socialHref("instagram", url)).toBeNull();
  });

  it("accepts https for every platform except email", () => {
    for (const platform of SOCIAL_PLATFORMS.filter((p) => p !== "email")) {
      expect(socialHref(platform, VALID[platform])).toBe(VALID[platform]);
    }
  });

  it("the email entry takes mailto: and nothing else", () => {
    expect(socialHref("email", "mailto:zimossupport@gmail.com")).toBe("mailto:zimossupport@gmail.com");
    expect(socialHref("email", "MAILTO:zimossupport@gmail.com")).toBe("mailto:zimossupport@gmail.com");
    expect(socialHref("email", "https://mail.google.com/")).toBeNull();
    expect(socialHref("email", "zimossupport@gmail.com")).toBeNull();
  });

  it("mailto: is refused on every other platform", () => {
    for (const platform of SOCIAL_PLATFORMS.filter((p) => p !== "email")) {
      expect(socialHref(platform, "mailto:zimossupport@gmail.com")).toBeNull();
    }
  });

  it.each([
    "mailto:",
    "mailto:zimossupport",
    "mailto:zimossupport@gmail.com?subject=hi",
    "mailto:zimossupport@gmail.com?bcc=someone@example.com",
    "mailto:a@example.com,b@example.com",
    "mailto:ZIMOS <zimossupport@gmail.com>",
    "mailto:zimos%0Asupport@gmail.com",
  ])("refuses the address in %s", (url) => {
    expect(socialHref("email", url)).toBeNull();
  });

  it("renders the valid entries and drops the rest", () => {
    renderLinks([
      entry("instagram", "http://instagram.com/zimos.co", 1),
      entry("facebook", VALID.facebook, 2),
      entry("email", "https://example.com/contact", 3),
      entry("x", "mailto:zimossupport@gmail.com", 4),
      entry("tiktok", VALID.tiktok, 5),
    ]);
    expect(hrefs()).toEqual([VALID.facebook, VALID.tiktok]);
  });
});

describe("javascript: and data: never get through", () => {
  const payloads = [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "\u0001javascript:alert(1)",
    "javascript://instagram.com/%0Aalert(1)",
    "data:text/html,<script>alert(1)</script>",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "DATA:image/svg+xml,<svg onload=alert(1)>",
    "vbscript:msgbox(1)",
  ];

  it.each(payloads)("refuses %j on every platform", (url) => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(socialHref(platform, url)).toBeNull();
    }
  });

  it("none of them reaches the page", () => {
    const links = payloads.flatMap((url, i) => SOCIAL_PLATFORMS.map((platform) => entry(platform, url, i)));
    const { container } = renderLinks(links);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("each icon links to its own platform", () => {
  it.each([
    ["instagram", "https://instagram.com.evil.example/zimos.co"],
    ["instagram", "https://evil-instagram.com/zimos.co"],
    ["instagram", "https://instagram.com@evil.example/zimos.co"],
    ["instagram", "https://user:pass@instagram.com/zimos.co"],
    ["instagram", "https://instagram.com:8443/zimos.co"],
    ["facebook", "https://instagram.com/zimos.co"],
    ["x", "https://twitter.com.evil.example/ZimosCo"],
    ["whatsapp", "https://evil.example/201501921444"],
  ] as const)("refuses %s → %s", (platform, url) => {
    expect(socialHref(platform, url)).toBeNull();
  });

  it("accepts the platform's subdomains", () => {
    expect(socialHref("instagram", "https://www.instagram.com/zimos.co")).toBe("https://www.instagram.com/zimos.co");
    expect(socialHref("facebook", "https://m.facebook.com/zimos.co")).toBe("https://m.facebook.com/zimos.co");
    expect(socialHref("tiktok", "https://tiktok.com/@zimos.co")).toBe("https://tiktok.com/@zimos.co");
  });
});

describe("WhatsApp: wa.me needs a valid number", () => {
  it("accepts the configured number, and a prefilled text", () => {
    expect(socialHref("whatsapp", "https://wa.me/201501921444")).toBe("https://wa.me/201501921444");
    expect(socialHref("whatsapp", "https://wa.me/201501921444?text=Hello")).toBe("https://wa.me/201501921444?text=Hello");
  });

  it.each([
    "https://wa.me/",
    "https://wa.me/+201501921444",
    "https://wa.me/01501921444",
    "https://wa.me/0201501921444",
    "https://wa.me/20150-192-1444",
    "https://wa.me/20 1501921444",
    "https://wa.me/(20)1501921444",
    "https://wa.me/1234567",
    "https://wa.me/1234567890123456",
    "https://wa.me/20150192abcd",
    "https://wa.me/201501921444/extra",
    "https://wa.me/201501921444?phone=201000000000",
    "https://wa.me/201501921444#chat",
    "http://wa.me/201501921444",
  ])("refuses %s", (url) => {
    expect(socialHref("whatsapp", url)).toBeNull();
  });

  it("an invalid number hides WhatsApp only", () => {
    renderLinks([entry("tiktok", VALID.tiktok, 1), entry("whatsapp", "https://wa.me/01501921444", 2), entry("x", VALID.x, 3)]);
    expect(hrefs()).toEqual([VALID.tiktok, VALID.x]);
  });
});

describe("order", () => {
  it("follows `order`, not the list's position", () => {
    renderLinks([
      entry("email", VALID.email, 6),
      entry("x", VALID.x, 5),
      entry("whatsapp", VALID.whatsapp, 4),
      entry("instagram", VALID.instagram, 1),
      entry("tiktok", VALID.tiktok, 3),
      entry("facebook", VALID.facebook, 2),
    ]);
    expect(hrefs()).toEqual([VALID.instagram, VALID.facebook, VALID.tiktok, VALID.whatsapp, VALID.x, VALID.email]);
  });

  it("equal orders keep the list's order; a missing order goes last", () => {
    renderLinks([
      { ...entry("email", VALID.email), order: undefined as unknown as number },
      entry("x", VALID.x, 2),
      entry("facebook", VALID.facebook, 2),
      entry("instagram", VALID.instagram, 1),
    ]);
    expect(hrefs()).toEqual([VALID.instagram, VALID.x, VALID.facebook, VALID.email]);
  });

  it("one link per platform: the first by order wins", () => {
    renderLinks([entry("x", "https://x.com/second", 2), entry("x", "https://x.com/first", 1)]);
    expect(hrefs()).toEqual(["https://x.com/first"]);
  });
});

describe("tabs, rel and names", () => {
  it("https links open a new tab with noopener noreferrer; mailto doesn't", () => {
    render(<SocialLinks locale="en" />);
    for (const link of screen.getAllByRole("link")) {
      if (link.getAttribute("href")?.startsWith("mailto:")) {
        expect(link).not.toHaveAttribute("target");
        expect(link).not.toHaveAttribute("rel");
      } else {
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
      }
    }
  });

  it("names every link in English, and says which ones open a new tab", () => {
    render(<SocialLinks locale="en" />);
    const list = screen.getByRole("list", { name: "ZIMOS accounts" });
    expect(within(list).getAllByRole("link").map((a) => a.getAttribute("aria-label"))).toEqual([
      "ZIMOS on Instagram (opens in a new tab)",
      "ZIMOS on Facebook (opens in a new tab)",
      "ZIMOS on TikTok (opens in a new tab)",
      "ZIMOS on WhatsApp (opens in a new tab)",
      "ZIMOS on X (opens in a new tab)",
      "Email ZIMOS",
    ]);
  });

  it("names every link in Arabic", () => {
    render(<SocialLinks locale="ar" />);
    const list = screen.getByRole("list", { name: "حسابات ZIMOS" });
    expect(within(list).getAllByRole("link").map((a) => a.getAttribute("aria-label"))).toEqual([
      "ZIMOS على إنستغرام (يفتح في علامة تبويب جديدة)",
      "ZIMOS على فيسبوك (يفتح في علامة تبويب جديدة)",
      "ZIMOS على تيك توك (يفتح في علامة تبويب جديدة)",
      "ZIMOS على واتساب (يفتح في علامة تبويب جديدة)",
      "ZIMOS على إكس (يفتح في علامة تبويب جديدة)",
      "راسل ZIMOS عبر البريد الإلكتروني",
    ]);
  });

  it("the icons are hidden from screen readers, and each target is 44px", () => {
    const { container } = render(<SocialLinks locale="en" />);
    const icons = container.querySelectorAll("svg");
    expect(icons).toHaveLength(SOCIAL_LINKS.length);
    icons.forEach((icon) => expect(icon).toHaveAttribute("aria-hidden", "true"));
    screen.getAllByRole("link").forEach((link) => expect(link).toHaveClass("size-11"));
  });
});

describe("on the support page", () => {
  it("sits under the requests, with its heading, in English", async () => {
    api.listSupportTickets.mockResolvedValue([]);
    renderWithProviders(<SupportPage />, { locale: "en" });

    expect(await screen.findByRole("heading", { name: "Other ways to reach us" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "ZIMOS accounts" });
    expect(within(list).getAllByRole("link")).toHaveLength(SOCIAL_LINKS.length);
    expect(within(list).getByRole("link", { name: "ZIMOS on WhatsApp (opens in a new tab)" })).toHaveAttribute(
      "href",
      "https://wa.me/201501921444"
    );
  });

  it("and in Arabic", async () => {
    api.listSupportTickets.mockResolvedValue([]);
    renderWithProviders(<SupportPage />, { locale: "ar" });

    expect(await screen.findByRole("heading", { name: "طرق أخرى للتواصل معنا" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "حسابات ZIMOS" });
    expect(within(list).getByRole("link", { name: "راسل ZIMOS عبر البريد الإلكتروني" })).toHaveAttribute(
      "href",
      "mailto:zimossupport@gmail.com"
    );
  });
});
