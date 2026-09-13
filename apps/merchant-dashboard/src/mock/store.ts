/**
 * Tiny localStorage-backed persistence for the prototype features.
 *
 * Each collection is stored under `zimos.mock.<workspaceId>.<name>` and seeded
 * on first read. Mutations write straight back. This is a stand-in for the
 * backend and is intentionally dumb — swap `mockApi` for real api-client
 * methods once the endpoints in BACKEND_CONTRACT.md exist.
 */

const PREFIX = "zimos.mock";

function key(workspaceId: string, name: string) {
  return `${PREFIX}.${workspaceId}.${name}`;
}

export function readCollection<T>(workspaceId: string, name: string, seed: () => T): T {
  const k = key(workspaceId, name);
  try {
    const raw = localStorage.getItem(k);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* fall through to seed */
  }
  const value = seed();
  try {
    localStorage.setItem(k, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
  return value;
}

export function writeCollection<T>(workspaceId: string, name: string, value: T): T {
  try {
    localStorage.setItem(key(workspaceId, name), JSON.stringify(value));
  } catch {
    /* ignore */
  }
  return value;
}

export function resetMockData(workspaceId?: string) {
  try {
    const remove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(workspaceId ? `${PREFIX}.${workspaceId}.` : `${PREFIX}.`)) remove.push(k);
    }
    remove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/** Simulated network latency so loading states are visible and realistic. */
export function delay<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function daysAgo(n: number, hour = 12): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9؀-ۿ]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
