import { describe, expect, it } from "vitest";
import { COMMON } from "./LocaleContext";

const modules = import.meta.glob(["../pages/**/*.strings.ts", "../pages/onboarding/strings.ts", "../pages/generator/strings.ts"], { eager: true });

/**
 * Deliberately blank values (the UI guards on truthiness). Arabic folds "off"
 * into "get" ("واحصل على خصم"), so OffersPage renders no trailing word.
 */
const INTENTIONALLY_EMPTY = new Set(["offers/OffersPage.strings.ts#FORM_STRINGS:off"]);

type Table ={ en: unknown; ar: unknown };

function isTable(v: unknown): v is Table {
  return !!v && typeof v === "object" && !Array.isArray(v) && "en" in v && "ar" in v && Object.keys(v).length === 2;
}

/** Flattened "a.b.c" leaf paths -> value. */
function leaves(v: unknown, prefix = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (v && typeof v === "object") {
    for (const [k, child] of Object.entries(v)) for (const [p, x] of leaves(child, prefix ? `${prefix}.${k}` : k)) out.set(p, x);
  } else {
    out.set(prefix, v);
  }
  return out;
}

const tables: Array<[string, Table]> = [["LocaleContext.COMMON", COMMON]];
for (const [file, mod] of Object.entries(modules)) {
  for (const [name, value] of Object.entries(mod as Record<string, unknown>)) {
    if (isTable(value)) tables.push([`${file.replace("../pages/", "")}#${name}`, value]);
  }
}

describe("i18n tables", () => {
  it("found the known strings modules", () => {
    expect(Object.keys(modules).length).toBeGreaterThanOrEqual(12);
    expect(tables.length).toBeGreaterThan(12);
  });

  it.each(tables)("%s: en and ar have identical keys and no empty strings", (name, table) => {
    const en = leaves(table.en);
    const ar = leaves(table.ar);
    expect([...ar.keys()].sort()).toEqual([...en.keys()].sort());
    for (const [path, value] of [...en, ...ar]) {
      if (typeof value === "string" && !INTENTIONALLY_EMPTY.has(`${name}:${path}`)) expect(value.trim(), path).not.toBe("");
    }
  });
});
