/**
 * Pure (React-free) logic behind the product CSV import/export: column
 * auto-mapping, grouping rows into products by handle, validation mirroring
 * the backend Joi rules (src/modules/catalog/catalogValidation.js), and the
 * exact API payloads the importer sends.
 */
import type {
  CreateProductPayload,
  CreateVariantPayload,
  Product,
  ProductOption,
  ProductStatus,
  UpdateProductPayload,
  Variant,
} from "@store-builder/api-client";
import { majorToMinor, minorToMajorInput } from "@/lib/format";
import type { CsvRecord } from "./csv";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_OPTIONS = 3;

export const FIELD_KEYS = [
  "handle",
  "name",
  "description",
  "status",
  "option1_name",
  "option1_value",
  "option2_name",
  "option2_value",
  "option3_name",
  "option3_value",
  "sku",
  "price",
  "compare_at_price",
  "cost",
  "stock",
  "image_url",
  "tags",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

/** Header row of the downloadable template (option3 is accepted on import but not in the template). */
export const TEMPLATE_HEADERS: FieldKey[] = FIELD_KEYS.filter((k) => !k.startsWith("option3"));

export const REQUIRED_FIELDS: FieldKey[] = ["name", "price"];

export type Mapping = Record<FieldKey, number | null>;

export interface Bilingual {
  en: string;
  ar: string;
}

export const TEMPLATE_ROWS: string[][] = [
  TEMPLATE_HEADERS,
  ["classic-tshirt", "Classic T-Shirt", "100% cotton, soft and breathable", "active", "Size", "M", "", "", "TSHIRT-M", "299.00", "349.00", "150.00", "25", "https://example.com/tshirt.jpg", "men, cotton"],
  ["classic-tshirt", "", "", "", "Size", "L", "", "", "TSHIRT-L", "299.00", "349.00", "150.00", "18", "", ""],
];

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

export function normalizeHeader(header: string): string {
  return header
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-.]+/g, "_")
    .replace(/_+/g, "_");
}

const SYNONYMS: Record<FieldKey, string[]> = {
  handle: ["handle", "slug", "url_handle", "product_handle", "المعرف", "المعرّف", "الرابط", "رابط_المنتج"],
  name: ["name", "title", "product_name", "product", "الاسم", "اسم_المنتج", "المنتج", "العنوان"],
  description: ["description", "body", "details", "الوصف", "التفاصيل"],
  status: ["status", "state", "الحالة"],
  option1_name: ["option1_name", "option_1_name", "اسم_الخيار_1", "اسم_الخيار1", "الخيار_1"],
  option1_value: ["option1_value", "option_1_value", "قيمة_الخيار_1", "قيمة_الخيار1"],
  option2_name: ["option2_name", "option_2_name", "اسم_الخيار_2", "اسم_الخيار2", "الخيار_2"],
  option2_value: ["option2_value", "option_2_value", "قيمة_الخيار_2", "قيمة_الخيار2"],
  option3_name: ["option3_name", "option_3_name", "اسم_الخيار_3", "اسم_الخيار3", "الخيار_3"],
  option3_value: ["option3_value", "option_3_value", "قيمة_الخيار_3", "قيمة_الخيار3"],
  sku: ["sku", "code", "product_code", "variant_sku", "الكود", "كود", "رمز_المنتج", "الرمز"],
  price: ["price", "sale_price", "السعر", "سعر", "سعر_البيع"],
  compare_at_price: ["compare_at_price", "compare_price", "old_price", "original_price", "السعر_قبل_الخصم", "السعر_الأصلي", "السعر_القديم"],
  cost: ["cost", "cost_price", "unit_cost", "التكلفة", "سعر_التكلفة"],
  stock: ["stock", "quantity", "qty", "inventory", "stock_on_hand", "المخزون", "الكمية"],
  image_url: ["image_url", "image", "image_src", "photo", "الصورة", "رابط_الصورة"],
  tags: ["tags", "tag", "الوسوم", "الكلمات_الدلالية", "التصنيفات"],
};

const SYNONYM_LOOKUP = new Map<string, FieldKey>();
for (const key of FIELD_KEYS) for (const s of SYNONYMS[key]) SYNONYM_LOOKUP.set(normalizeHeader(s), key);

export function emptyMapping(): Mapping {
  return Object.fromEntries(FIELD_KEYS.map((k) => [k, null])) as Mapping;
}

export function autoMap(headers: string[]): Mapping {
  const mapping = emptyMapping();
  headers.forEach((h, i) => {
    const key = SYNONYM_LOOKUP.get(normalizeHeader(h));
    if (key && mapping[key] === null) mapping[key] = i;
  });
  return mapping;
}

export function missingRequired(mapping: Mapping): FieldKey[] {
  return REQUIRED_FIELDS.filter((k) => mapping[k] === null);
}

export function cell(record: CsvRecord, mapping: Mapping, key: FieldKey): string {
  const idx = mapping[key];
  if (idx === null) return "";
  return (record.cells[idx] ?? "").trim();
}

// ---------------------------------------------------------------------------
// Value parsing
// ---------------------------------------------------------------------------

/** Backend slugify (src/core/utils/slugify.js) minus its "workspace" fallback. */
export function slugify(input: string): string {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 180);
}

/** Arabic-Indic / Persian digits and separators -> ASCII so "١٥٠٫٥٠" parses. */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/[٬\s]/g, "");
}

const STATUS_ALIASES: Record<string, ProductStatus> = {
  draft: "draft",
  active: "active",
  archived: "archived",
  مسودة: "draft",
  نشط: "active",
  مؤرشف: "archived",
};

export function parseStatus(value: string): ProductStatus | null {
  return STATUS_ALIASES[value.trim().toLowerCase()] ?? null;
}

export function parseTags(value: string): string[] {
  return Array.from(new Set(value.split(/[,،|;]/).map((t) => t.trim()).filter(Boolean)));
}

/** Major-unit money -> integer minor units; null for blank; NaN when invalid. */
export function parseMoneyCell(value: string): number | null {
  if (value === "") return null;
  const normalized = normalizeDigits(value);
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  return majorToMinor(normalized);
}

export function parseStockCell(value: string): number | null {
  if (value === "") return null;
  const normalized = normalizeDigits(value);
  return /^\d+$/.test(normalized) ? Number(normalized) : NaN;
}

// ---------------------------------------------------------------------------
// Grouping + validation
// ---------------------------------------------------------------------------

export interface RowIssue {
  row: number;
  field: FieldKey | null;
  message: Bilingual;
}

export interface PlannedVariant {
  row: number;
  payload: CreateVariantPayload;
}

export interface PlannedProduct {
  key: string;
  handle: string;
  rows: number[];
  payload: CreateProductPayload;
  /** Which product-level cells the file actually filled (update only sends these). */
  provided: { description: boolean; status: boolean; tags: boolean };
  variants: PlannedVariant[];
  imageUrls: string[];
  issues: RowIssue[];
  existing: Product | null;
}

export interface ImportPlan {
  products: PlannedProduct[];
  issues: RowIssue[];
  validProducts: PlannedProduct[];
  invalidProducts: PlannedProduct[];
}

const err = (row: number, field: FieldKey | null, en: string, ar: string): RowIssue => ({ row, field, message: { en, ar } });

function groupKey(record: CsvRecord, mapping: Mapping): string {
  const handle = cell(record, mapping, "handle");
  if (handle) return `h:${handle.toLowerCase()}`;
  return `r:${record.row}`;
}

/** Rows sharing a handle (case-insensitive) form one product; rows without a handle stand alone. */
export function groupRecords(records: CsvRecord[], mapping: Mapping): Map<string, CsvRecord[]> {
  const groups = new Map<string, CsvRecord[]>();
  for (const r of records) {
    const key = groupKey(r, mapping);
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }
  return groups;
}

function firstFilled(records: CsvRecord[], mapping: Mapping, key: FieldKey): string {
  for (const r of records) {
    const v = cell(r, mapping, key);
    if (v) return v;
  }
  return "";
}

/** Existing product matched by slug (from handle, or name when no handle) — falls back to exact name for non-Latin names. */
export function findExisting(handle: string, name: string, existing: Product[]): Product | null {
  const slug = slugify(handle || name);
  if (slug) {
    const bySlug = existing.find((p) => p.slug === slug);
    if (bySlug) return bySlug;
  }
  if (!handle || !slug) {
    const n = name.trim().toLowerCase();
    return existing.find((p) => p.name.trim().toLowerCase() === n) ?? null;
  }
  return null;
}

export function optionKey(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([k, v]) => `${k.toLowerCase()}=${v.toLowerCase()}`)
    .sort()
    .join("|");
}

export function buildImportPlan(records: CsvRecord[], mapping: Mapping, existing: Product[] = []): ImportPlan {
  const products: PlannedProduct[] = [];
  const seenSkus = new Map<string, number>();
  const existingSkuOwner = new Map<string, string>();
  for (const p of existing) for (const v of p.variants ?? []) if (v.sku) existingSkuOwner.set(v.sku, p.id);

  for (const [key, group] of groupRecords(records, mapping)) {
    const issues: RowIssue[] = [];
    const firstRow = group[0].row;
    const handle = cell(group[0], mapping, "handle");
    const name = firstFilled(group, mapping, "name");
    const description = firstFilled(group, mapping, "description");
    const statusRaw = firstFilled(group, mapping, "status");
    const tagsRaw = firstFilled(group, mapping, "tags");

    if (!name) issues.push(err(firstRow, "name", "Name is required.", "الاسم مطلوب."));
    else if (name.length > 300) issues.push(err(firstRow, "name", "Name must be 300 characters or fewer.", "يجب ألا يزيد الاسم عن 300 حرف."));
    if (description.length > 20000)
      issues.push(err(firstRow, "description", "Description must be 20,000 characters or fewer.", "يجب ألا يزيد الوصف عن 20,000 حرف."));

    let status: ProductStatus = "draft";
    if (statusRaw) {
      const parsed = parseStatus(statusRaw);
      if (parsed) status = parsed;
      else
        issues.push(
          err(firstRow, "status", `Status "${statusRaw}" is invalid — use draft, active or archived.`, `الحالة "${statusRaw}" غير صالحة — استخدم draft أو active أو archived.`)
        );
    }

    // Option names: first row that names option N defines it for the whole product.
    const optionNames: string[] = [];
    for (let i = 0; i < MAX_OPTIONS; i++) {
      optionNames.push(firstFilled(group, mapping, `option${i + 1}_name` as FieldKey));
    }
    const optionValuesByName = new Map<string, string[]>();
    const seenCombos = new Set<string>();
    const variants: PlannedVariant[] = [];
    const imageUrls: string[] = [];
    const existingProduct = findExisting(handle, name, existing);

    for (const r of group) {
      const rowIssuesBefore = issues.length;
      const optionValues: Record<string, string> = {};
      for (let i = 0; i < MAX_OPTIONS; i++) {
        const nameKey = `option${i + 1}_name` as FieldKey;
        const valueKey = `option${i + 1}_value` as FieldKey;
        const rowName = cell(r, mapping, nameKey);
        const value = cell(r, mapping, valueKey);
        const optName = optionNames[i];
        if (rowName && optName && rowName.toLowerCase() !== optName.toLowerCase()) {
          issues.push(
            err(r.row, nameKey, `Option ${i + 1} is named "${rowName}" here but "${optName}" earlier for this handle.`, `الخيار ${i + 1} مسمّى "${rowName}" هنا لكنه "${optName}" في صف سابق لنفس المعرّف.`)
          );
        }
        if (value && !optName) {
          issues.push(err(r.row, nameKey, `Option ${i + 1} has a value but no option name.`, `للخيار ${i + 1} قيمة بدون اسم خيار.`));
        } else if (value) {
          optionValues[optName] = value;
          const values = optionValuesByName.get(optName) ?? [];
          if (!values.includes(value)) values.push(value);
          optionValuesByName.set(optName, values);
        } else if (optName && group.length > 1) {
          issues.push(err(r.row, valueKey, `Missing value for option "${optName}".`, `قيمة الخيار "${optName}" مفقودة.`));
        }
      }

      const combo = optionKey(optionValues);
      if (group.length > 1) {
        if (!combo) {
          issues.push(err(r.row, "option1_value", "Rows sharing a handle need option values to tell variants apart.", "الصفوف التي تشترك في نفس المعرّف تحتاج قيم خيارات للتمييز بين المتغيّرات."));
        } else if (seenCombos.has(combo)) {
          issues.push(err(r.row, "option1_value", "Duplicate option combination for this product.", "تركيبة الخيارات مكررة لهذا المنتج."));
        }
      }
      seenCombos.add(combo);

      const price = parseMoneyCell(cell(r, mapping, "price"));
      if (price === null) issues.push(err(r.row, "price", "Price is required.", "السعر مطلوب."));
      else if (Number.isNaN(price)) issues.push(err(r.row, "price", "Price must be a number ≥ 0 with at most 2 decimals.", "يجب أن يكون السعر رقمًا ≥ 0 بخانتين عشريتين كحد أقصى."));
      const compareAt = parseMoneyCell(cell(r, mapping, "compare_at_price"));
      if (Number.isNaN(compareAt))
        issues.push(err(r.row, "compare_at_price", "Compare-at price must be a number ≥ 0.", "يجب أن يكون السعر قبل الخصم رقمًا ≥ 0."));
      const cost = parseMoneyCell(cell(r, mapping, "cost"));
      if (Number.isNaN(cost)) issues.push(err(r.row, "cost", "Cost must be a number ≥ 0.", "يجب أن تكون التكلفة رقمًا ≥ 0."));
      const stock = parseStockCell(cell(r, mapping, "stock"));
      if (Number.isNaN(stock)) issues.push(err(r.row, "stock", "Stock must be a whole number ≥ 0.", "يجب أن يكون المخزون عددًا صحيحًا ≥ 0."));

      const sku = cell(r, mapping, "sku");
      if (sku) {
        if (sku.length > 100) issues.push(err(r.row, "sku", "SKU must be 100 characters or fewer.", "يجب ألا يزيد SKU عن 100 حرف."));
        const prev = seenSkus.get(sku);
        if (prev !== undefined) {
          issues.push(err(r.row, "sku", `SKU "${sku}" is duplicated (also on row ${prev}).`, `SKU "${sku}" مكرر (موجود أيضًا في الصف ${prev}).`));
        } else {
          seenSkus.set(sku, r.row);
        }
        const owner = existingSkuOwner.get(sku);
        if (owner && owner !== existingProduct?.id) {
          issues.push(err(r.row, "sku", `SKU "${sku}" is already used by another product in your catalog.`, `SKU "${sku}" مستخدم بالفعل لمنتج آخر في كتالوجك.`));
        }
      }

      const image = cell(r, mapping, "image_url");
      if (image && !imageUrls.includes(image)) imageUrls.push(image);

      if (issues.length === rowIssuesBefore && price !== null && !Number.isNaN(price)) {
        const payload: CreateVariantPayload = { optionValues, priceAmount: price, stockOnHand: stock ?? 0 };
        if (sku) payload.sku = sku;
        if (compareAt !== null) payload.compareAtAmount = compareAt;
        if (cost !== null) payload.costAmount = cost;
        variants.push({ row: r.row, payload });
      }
    }

    const options: ProductOption[] = optionNames
      .filter((n) => n && optionValuesByName.has(n))
      .map((n) => ({ name: n, values: optionValuesByName.get(n)! }));

    const payload: CreateProductPayload = { name, status, options, tags: parseTags(tagsRaw) };
    if (description) payload.description = description;
    const slug = slugify(handle);
    if (slug) payload.slug = slug;

    products.push({
      key,
      handle,
      rows: group.map((r) => r.row),
      payload,
      provided: { description: Boolean(description), status: Boolean(statusRaw), tags: Boolean(tagsRaw) },
      variants,
      imageUrls,
      issues,
      existing: existingProduct,
    });
  }

  const issues = products.flatMap((p) => p.issues).sort((a, b) => a.row - b.row);
  return {
    products,
    issues,
    validProducts: products.filter((p) => p.issues.length === 0),
    invalidProducts: products.filter((p) => p.issues.length > 0),
  };
}

// ---------------------------------------------------------------------------
// Update-mode payloads
// ---------------------------------------------------------------------------

/** Merges option names/values without dropping anything the product already has. */
export function mergeOptions(current: ProductOption[], incoming: ProductOption[]): ProductOption[] {
  const merged = current.map((o) => ({ name: o.name, values: [...o.values] }));
  for (const inc of incoming) {
    const match = merged.find((o) => o.name.toLowerCase() === inc.name.toLowerCase());
    if (!match) merged.push({ name: inc.name, values: [...inc.values] });
    else for (const v of inc.values) if (!match.values.includes(v)) match.values.push(v);
  }
  return merged;
}

export function buildUpdatePayload(planned: PlannedProduct, existing: Product): UpdateProductPayload {
  const payload: UpdateProductPayload = {
    name: planned.payload.name,
    options: mergeOptions(existing.options ?? [], planned.payload.options ?? []),
  };
  if (planned.provided.description) payload.description = planned.payload.description;
  if (planned.provided.status) payload.status = planned.payload.status;
  if (planned.provided.tags) payload.tags = planned.payload.tags;
  return payload;
}

/** Variants from the file that the existing product doesn't have yet (matched by SKU or option combination). */
export function missingVariants(planned: PlannedProduct, existingVariants: Variant[]): PlannedVariant[] {
  const skus = new Set(existingVariants.map((v) => v.sku).filter(Boolean));
  const combos = new Set(existingVariants.map((v) => optionKey(v.optionValues ?? {})));
  return planned.variants.filter((v) => {
    if (v.payload.sku && skus.has(v.payload.sku)) return false;
    return !combos.has(optionKey(v.payload.optionValues ?? {}));
  });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function productsToRows(products: Product[]): string[][] {
  const optionCount = Math.max(
    2,
    ...products.map((p) =>
      Math.min(MAX_OPTIONS, Math.max(p.options?.length ?? 0, ...(p.variants ?? []).map((v) => Object.keys(v.optionValues ?? {}).length)))
    )
  );
  const headers = FIELD_KEYS.filter((k) => {
    const m = /^option(\d)_/.exec(k);
    return !m || Number(m[1]) <= optionCount;
  });
  const rows: string[][] = [headers];
  const money = (v: string | null | undefined) => (v === null || v === undefined ? "" : minorToMajorInput(v));

  for (const p of products) {
    const variants = p.variants ?? [];
    const optionNames = (p.options ?? []).map((o) => o.name);
    for (const v of variants) for (const k of Object.keys(v.optionValues ?? {})) if (!optionNames.includes(k)) optionNames.push(k);
    const lines: Array<Variant | null> = variants.length ? variants : [null];
    lines.forEach((v, idx) => {
      const values: Record<string, string> = {
        handle: p.slug,
        name: idx === 0 ? p.name : "",
        description: idx === 0 ? (p.description ?? "") : "",
        status: idx === 0 ? p.status : "",
        sku: v?.sku ?? "",
        price: money(v?.priceAmount),
        compare_at_price: money(v?.compareAtAmount),
        cost: money(v?.costAmount),
        stock: v ? String(v.stockOnHand) : "",
        image_url: idx === 0 ? (p.media?.[0]?.url ?? "") : "",
        tags: idx === 0 ? (p.tags ?? []).join(", ") : "",
      };
      for (let i = 0; i < optionCount; i++) {
        const optName = optionNames[i] ?? "";
        values[`option${i + 1}_name`] = optName && v?.optionValues?.[optName] ? optName : "";
        values[`option${i + 1}_value`] = optName ? (v?.optionValues?.[optName] ?? "") : "";
      }
      rows.push(headers.map((h) => values[h] ?? ""));
    });
  }
  return rows;
}
