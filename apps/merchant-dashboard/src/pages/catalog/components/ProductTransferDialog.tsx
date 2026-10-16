import { useEffect, useRef, useState } from "react";
import { Download, FileUp, Link2 } from "lucide-react";
import { Alert, Button, Input, Label, Spinner } from "@store-builder/ui";
import {
  catalogExportProducts,
  catalogGetImport,
  catalogImportFile,
  catalogImportFromLink,
  catalogImportTemplate,
  type CatalogImport,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";

/**
 * Import and export of products (SPEC §7.5): a JSON file to move products
 * between stores, an Excel/CSV sheet from the template, or one product from a
 * Shopify link. An import runs in the background; the dialog follows it and
 * shows the report of the rows that could not be imported.
 */

const STRINGS = {
  en: {
    title: "Import and export products",
    description: "Move products in and out of your store.",
    tab_file: "From a file",
    tab_link: "From a product link",
    tab_export: "Export",
    fileHint:
      "An Excel or CSV sheet built from the template, or a JSON file exported from a ZIMOS store. Rows with the same name become the variants of one product.",
    chooseFile: "Choose a file",
    template: "Download the template",
    linkLabel: "Shopify product link",
    linkPlaceholder: "https://store.com/products/product-name",
    linkHint:
      "Copies the name, description, images, options and prices of one product from a Shopify store. It is created as a draft with no stock. Only import products you have the right to sell.",
    importLink: "Import product",
    exportHint:
      "Downloads every product that is not archived — with variants, offers, collections and page content — as one JSON file. Import it in another ZIMOS store to copy your catalog.",
    exportButton: "Download JSON",
    exporting: "Preparing…",
    working: "Importing {total} products…",
    done: "{created} of {total} products imported.",
    failedTitle: "{count} could not be imported:",
    row: "Row {row}",
    stopped: "The import stopped before finishing.",
    another: "Import something else",
    close: "Close",
  },
  ar: {
    title: "استيراد وتصدير المنتجات",
    description: "انقل المنتجات من وإلى متجرك.",
    tab_file: "من ملف",
    tab_link: "من رابط منتج",
    tab_export: "تصدير",
    fileHint:
      "ملف Excel أو CSV من القالب، أو ملف JSON مُصدَّر من متجر ZIMOS. الصفوف التي لها نفس الاسم تصبح متغيرات لمنتج واحد.",
    chooseFile: "اختر ملفًا",
    template: "تحميل القالب",
    linkLabel: "رابط منتج Shopify",
    linkPlaceholder: "https://store.com/products/product-name",
    linkHint:
      "ينسخ اسم ووصف وصور وخيارات وأسعار منتج واحد من متجر Shopify. يُنشأ كمسودة بدون مخزون. استورد فقط المنتجات التي يحق لك بيعها.",
    importLink: "استيراد المنتج",
    exportHint:
      "يحمّل كل المنتجات غير المؤرشفة — بالمتغيرات والعروض والمجموعات ومحتوى الصفحة — في ملف JSON واحد. استورده في متجر ZIMOS آخر لنسخ منتجاتك.",
    exportButton: "تحميل JSON",
    exporting: "جارٍ التجهيز…",
    working: "جارٍ استيراد {total} منتج…",
    done: "تم استيراد {created} من {total} منتج.",
    failedTitle: "تعذّر استيراد {count}:",
    row: "صف {row}",
    stopped: "توقف الاستيراد قبل أن يكتمل.",
    another: "استيراد شيء آخر",
    close: "إغلاق",
  },
} satisfies Messages;

type Tab = "file" | "link" | "export";
const TABS: Tab[] = ["file", "link", "export"];

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ProductTransferDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const fileInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("file");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<CatalogImport | null>(null);

  // The caller's callback may be a new function every render; the poll must not restart for that.
  const imported = useRef(onImported);
  imported.current = onImported;

  const running = job !== null && (job.status === "queued" || job.status === "running");

  // Follow a running import until it finishes.
  useEffect(() => {
    if (!job || !running) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const next = await catalogGetImport(apiClient, workspaceId, job.id);
        if (cancelled) return;
        setJob(next);
        if (next.status === "done" || next.status === "failed") imported.current();
      } catch {
        // A missed poll is retried on the next tick: same job, new object.
        if (!cancelled) setJob({ ...job });
      }
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [job, running, workspaceId]);

  async function start(run: () => Promise<CatalogImport>) {
    setBusy(true);
    setError(null);
    try {
      setJob(await run());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function download(run: () => Promise<Blob>, filename: string) {
    setBusy(true);
    setError(null);
    try {
      save(await run(), filename);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={t.title}
      description={t.description}
      footer={
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
          {t.close}
        </Button>
      }
    >
      {job ? (
        <div className="space-y-4">
          {running ? (
            <p role="status" className="flex items-center gap-3 text-sm text-ink">
              <Spinner className="size-4" />
              {fmt(t.working, { total: job.total })}
            </p>
          ) : (
            <>
              <Alert variant={job.failedCount > 0 || job.status === "failed" ? "info" : "success"}>
                {fmt(t.done, { created: job.createdCount, total: job.total })}
                {job.status === "failed" ? ` ${t.stopped}` : ""}
              </Alert>
              {job.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-ink">{fmt(t.failedTitle, { count: job.failedCount })}</p>
                  <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-[0.5rem] border border-line text-sm">
                    {job.errors.map((item, index) => (
                      <li key={index} className="px-3 py-2">
                        <p className="font-medium text-ink">
                          {item.row !== null && <span className="text-ink-soft">{fmt(t.row, { row: item.row })} · </span>}
                          {item.name}
                        </p>
                        <p className="text-ink-soft" dir="auto">
                          {item.message}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Button type="button" variant="outline" onClick={() => setJob(null)}>
                {t.another}
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div role="tablist" className="flex flex-wrap gap-1 border-b border-line">
            {TABS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => {
                  setTab(key);
                  setError(null);
                }}
                className={`-mb-px min-h-11 cursor-pointer border-b-2 px-3 text-sm font-medium transition-colors ${
                  tab === key ? "border-primary text-primary" : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                {t[`tab_${key}`]}
              </button>
            ))}
          </div>

          {tab === "file" && (
            <div className="space-y-3">
              <p className="text-sm text-ink-soft">{t.fileHint}</p>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.xlsx,.json,application/json,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void start(() => catalogImportFile(apiClient, workspaceId, file));
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>
                  {busy ? <Spinner className="size-4" /> : <FileUp className="size-4" aria-hidden />}
                  {t.chooseFile}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void download(() => catalogImportTemplate(apiClient, workspaceId), "products-template.csv")}
                >
                  <Download className="size-4" aria-hidden />
                  {t.template}
                </Button>
              </div>
            </div>
          )}

          {tab === "link" && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (link.trim()) void start(() => catalogImportFromLink(apiClient, workspaceId, link.trim()));
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="import-link">{t.linkLabel}</Label>
                <Input
                  id="import-link"
                  type="url"
                  dir="ltr"
                  placeholder={t.linkPlaceholder}
                  value={link}
                  disabled={busy}
                  onChange={(e) => setLink(e.target.value)}
                />
                <p className="text-xs text-ink-soft">{t.linkHint}</p>
              </div>
              <Button type="submit" disabled={busy || !link.trim()}>
                {busy ? <Spinner className="size-4" /> : <Link2 className="size-4" aria-hidden />}
                {t.importLink}
              </Button>
            </form>
          )}

          {tab === "export" && (
            <div className="space-y-3">
              <p className="text-sm text-ink-soft">{t.exportHint}</p>
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void download(
                    () => catalogExportProducts(apiClient, workspaceId),
                    `products-${new Date().toISOString().slice(0, 10)}.json`
                  )
                }
              >
                {busy ? <Spinner className="size-4" /> : <Download className="size-4" aria-hidden />}
                {busy ? t.exporting : t.exportButton}
              </Button>
            </div>
          )}

          {error && <Alert variant="danger">{error}</Alert>}
        </div>
      )}
    </Modal>
  );
}
