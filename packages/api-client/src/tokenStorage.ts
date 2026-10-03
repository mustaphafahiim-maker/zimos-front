export interface TokenPair {
  accessToken: string | null;
  refreshToken: string | null;
}

export interface TokenStorage {
  get(): TokenPair;
  set(tokens: TokenPair): void;
  clear(): void;
  /** True when a refresh may succeed although `get()` holds no refresh token:
   * the server keeps it in an httpOnly cookie. */
  hasSession?(): boolean;
  /** Notes that a cookie session exists (after a redirect sign-in set the cookie). */
  markSession?(): void;
}

const ACCESS_KEY = "sb.accessToken";
const REFRESH_KEY = "sb.refreshToken";

/**
 * Default storage backed by localStorage. Safe to import in SSR contexts —
 * it no-ops when `window` isn't available (Next.js server components/middleware
 * should pass their own TokenStorage instead, e.g. backed by cookies).
 */
export function createLocalStorageTokenStorage(): TokenStorage {
  const hasWindow = typeof window !== "undefined";

  return {
    get() {
      if (!hasWindow) return { accessToken: null, refreshToken: null };
      return {
        accessToken: window.localStorage.getItem(ACCESS_KEY),
        refreshToken: window.localStorage.getItem(REFRESH_KEY),
      };
    },
    set({ accessToken, refreshToken }) {
      if (!hasWindow) return;
      if (accessToken) window.localStorage.setItem(ACCESS_KEY, accessToken);
      if (refreshToken) window.localStorage.setItem(REFRESH_KEY, refreshToken);
    },
    clear() {
      if (!hasWindow) return;
      window.localStorage.removeItem(ACCESS_KEY);
      window.localStorage.removeItem(REFRESH_KEY);
    },
  };
}

const SESSION_KEY = "sb.session";

/**
 * The browser default. The access token lives in memory only, so a script
 * injected into the page finds nothing to steal after the tab is gone. The
 * refresh token is the server's httpOnly cookie; `sb.session` only remembers
 * that one exists, so a reload knows to ask for a new access token.
 *
 * A server that still answers with a refresh token in the body (cookie mode
 * off) is served too: that token is kept in localStorage as before.
 */
export function createBrowserSessionTokenStorage(): TokenStorage {
  const hasWindow = typeof window !== "undefined";
  let accessToken: string | null = null;
  const read = (key: string) => {
    try {
      return hasWindow ? window.localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  };
  const write = (key: string, value: string | null) => {
    if (!hasWindow) return;
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch {
      // Private mode or storage disabled: the session lasts for this tab.
    }
  };

  return {
    get() {
      return { accessToken, refreshToken: read(REFRESH_KEY) };
    },
    set(tokens) {
      if (tokens.accessToken) accessToken = tokens.accessToken;
      // Never at rest: drop what an older build left behind.
      write(ACCESS_KEY, null);
      if (tokens.refreshToken) {
        write(REFRESH_KEY, tokens.refreshToken);
      } else if (tokens.accessToken) {
        write(REFRESH_KEY, null);
        write(SESSION_KEY, "1");
      }
    },
    clear() {
      accessToken = null;
      write(ACCESS_KEY, null);
      write(REFRESH_KEY, null);
      write(SESSION_KEY, null);
    },
    hasSession() {
      return Boolean(accessToken || read(SESSION_KEY) || read(REFRESH_KEY));
    },
    markSession() {
      write(SESSION_KEY, "1");
    },
  };
}

/** In-memory storage, useful for tests or server-side one-off requests. */
export function createMemoryTokenStorage(initial: TokenPair = { accessToken: null, refreshToken: null }): TokenStorage {
  let tokens = initial;
  return {
    get: () => tokens,
    set: (next) => {
      tokens = { ...tokens, ...next };
    },
    clear: () => {
      tokens = { accessToken: null, refreshToken: null };
    },
  };
}
