/**
 * Tiny localStorage-backed persistence for the admin prototype features.
 *
 * Each collection is stored under `zimos.admin.mock.<name>` and seeded on first
 * read. Mutations write straight back. This is a stand-in for the backend and
 * is intentionally dumb — every call site in `adminApi.ts` carries a
 * `// BACKEND:` comment naming the endpoint it should become.
 */

const PREFIX = "zimos.admin.mock";

function key(name: string) {
  return `${PREFIX}.${name}`;
}

export function readCollection<T>(name: string, seed: () => T): T {
  const k = key(name);
  try {
    const raw = localStorage.getItem(k);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* fall through to seed */
  }
  const value = seed();
  writeCollection(name, value);
  return value;
}

export function writeCollection<T>(name: string, value: T): T {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
  return value;
}

export function resetMockData() {
  try {
    const remove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${PREFIX}.`)) remove.push(k);
    }
    remove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/** A list collection of records with an `id`. */
export function collection<T extends { id: string }>(name: string, seed: () => T[]) {
  return {
    all(): T[] {
      return readCollection<T[]>(name, seed);
    },
    save(list: T[]): T[] {
      return writeCollection(name, list);
    },
    find(id: string): T | undefined {
      return this.all().find((item) => item.id === id);
    },
    upsert(item: T): T {
      const list = this.all();
      const idx = list.findIndex((x) => x.id === item.id);
      if (idx === -1) list.unshift(item);
      else list[idx] = item;
      this.save(list);
      return item;
    },
    update(id: string, patch: Partial<T>): T {
      const list = this.all();
      const idx = list.findIndex((x) => x.id === id);
      if (idx === -1) throw new Error("Record not found.");
      const next = { ...list[idx], ...patch };
      list[idx] = next;
      this.save(list);
      return next;
    },
    remove(id: string): void {
      this.save(this.all().filter((x) => x.id !== id));
    },
  };
}

/** Simulated network latency so loading states are visible and realistic. */
export function delay<T>(value: T, ms = 240): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function uid(prefix = ""): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${raw.slice(0, 8)}` : raw;
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

export function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3_600_000).toISOString();
}

export function daysFromNow(n: number, hour = 12): string {
  return daysAgo(-n, hour);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Deterministic PRNG so seeded data is stable per id. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pick<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length) % list.length];
}

export function between(rand: () => number, min: number, max: number): number {
  return Math.round(min + rand() * (max - min));
}
