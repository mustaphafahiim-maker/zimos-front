import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_URL_OPTIONS,
  collectEventData,
  createNavigationState,
  hasDoNotTrack,
  isExternalClick,
  isTrackingDisabled,
  normalizeUrl,
  pageUrl,
  stripOrigin,
} from "./trackerCore.ts";

/**
 * Pins the Umami-parity rules of the store's tracker: url normalisation and
 * the exclude options, stripOrigin, referrer chaining with the "url changed?"
 * guard, data-attribute collection and the opt-out flags.
 * `node --test src/lib/trackerCore.test.mjs`.
 */

const ORIGIN = "https://shop.example";

describe("normalizeUrl", () => {
  it("resolves relative urls against the base", () => {
    assert.equal(normalizeUrl("/p/1?x=1#top", `${ORIGIN}/`), `${ORIGIN}/p/1?x=1#top`);
    assert.equal(normalizeUrl("?page=2", `${ORIGIN}/shop`), `${ORIGIN}/shop?page=2`);
  });
  it("applies exclude-search / exclude-hash", () => {
    const href = `${ORIGIN}/p?x=1#h`;
    assert.equal(normalizeUrl(href, href, { excludeSearch: true }), `${ORIGIN}/p#h`);
    assert.equal(normalizeUrl(href, href, { excludeHash: true }), `${ORIGIN}/p?x=1`);
    assert.equal(normalizeUrl(href, href, { excludeSearch: true, excludeHash: true }), `${ORIGIN}/p`);
  });
  it("returns empty and unparsable input as is", () => {
    assert.equal(normalizeUrl("", ORIGIN), "");
    assert.equal(normalizeUrl("nope", "not a url"), "nope");
  });
});

describe("stripOrigin", () => {
  it("strips a same-origin url to its path", () => {
    assert.equal(stripOrigin(`${ORIGIN}/a?b#c`, ORIGIN), "/a?b#c");
    assert.equal(stripOrigin(ORIGIN, ORIGIN), "");
  });
  it("leaves other origins, prefixes and relative paths alone", () => {
    assert.equal(stripOrigin("https://google.com/", ORIGIN), "https://google.com/");
    assert.equal(stripOrigin("https://shop.example.evil/", ORIGIN), "https://shop.example.evil/");
    assert.equal(stripOrigin("/already", ORIGIN), "/already");
    assert.equal(stripOrigin("", ORIGIN), "");
  });
});

describe("pageUrl", () => {
  it("is path + search, hash dropped by default", () => {
    assert.equal(DEFAULT_URL_OPTIONS.excludeSearch, false);
    assert.equal(DEFAULT_URL_OPTIONS.excludeHash, true);
    assert.equal(pageUrl(`${ORIGIN}/p?x=1#h`, ORIGIN, DEFAULT_URL_OPTIONS), "/p?x=1");
    assert.equal(pageUrl(`${ORIGIN}/p?x=1#h`, ORIGIN, { excludeSearch: true }), "/p#h");
  });
  it("never returns an empty url", () => {
    assert.equal(pageUrl(ORIGIN, ORIGIN), "/");
  });
});

describe("createNavigationState (referrer chaining)", () => {
  it("reports document.referrer on the first page, then the previous in-app url", () => {
    const nav = createNavigationState({
      href: `${ORIGIN}/`,
      referrer: "https://google.com/search?q=shoes",
      origin: ORIGIN,
      options: DEFAULT_URL_OPTIONS,
    });
    assert.equal(nav.url(), "/");
    assert.equal(nav.referrer(), "https://google.com/search?q=shoes");

    assert.equal(nav.navigate(`${ORIGIN}/products/1`), true);
    assert.equal(nav.url(), "/products/1");
    assert.equal(nav.referrer(), "/");

    assert.equal(nav.navigate("/cart?step=1"), true);
    assert.equal(nav.url(), "/cart?step=1");
    assert.equal(nav.referrer(), "/products/1");
  });

  it("strips the origin from a same-origin document.referrer", () => {
    const nav = createNavigationState({ href: `${ORIGIN}/b`, referrer: `${ORIGIN}/a`, origin: ORIGIN });
    assert.equal(nav.referrer(), "/a");
  });

  it("guards against counting one navigation twice", () => {
    const nav = createNavigationState({ href: `${ORIGIN}/a`, referrer: "", origin: ORIGIN, options: DEFAULT_URL_OPTIONS });
    // pushState patch sees it first, Next's router effect second: same url.
    assert.equal(nav.navigate("/b"), true);
    assert.equal(nav.navigate(`${ORIGIN}/b`), false);
    assert.equal(nav.referrer(), "/a", "a no-op navigation must not advance the referrer");
    // hash-only change is not a page with excludeHash
    assert.equal(nav.navigate("/b#section"), false);
    // query change is a page
    assert.equal(nav.navigate("/b?page=2"), true);
    assert.equal(nav.navigate(""), false);
  });

  it("resolves relative pushState urls against the current page", () => {
    const nav = createNavigationState({ href: `${ORIGIN}/shop/all`, referrer: "", origin: ORIGIN });
    assert.equal(nav.navigate("?sort=price"), true);
    assert.equal(nav.url(), "/shop/all?sort=price");
    assert.equal(nav.navigate("../sale"), true);
    assert.equal(nav.url(), "/sale");
  });

  it("honours excludeSearch", () => {
    const nav = createNavigationState({ href: `${ORIGIN}/a?x=1`, referrer: "", origin: ORIGIN, options: { excludeSearch: true } });
    assert.equal(nav.url(), "/a");
    assert.equal(nav.navigate("/a?x=2"), false);
  });
});

describe("collectEventData", () => {
  it("copies every data-zimos-event-* attribute, keyed by suffix", () => {
    const attrs = {
      class: "btn",
      "data-zimos-event": "signup",
      "data-zimos-event-plan": "pro",
      "data-zimos-event-cta-position": "hero",
      "data-other": "x",
    };
    const data = collectEventData(Object.keys(attrs), (n) => attrs[n] ?? null);
    assert.deepEqual(data, { plan: "pro", "cta-position": "hero" });
  });
  it("is empty without data attributes", () => {
    assert.deepEqual(collectEventData(["data-zimos-event"], () => "x"), {});
  });
});

describe("isExternalClick", () => {
  it("is true for _blank and modifier / middle clicks", () => {
    assert.equal(isExternalClick({ target: "_blank" }), true);
    assert.equal(isExternalClick({ ctrlKey: true }), true);
    assert.equal(isExternalClick({ metaKey: true }), true);
    assert.equal(isExternalClick({ shiftKey: true }), true);
    assert.equal(isExternalClick({ button: 1 }), true);
    assert.equal(isExternalClick({ target: "", button: 0 }), false);
  });
});

describe("opt-out", () => {
  it("hasDoNotTrack accepts 1, '1' and 'yes'", () => {
    assert.equal(hasDoNotTrack(null, undefined, "1"), true);
    assert.equal(hasDoNotTrack(1), true);
    assert.equal(hasDoNotTrack("yes"), true);
    assert.equal(hasDoNotTrack("0", "unspecified", null), false);
  });
  it("ignores DNT unless the store or the shopper opted in", () => {
    assert.equal(isTrackingDisabled({ doNotTrack: true }), false);
    assert.equal(isTrackingDisabled({ doNotTrack: true, respectDnt: true }), true);
    assert.equal(isTrackingDisabled({ doNotTrack: true, dntFlag: "1" }), true);
    assert.equal(isTrackingDisabled({ doNotTrack: false, respectDnt: true }), false);
  });
  it("zimos.analytics.disabled=1 turns everything off", () => {
    assert.equal(isTrackingDisabled({ doNotTrack: false, disabledFlag: "1" }), true);
    assert.equal(isTrackingDisabled({ doNotTrack: false, disabledFlag: "0" }), false);
  });
});
