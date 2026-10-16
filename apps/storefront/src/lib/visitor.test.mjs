import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ATTRIBUTION_KEY,
  SESSION_AT_KEY,
  SESSION_IDLE_MS,
  SESSION_KEY,
  VISITOR_KEY_PREFIX,
  attributionFrom,
  externalReferrer,
  getSessionId,
  getVisitorId,
  randomId,
} from "./visitor.ts";

/**
 * Pins the identity rules of the storefront: one visitor id per store per tab
 * (the key the checkout autosave has always used, now shared with analytics),
 * an analytics session that ends after 30 idle minutes, and attribution read
 * the way the funnel entry page reads it. Runs on Node's built-in runner
 * (`node --test src/lib/visitor.test.mjs`), so browser storage is faked here.
 */

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
}

function installWindow({ blocked = false } = {}) {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  globalThis.window = {
    get localStorage() {
      if (blocked) throw new Error("SecurityError");
      return local;
    },
    get sessionStorage() {
      if (blocked) throw new Error("SecurityError");
      return session;
    },
  };
  return { local, session };
}

describe("randomId", () => {
  it("is 32 lowercase hex characters", () => {
    assert.match(randomId(), /^[0-9a-f]{32}$/);
    assert.notEqual(randomId(), randomId());
  });
});

describe("getVisitorId", () => {
  it("is created once per store per tab, in sessionStorage, and then reused", () => {
    const { local, session } = installWindow();
    const a = getVisitorId("ws-one");
    assert.ok(a.length >= 8 && a.length <= 64, "the API wants 8-64 characters");
    assert.equal(session.getItem(`${VISITOR_KEY_PREFIX}ws-one`), a);
    assert.equal(getVisitorId("ws-one"), a);
    // Another store in the same tab is another visitor; nothing outlives the tab.
    assert.notEqual(getVisitorId("ws-two"), a);
    assert.equal(local.map.size, 0);
  });

  it("keeps the id a tab already holds (the checkout autosave's existing key)", () => {
    const { session } = installWindow();
    session.setItem(`${VISITOR_KEY_PREFIX}ws-three`, "existing-visitor-0001");
    assert.equal(getVisitorId("ws-three"), "existing-visitor-0001");
  });

  it("replaces a stored value the API would refuse", () => {
    const { session } = installWindow();
    session.setItem(`${VISITOR_KEY_PREFIX}ws-four`, "short");
    const id = getVisitorId("ws-four");
    assert.notEqual(id, "short");
    assert.equal(session.getItem(`${VISITOR_KEY_PREFIX}ws-four`), id);
  });

  it("still returns a stable id when storage is blocked", () => {
    installWindow({ blocked: true });
    const id = getVisitorId("ws-five");
    assert.ok(id.length >= 8 && id.length <= 64);
    assert.equal(getVisitorId("ws-five"), id);
  });
});

describe("getSessionId", () => {
  let stores;
  beforeEach(() => {
    stores = installWindow();
  });

  it("starts a session and stamps the activity time", () => {
    const id = getSessionId(1_000_000);
    assert.match(id, /^[0-9a-f]{32}$/);
    assert.equal(stores.session.getItem(SESSION_KEY), id);
    assert.equal(stores.local.getItem(SESSION_AT_KEY), "1000000");
  });

  it("keeps the session while active and slides the window on every call", () => {
    const id = getSessionId(1_000_000);
    const later = 1_000_000 + SESSION_IDLE_MS - 1;
    assert.equal(getSessionId(later), id);
    assert.equal(stores.local.getItem(SESSION_AT_KEY), String(later));
    // 29 minutes after the *second* call is still the same session.
    assert.equal(getSessionId(later + SESSION_IDLE_MS - 1), id);
  });

  it("starts a new session after 30 idle minutes and drops the old attribution", () => {
    const id = getSessionId(1_000_000);
    stores.session.setItem(ATTRIBUTION_KEY, JSON.stringify({ source: "old" }));
    const next = getSessionId(1_000_000 + SESSION_IDLE_MS + 1);
    assert.notEqual(next, id);
    assert.equal(stores.session.getItem(SESSION_KEY), next);
    assert.equal(stores.session.getItem(ATTRIBUTION_KEY), null);
  });

  it("starts a new session in a tab that has none", () => {
    getSessionId(1_000_000);
    stores.session.removeItem(SESSION_KEY);
    assert.match(getSessionId(1_000_001), /^[0-9a-f]{32}$/);
  });
});

describe("externalReferrer", () => {
  it("ignores same-host and malformed referrers", () => {
    assert.equal(externalReferrer("", "shop.example"), undefined);
    assert.equal(externalReferrer("https://shop.example/cart", "shop.example"), undefined);
    assert.equal(externalReferrer("not a url", "shop.example"), undefined);
  });

  it("returns the host of another site", () => {
    assert.deepEqual(externalReferrer("https://www.google.com/search?q=x", "shop.example"), {
      url: "https://www.google.com/search?q=x",
      host: "www.google.com",
    });
  });
});

describe("attributionFrom", () => {
  it("reads utm parameters and click ids", () => {
    const attr = attributionFrom({
      search: "?utm_source=facebook&utm_medium=cpc&utm_campaign=summer&fbclid=abc&gclid=g1&other=1",
      pathname: "/store/w1",
      referrer: "https://l.facebook.com/",
      host: "shop.example",
    });
    assert.deepEqual(attr, {
      source: "facebook",
      medium: "cpc",
      campaign: "summer",
      referrer: "https://l.facebook.com/",
      landingPage: "/store/w1?utm_source=facebook&utm_medium=cpc&utm_campaign=summer&fbclid=abc&gclid=g1&other=1",
      clickIds: { gclid: "g1", fbclid: "abc" },
    });
  });

  it("falls back to the referrer host as the source", () => {
    const attr = attributionFrom({
      search: "",
      pathname: "/",
      referrer: "https://www.google.com/",
      host: "shop.example",
    });
    assert.equal(attr.source, "www.google.com");
    assert.equal(attr.medium, undefined);
    assert.equal(attr.clickIds, undefined);
  });

  it("has no source for a direct visit", () => {
    const attr = attributionFrom({ search: "", pathname: "/p/x", referrer: "", host: "shop.example" });
    assert.deepEqual(attr, { landingPage: "/p/x" });
  });

  it("clips overlong values", () => {
    const attr = attributionFrom({
      search: `?utm_source=${"a".repeat(500)}`,
      pathname: "/",
      referrer: "",
      host: "shop.example",
    });
    assert.equal(attr.source.length, 200);
  });
});
