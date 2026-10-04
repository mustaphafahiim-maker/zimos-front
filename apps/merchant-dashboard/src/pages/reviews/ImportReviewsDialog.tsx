import { useState } from "react";
import { Download } from "lucide-react";
import { Alert, Button, Input, Label } from "@store-builder/ui";
import { reviewImportRun, reviewImporterInfo, type ReviewImportRequest, type ReviewImportResult } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

/**
 * Importing the merchant's own reviews of a product from their Shopify store
 * (SPEC §7.7): the product page's link and filters. Imported reviews carry no
 * "verified buyer" badge and, unless the merchant says so, wait for approval.
 */

const STRINGS = {
  en: {
    open: "Import reviews",
    title: "Import reviews from Shopify",
    description: "Paste the link of the same product in your Shopify store. Its reviews are added to the product you choose here, without the “verified buyer” badge.",
    product: "Product here",
    chooseProduct: "Choose a product",
    url: "Product link on Shopify",
    urlHint: "For example https://your-store.com/products/summer-cap",
    photosOnly: "Only reviews with photos",
    minRating: "Lowest rating",
    stars: "{n} stars and up",
    anyRating: "Any rating",
    language: "Language",
    anyLanguage: "Any language",
    arabic: "Arabic",
    english: "English",
    french: "French",
    publish: "Show them in the store now (otherwise they wait for your approval)",
    missing: "Choose the product and paste its Shopify link.",
    sandbox: "Test mode: this importer returns sample reviews marked “sandbox”, not your store's. Use it on a test store only.",
    unavailable: "Importing reviews isn't available yet.",
    cancel: "Cancel",
    close: "Close",
    run: "Import",
    running: "Importing…",
    done: "{imported} imported · {duplicates} already here · {filtered} left out by the filters (of {found} found).",
  },
  ar: {
    open: "استيراد تقييمات",
    title: "استيراد تقييمات من شوبيفاي",
    description: "الصق لينك نفس المنتج في متجرك على شوبيفاي. تقييماته هتتضاف للمنتج اللي هتختاره هنا، من غير علامة «مشترٍ موثّق».",
    product: "المنتج هنا",
    chooseProduct: "اختر منتجًا",
    url: "لينك المنتج على شوبيفاي",
    urlHint: "مثلًا https://your-store.com/products/summer-cap",
    photosOnly: "التقييمات اللي فيها صور بس",
    minRating: "أقل تقييم",
    stars: "{n} نجوم فأكثر",
    anyRating: "أي تقييم",
    language: "اللغة",
    anyLanguage: "أي لغة",
    arabic: "عربي",
    english: "إنجليزي",
    french: "فرنساوي",
    publish: "اعرضها في المتجر دلوقتي (غير كده هتستنى موافقتك)",
    missing: "اختر المنتج والصق لينك شوبيفاي بتاعه.",
    sandbox: "وضع تجريبي: المستورد ده بيرجّع تقييمات تجريبية مكتوب عليها «sandbox»، مش تقييمات متجرك. استخدمه في متجر تجريبي بس.",
    unavailable: "استيراد التقييمات مش متاح لسه.",
    cancel: "إلغاء",
    close: "إغلاق",
    run: "استيراد",
    running: "جارٍ الاستيراد…",
    done: "اتضاف {imported} · {duplicates} موجودين قبل كده · {filtered} اتشالوا بالفلاتر (من {found}).",
  },
} satisfies Messages;

export function ImportReviewsButton({ onImported }: { onImported: () => void }) {
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Download className="size-4" aria-hidden />
        {t.open}
      </Button>
      {open && <ImportReviewsDialog onClose={() => setOpen(false)} onImported={onImported} />}
    </>
  );
}

function ImportReviewsDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const importer = useAsync(() => reviewImporterInfo(apiClient, workspaceId), [workspaceId]);
  const products = useAsync(() => apiClient.listProducts(workspaceId, { status: ["draft", "active"], limit: 200 }), [workspaceId]);
  const [form, setForm] = useState<ReviewImportRequest>({ productId: "", url: "", photosOnly: false, minRating: 1, language: "any", status: "pending" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewImportResult | null>(null);
  const set = (patch: Partial<ReviewImportRequest>) => setForm((prev) => ({ ...prev, ...patch }));

  async function run() {
    if (!form.productId || !form.url.trim()) {
      setError(t.missing);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const done = await reviewImportRun(apiClient, workspaceId, { ...form, url: form.url.trim() });
      setResult(done);
      if (done.imported > 0) {
        toast.success(fmt(t.done, { imported: done.imported, duplicates: done.duplicates, filtered: done.filteredOut, found: done.found }));
        onImported();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const unavailable = importer.data && !importer.data.available;
  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={t.title}
      description={t.description}
      footer={
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {result ? t.close : t.cancel}
          </Button>
          <Button type="button" disabled={busy || Boolean(unavailable)} onClick={() => void run()}>
            {busy ? t.running : t.run}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {unavailable && <Alert>{t.unavailable}</Alert>}
        {importer.data?.sandbox && <Alert>{t.sandbox}</Alert>}
        <div className="space-y-1.5">
          <Label htmlFor="import-product">{t.product}</Label>
          <Select id="import-product" value={form.productId} disabled={busy || products.loading} onChange={(e) => set({ productId: e.target.value })}>
            <option value="">{t.chooseProduct}</option>
            {(products.data?.products ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="import-url">{t.url}</Label>
          <Input
            id="import-url"
            type="url"
            dir="ltr"
            maxLength={1000}
            placeholder="https://"
            value={form.url}
            disabled={busy}
            aria-describedby="import-url-hint"
            onChange={(e) => set({ url: e.target.value })}
          />
          <p id="import-url-hint" className="text-xs text-ink-soft" dir="ltr">
            {t.urlHint}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="import-rating">{t.minRating}</Label>
            <Select id="import-rating" value={String(form.minRating)} disabled={busy} onChange={(e) => set({ minRating: Number(e.target.value) })}>
              <option value="1">{t.anyRating}</option>
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {fmt(t.stars, { n })}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="import-language">{t.language}</Label>
            <Select
              id="import-language"
              value={form.language}
              disabled={busy}
              onChange={(e) => set({ language: e.target.value as ReviewImportRequest["language"] })}
            >
              <option value="any">{t.anyLanguage}</option>
              <option value="ar">{t.arabic}</option>
              <option value="en">{t.english}</option>
              <option value="fr">{t.french}</option>
            </Select>
          </div>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
          <input type="checkbox" className="size-4 accent-primary" checked={Boolean(form.photosOnly)} disabled={busy} onChange={(e) => set({ photosOnly: e.target.checked })} />
          {t.photosOnly}
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={form.status === "approved"}
            disabled={busy}
            onChange={(e) => set({ status: e.target.checked ? "approved" : "pending" })}
          />
          {t.publish}
        </label>
        {error && <Alert variant="danger">{error}</Alert>}
        {result && (
          <Alert variant={result.imported > 0 ? "success" : "info"}>
            {fmt(t.done, { imported: result.imported, duplicates: result.duplicates, filtered: result.filteredOut, found: result.found })}
          </Alert>
        )}
      </div>
    </Modal>
  );
}
