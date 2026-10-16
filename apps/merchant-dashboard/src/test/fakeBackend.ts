import { api } from "./mocks";

export interface FakeCall {
  path: string;
  method: string;
  body?: unknown;
}

type Answer = unknown | ((call: FakeCall) => unknown);

/**
 * One fake `apiClient.request` for a screen that talks to the API through the
 * endpoint functions. A route is "METHOD /end/of/the/path" (the query string
 * is ignored; the longest matching end wins) and answers with a value, a
 * function of the call, or an Error to reject with. A request no route
 * answers never settles, like any unmocked call. Returns the calls made.
 */
export function fakeBackend(routes: Record<string, Answer>): FakeCall[] {
  const calls: FakeCall[] = [];
  api.request.mockImplementation((async (path: string, opts: { method?: string; body?: unknown } = {}) => {
    const call: FakeCall = { path, method: opts.method ?? "GET", body: opts.body };
    calls.push(call);
    const bare = path.split("?")[0];
    const key = Object.keys(routes)
      .filter((k) => {
        const [method, end] = k.split(" ");
        return method === call.method && bare.endsWith(end);
      })
      .sort((a, b) => b.length - a.length)[0];
    if (!key) return new Promise<never>(() => undefined);
    const answer = routes[key];
    const value = typeof answer === "function" ? (answer as (call: FakeCall) => unknown)(call) : answer;
    if (value instanceof Error) throw value;
    return value;
  }) as never);
  return calls;
}

/** The calls of one method whose path ends a given way. */
export function callsTo(calls: FakeCall[], method: string, end: string): FakeCall[] {
  return calls.filter((c) => c.method === method && c.path.split("?")[0].endsWith(end));
}
