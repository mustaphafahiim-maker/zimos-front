import { describe, expect, it } from "vitest";
import type { Product } from "@store-builder/api-client";
import { parseCsv, parseCsvRecords, toCsv, UTF8_BOM } from "./csv";
import {
  autoMap,
  buildImportPlan,
  buildUpdatePayload,
  missingRequired,
  missingVariants,
  parseMoneyCell,
  productsToRows,
  TEMPLATE_ROWS,
} from "./productImport";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas, escaped quotes and embedded newlines", () => {
    const text = 'name,description\n"Shirt, blue","He said ""hi""\nsecond line"\n';
    expect(parseCsv(text)).toEqual([
      ["name", "description"],
      ["Shirt, blue", 'He said "hi"\nsecond line'],
    ]);
  });

  it("handles CRLF and bare CR line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n3,4\r5,6\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ]);
  });

  it("keeps CRLF inside quotes", () => {
    expect(parseCsv('a\r\n"x\r\ny"\r\n')).toEqual([["a"], ["x\r\ny"]]);
  });

  it("strips a UTF-8 BOM", () => {
    const rows = parseCsv(UTF8_BOM + "handle,name\nh,n");
    expect(rows[0][0]).toBe("handle");
  });

  it("parses Arabic text", () => {
    expect(parseCsv('الاسم,السعر\n"تيشيرت، قطن",١٥٠\n')).toEqual([
      ["الاسم", "السعر"],
      ["تيشيرت، قطن", "١٥٠"],
    ]);
  });

  it("skips empty lines but keeps spreadsheet row numbers", () => {
    const records = parseCsvRecords("a,b\n\n1,2\n , \n\n3,4\n\n");
    expect(records.map((r) => r.cells)).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
    expect(records.map((r) => r.row)).toEqual([1, 3, 6]);
  });

  it("keeps empty trailing cells and quoted empty values", () => {
    expect(parseCsv('a,b,c\n1,,\n"",x,')).toEqual([
      ["a", "b", "c"],
      ["1", "", ""],
      ["", "x", ""],
    ]);
  });

  it("auto-detects semicolon delimiters", () => {
    expect(parseCsv("a;b\n1,5;2")).toEqual([
      ["a", "b"],
      ["1,5", "2"],
    ]);
  });

  it("round-trips through toCsv", () => {
    const rows = [
      ["handle", "description"],
      ["x", 'multi\nline, "quoted" — عربي'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

function recordsOf(text: string) {
  const records = parseCsvRecords(text);
  const [header, ...data] = records;
  return { mapping: autoMap(header.cells), data };
}

describe("autoMap", () => {
  it("maps English headers case-insensitively and Arabic synonyms", () => {
    const m = autoMap(["Handle", "الاسم", "السعر", "المخزون", "الكود", "Compare At Price", "unknown"]);
    expect(m.handle).toBe(0);
    expect(m.name).toBe(1);
    expect(m.price).toBe(2);
    expect(m.stock).toBe(3);
    expect(m.sku).toBe(4);
    expect(m.compare_at_price).toBe(5);
    expect(missingRequired(m)).toEqual([]);
  });

  it("reports missing required columns", () => {
    expect(missingRequired(autoMap(["sku"]))).toEqual(["name", "price"]);
  });
});

describe("buildImportPlan", () => {
  it("groups the template rows into one product with two variants", () => {
    const { mapping, data } = recordsOf(toCsv(TEMPLATE_ROWS));
    const plan = buildImportPlan(data, mapping);
    expect(plan.issues).toEqual([]);
    expect(plan.products).toHaveLength(1);
    const p = plan.products[0];
    expect(p.payload).toEqual({
      name: "Classic T-Shirt",
      slug: "classic-tshirt",
      description: "100% cotton, soft and breathable",
      status: "active",
      options: [{ name: "Size", values: ["M", "L"] }],
      tags: ["men", "cotton"],
    });
    expect(p.variants.map((v) => v.payload)).toEqual([
      { optionValues: { Size: "M" }, priceAmount: 29900, compareAtAmount: 34900, costAmount: 15000, stockOnHand: 25, sku: "TSHIRT-M" },
      { optionValues: { Size: "L" }, priceAmount: 29900, compareAtAmount: 34900, costAmount: 15000, stockOnHand: 18, sku: "TSHIRT-L" },
    ]);
    expect(p.imageUrls).toEqual(["https://example.com/tshirt.jpg"]);
  });

  it("flags invalid values by row", () => {
    const csv = [
      "handle,name,status,sku,price,stock,option1_name,option1_value",
      "a,,active,S1,10,1,,",
      "b,B,live,S2,-5,1.5,,",
      "c,C,draft,S2,abc,2,,",
      "d,D,,S3,12.5,3,Size,",
      "d,,,S4,12.5,3,Size,",
    ].join("\n");
    const { mapping, data } = recordsOf(csv);
    const plan = buildImportPlan(data, mapping);
    const byRow = (row: number) => plan.issues.filter((i) => i.row === row).map((i) => i.field);
    expect(byRow(2)).toEqual(["name"]);
    expect(byRow(3)).toEqual(expect.arrayContaining(["status", "price", "stock"]));
    expect(byRow(4)).toEqual(expect.arrayContaining(["sku", "price"]));
    expect(byRow(5)).toContain("option1_value");
    expect(plan.validProducts).toHaveLength(0);
    expect(plan.invalidProducts).toHaveLength(4);
  });

  it("keeps valid products when others fail and accepts Arabic digits/status", () => {
    const csv = "الاسم,السعر,المخزون,الحالة\nتيشيرت,١٥٠٫٥٠,٣,نشط\nBad,x,1,active\n";
    const { mapping, data } = recordsOf(csv);
    const plan = buildImportPlan(data, mapping);
    expect(plan.validProducts).toHaveLength(1);
    expect(plan.validProducts[0].payload.status).toBe("active");
    expect(plan.validProducts[0].payload.slug).toBeUndefined();
    expect(plan.validProducts[0].variants[0].payload).toMatchObject({ priceAmount: 15050, stockOnHand: 3 });
  });

  it("detects duplicate option combinations and SKUs used by other catalog products", () => {
    const existing = [
      { id: "p1", slug: "other", name: "Other", options: [], variants: [{ sku: "TAKEN", optionValues: {} }] },
    ] as unknown as Product[];
    const csv = "handle,name,price,sku,option1_name,option1_value\nx,X,1,TAKEN,Size,M\nx,,1,,Size,M\n";
    const { mapping, data } = recordsOf(csv);
    const plan = buildImportPlan(data, mapping, existing);
    expect(plan.issues.map((i) => [i.row, i.field])).toEqual([
      [2, "sku"],
      [3, "option1_value"],
    ]);
  });

  it("matches existing products by handle and computes update payload + missing variants", () => {
    const existing = [
      {
        id: "p1",
        slug: "classic-tshirt",
        name: "Old name",
        options: [{ name: "Size", values: ["M"] }],
        variants: [{ sku: "TSHIRT-M", optionValues: { Size: "M" } }],
      },
    ] as unknown as Product[];
    const { mapping, data } = recordsOf(toCsv(TEMPLATE_ROWS));
    const plan = buildImportPlan(data, mapping, existing);
    const p = plan.validProducts[0];
    expect(p.existing?.id).toBe("p1");
    expect(buildUpdatePayload(p, existing[0])).toEqual({
      name: "Classic T-Shirt",
      options: [{ name: "Size", values: ["M", "L"] }],
      description: "100% cotton, soft and breathable",
      status: "active",
      tags: ["men", "cotton"],
    });
    expect(missingVariants(p, existing[0].variants!).map((v) => v.payload.sku)).toEqual(["TSHIRT-L"]);
  });
});

describe("parseMoneyCell", () => {
  it("converts major units to minor", () => {
    expect(parseMoneyCell("199.5")).toBe(19950);
    expect(parseMoneyCell("0")).toBe(0);
    expect(parseMoneyCell("")).toBeNull();
    expect(parseMoneyCell("1.234")).toBeNaN();
    expect(parseMoneyCell("-1")).toBeNaN();
  });
});

describe("productsToRows", () => {
  it("exports one row per variant in the template format and re-imports cleanly", () => {
    const products = [
      {
        id: "p1",
        slug: "classic-tshirt",
        name: "Classic T-Shirt",
        description: "Soft, \"cotton\"",
        status: "active",
        options: [{ name: "Size", values: ["M", "L"] }],
        media: [],
        tags: ["men"],
        variants: [
          { sku: "M1", optionValues: { Size: "M" }, priceAmount: "29900", compareAtAmount: null, costAmount: "15000", stockOnHand: 4 },
          { sku: "L1", optionValues: { Size: "L" }, priceAmount: "31900", compareAtAmount: null, costAmount: null, stockOnHand: 0 },
        ],
      },
    ] as unknown as Product[];
    const rows = productsToRows(products);
    expect(rows[0]).toEqual(TEMPLATE_ROWS[0]);
    expect(rows).toHaveLength(3);
    const { mapping, data } = recordsOf(toCsv(rows));
    const plan = buildImportPlan(data, mapping);
    expect(plan.issues).toEqual([]);
    expect(plan.products[0].variants.map((v) => v.payload.priceAmount)).toEqual([29900, 31900]);
  });
});
