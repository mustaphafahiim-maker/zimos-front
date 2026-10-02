/**
 * Shared test doubles for screen tests. `setup.ts` wires these into
 * `vi.mock("@/lib/apiClient")`, `vi.mock("@/context/AuthContext")` and
 * `vi.mock("@/context/WorkspaceContext")`, so no screen test can reach the
 * network or the real session. Configure responses per test, e.g.
 *
 *   api.listSettlements.mockResolvedValue({ settlements: [], nextCursor: null });
 */
import { vi, type Mock } from "vitest";
import type {
  ApiClient,
  AuthUser,
  LoginPayload,
  RegisterPayload,
  VerificationChallenge,
  Workspace,
} from "@store-builder/api-client";
import type { CreateWorkspaceResult } from "@/context/WorkspaceContext";

// oxlint-disable-next-line no-explicit-any
type AnyFn = (...args: any[]) => any;

/** Every public ApiClient method as a typed `vi.fn`. */
export type ApiClientMock = {
  [K in keyof ApiClient as ApiClient[K] extends AnyFn ? K : never]: ApiClient[K] extends AnyFn
    ? Mock<ApiClient[K]>
    : never;
};

const fns = new Map<string, Mock>();

/**
 * Lazily creates a `vi.fn` per method. Unconfigured calls return a promise
 * that never settles, so an unmocked request leaves the screen loading instead
 * of failing somewhere unrelated — assert on the calls you care about.
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

/** One store as `listWorkspaces` returns it: the workspace plus the caller's role key. */
export type ListedWorkspace = Awaited<ReturnType<ApiClient["listWorkspaces"]>>[number];

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
  needsPlan: boolean;
  /** The account's email (or phone) is confirmed; false shows the banner. */
  confirmed: boolean;
  login: Mock<(payload: LoginPayload) => Promise<VerificationChallenge | null>>;
  register: Mock<(payload: RegisterPayload) => Promise<VerificationChallenge | null>>;
  logout: Mock<() => Promise<void>>;
  refreshUser: Mock<() => Promise<void>>;
}

export interface WorkspaceMock {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
  selectWorkspace: Mock<(id: string) => void>;
  createWorkspace: Mock<(name: string, slug?: string) => Promise<CreateWorkspaceResult>>;
  refresh: Mock<() => Promise<void>>;
  applySavedWorkspace: Mock<(workspace: Workspace) => void>;
}

export const authMock = {} as AuthMock;
export const workspaceMock = {} as WorkspaceMock;

export function resetMocks() {
  fns.clear();
  Object.assign(authMock, {
    user: testUser,
    status: "authenticated",
    needsPlan: false,
    confirmed: true,
    login: vi.fn(async () => null),
    register: vi.fn(async () => null),
    logout: vi.fn(async () => undefined),
    refreshUser: vi.fn(async () => undefined),
  } satisfies AuthMock);
  Object.assign(workspaceMock, {
    workspaces: [testWorkspace],
    currentWorkspace: testWorkspace,
    loading: false,
    selectWorkspace: vi.fn(),
    createWorkspace: vi.fn(async () => ({ workspace: testWorkspace })),
    refresh: vi.fn(async () => undefined),
    applySavedWorkspace: vi.fn(),
  } satisfies WorkspaceMock);
}

resetMocks();
