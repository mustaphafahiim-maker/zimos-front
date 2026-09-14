/**
 * Shared test doubles for screen tests. `setup.ts` wires these into
 * `vi.mock("@/lib/apiClient")`, `vi.mock("@/context/AuthContext")` and
 * `vi.mock("@/context/WorkspaceContext")`, so no screen test can reach the
 * network or the real session. Configure responses per test, e.g.
 *
 *   api.listOrders.mockResolvedValue({ orders: [order], nextCursor: null });
 */
import { vi, type Mock } from "vitest";
import type { ApiClient, AuthUser, LoginPayload, RegisterPayload, Workspace } from "@store-builder/api-client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

/** Every public ApiClient method as a typed `vi.fn`. */
export type ApiClientMock = {
  [K in keyof ApiClient as ApiClient[K] extends AnyFn ? K : never]: ApiClient[K] extends AnyFn ? Mock<ApiClient[K]> : never;
};

const fns = new Map<string, Mock>();

/**
 * Lazily creates a `vi.fn` per method. Unconfigured calls return a promise that
 * never settles, so an unmocked request leaves the screen loading instead of
 * failing somewhere unrelated — assert on the calls you care about.
 */
export const api = new Proxy({} as ApiClientMock, {
  get(_target, prop) {
    if (typeof prop !== "string" || prop === "then") return undefined;
    let fn = fns.get(prop);
    if (!fn) {
      fn = vi.fn(() => new Promise<never>(() => undefined));
      fns.set(prop, fn);
    }
    return fn;
  },
});

/** Cast a partial fixture to a full API type (tests only set what the screen reads). */
export function fake<T>(value: Record<string, unknown>): T {
  return value as unknown as T;
}

export const testUser = fake<AuthUser>({
  id: "user_1",
  email: "agent@zimos.test",
  fullName: "Amr Hassan",
  status: "active",
});

export const testWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store" });

export interface AuthMock {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "guest";
  login: Mock<(payload: LoginPayload) => Promise<void>>;
  register: Mock<(payload: RegisterPayload) => Promise<void>>;
  logout: Mock<() => Promise<void>>;
  refreshUser: Mock<() => Promise<void>>;
}

export interface WorkspaceMock {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
  selectWorkspace: Mock<(id: string) => void>;
  createWorkspace: Mock<(name: string) => Promise<Workspace>>;
  refresh: Mock<() => Promise<void>>;
}

export const authMock = {} as AuthMock;
export const workspaceMock = {} as WorkspaceMock;

export function resetMocks() {
  fns.clear();
  Object.assign(authMock, {
    user: testUser,
    status: "authenticated",
    login: vi.fn(async () => undefined),
    register: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    refreshUser: vi.fn(async () => undefined),
  } satisfies AuthMock);
  Object.assign(workspaceMock, {
    workspaces: [testWorkspace],
    currentWorkspace: testWorkspace,
    loading: false,
    selectWorkspace: vi.fn(),
    createWorkspace: vi.fn(async () => testWorkspace),
    refresh: vi.fn(async () => undefined),
  } satisfies WorkspaceMock);
}

resetMocks();
