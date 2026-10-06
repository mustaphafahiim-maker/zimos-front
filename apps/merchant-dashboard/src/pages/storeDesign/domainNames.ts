/**
 * Naming helpers for the domains screen. The server decides (backend
 * modules/domains/domainRules.js); these only shape what the merchant types
 * and sees, with the same short list of three-label suffixes.
 */

const MULTI_LABEL_SUFFIXES = new Set(
  [
    "com.eg net.eg org.eg edu.eg gov.eg sci.eg info.eg name.eg tv.eg",
    "com.sa net.sa org.sa edu.sa gov.sa med.sa pub.sa sch.sa",
    "co.ae net.ae org.ae ac.ae gov.ae com.kw net.kw org.kw com.qa net.qa org.qa",
    "com.bh net.bh org.bh com.om co.om net.om org.om com.jo net.jo org.jo com.lb net.lb org.lb",
    "com.ly com.tn com.dz co.ma com.iq com.ps com.sd com.ye com.sy com.tr co.uk org.uk",
    "com.au co.nz co.za co.in co.jp com.br com.mx com.cn com.hk com.sg com.my com.pk com.ng co.ke",
  ]
    .join(" ")
    .split(" ")
);

/** What the merchant typed, as a bare lower-case host: no scheme, path, port or final dot. */
export function cleanHostname(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

/** example.com for www.example.com; example.com.eg for shop.example.com.eg. */
export function registrableDomain(host: string): string {
  const labels = host.split(".");
  const size = MULTI_LABEL_SUFFIXES.has(labels.slice(-2).join(".")) ? 3 : 2;
  return labels.slice(-size).join(".");
}

/** A bare domain with no subdomain in front (example.com), which cannot be connected. */
export function isApex(host: string): boolean {
  return host.includes(".") && registrableDomain(host) === host;
}

/** The record's name as registrars ask for it: relative to the domain (`www`, `_zimos-verify.www`). */
export function relativeName(name: string, apex: string): string {
  if (name === apex) return "@";
  return name.endsWith(`.${apex}`) ? name.slice(0, -(apex.length + 1)) : name;
}
