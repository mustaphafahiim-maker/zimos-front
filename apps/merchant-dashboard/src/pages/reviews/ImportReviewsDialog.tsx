import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import { reviewImportRun, reviewImporterInfo, type ReviewImportRequest, type ReviewImportResult } from "@store-builder/api-client";
import { Field } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";

/**
 * Importing the merchant's own reviews of a product from their Shopify store
 * (SPEC §7.7): the product page's link and filters. Imported reviews carry no
 * "verified buyer" badge and, unless the merchant says so, wait for approval.
 */

const FORM_ID = "import-reviews-form";

const EMPTY: ReviewImportRequest = { productId: "", url: "", photosOnly: false, minRating: 1, language: "any", status: "pending" };

const STRINGS = {
  en: {
    title: "Import reviews from Shopify",
    description: "Paste the link of the same product in your Shopify store. Its reviews are added to the product you choose here, without the “verified buyer” badge.",
    product: "Product here",
    chooseProduct: "Choose a product",
    productRequired: "Choose the product the reviews go to.",
    url: "Product link on Shopify",
    urlHint: "For example https://your-store.com/products/summer-cap",
    urlRequired: "Paste the link of the product's page on Shopify.",
    photosOnly: "Only reviews with photos",
    minRating: "Lowest rating",
    stars: "{n} stars and up",
    anyRating: "Any rating",
    language: "Language",
    anyLanguage: "Any language",
    arabic: "Arabic",
    english: "English",
    french: "French",
    publish: "Show them in the store now",
    publishHint: "Off: they wait for your approval.",
    sandbox: "Test mode: this importer returns sample reviews marked “sandbox”, not your store's. Use it on a test store only.",
    unavailable: "Importing reviews isn't available yet.",
    cancel: "Cancel",
    close: "Close",
    run: "Import",
    running: "Importing…",
    done: "{imported} imported · {duplicates} already here · {filtered} left out by the filters (of {found} found).",
  },
  ar: {
    title: "استورد تقييمات من شوبيفاي",
    description: "الصق لينك نفس المنتج في متجرك على شوبيفاي. تقييماته هتتضاف للمنتج اللي هتختاره هنا، من غير علامة «مشتري موثّق».",
    product: "المنتج هنا",
    chooseProduct: "اختار منتج",
    productRequired: "اختار المنتج اللي التقييمات هتتضاف له.",
    url: "لينك المنتج على شوبيفاي",
    urlHint: "مثلًا https://your-store.com/products/summer-cap",
    urlRequired: "الصق لينك صفحة المنتج على شوبيفاي.",
    photosOnly: "التقييمات اللي فيها صور بس",
    minRating: "أقل تقييم",
    stars: "{n} نجوم وأكتر",
    anyRating: "أي تقييم",
    language: "اللغة",
    anyLanguage: "أي لغة",
    arabic: "عربي",
    english: "إنجليزي",
    french: "فرنساوي",
    publish: "اعرضها في المتجر دلوقتي",
    publishHint: "لو مقفول: هتستنى موافقتك.",
    sandbox: "وضع تجريبي: المستورد ده بيرجّع تقييمات تجريبية مكتوب عليها «sandbox»، مش تقييمات متجرك. استخدمه في متجر تجريبي بس.",
    unavailable: "استيراد التقييمات مش متاح لسه.",
    cancel: "إلغاء",
    close: "قفل",
    run: "استورد",
    running: "بنستورد…",
    done: "اتضاف {imported} · {duplicates} موجودين قبل كده · {filtered} اتشالوا بالفلاتر (من {found}).",
  },
} satisfies Messages;

const CHECK_ROW = "flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink";
const CHECK_BOX = "size-5 shrink-0 cursor-pointer accent-primary";

export function ImportReviewsSheet({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  // Asked for once the sheet is first opened, not with the page.
  const [wanted, setWanted] = useState(open);
  if (open && !wanted) setWanted(true);
  const importer = useAsync(() => (wanted ? reviewImporterInfo(apiClient, workspaceId) : Promise.resolve(null)), [workspaceId, wanted]);
  const products = useAsync(
    () => (wanted ? apiClient.listProducts(workspaceId, { status: ["draft", "active"], limit: 200 }) : Promise.resolve(null)),
    [workspaceId, wanted]
  );
  const [form, setForm] = useState<ReviewImportRequest>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ product?: string; url?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewImportResult | null>(null);
  const productField = useRef<HTMLSelectElement>(null);
  const urlField = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<ReviewImportRequest>) => setForm((prev) => ({ ...prev, ...patch }));

  // Every opening starts from an empty form.
  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setBusy(false);
    setErrors({});
    setFormError(null);
    setResult(null);
  }, [open]);

  async function run(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found: { product?: string; url?: string } = {};
    if (!form.productId) found.product = t.productRequired;
    if (!form.url.trim()) found.url = t.urlRequired;
    setErrors(found);
    if (found.product || found.url) {
      // The first field that needs fixing, on screen and under the cursor.
      const first = found.product ? productField.current : urlField.current;
      first?.scrollIntoView({ block: "center" });
      first?.focus({ preventScroll: true });
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const done = await reviewImportRun(apiClient, workspaceId, { ...form, url: form.url.trim() });
      setResult(done);
      if (done.imported > 0) {
        toast.success(fmt(t.done, { imported: done.imported, duplicates: done.duplicates, filtered: done.filteredOut, found: done.found }));
        onImported();
      }
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const unavailable = Boolean(importer.data && !importer.data.available);
  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={t.title}
      description={t.description}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {result ? t.close : t.cancel}
          </Button>
          <Button type="submit" form={FORM_ID} className="rounded-full px-5" disabled={busy || unavailable}>
            {busy ? t.running : t.run}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} noValidate className="space-y-4" onSubmit={(event) => void run(event)}>
        {unavailable && <Alert>{t.unavailable}</Alert>}
        {importer.data?.sandbox && <Alert>{t.sandbox}</Alert>}
        {formError && <Alert variant="danger">{formError}</Alert>}
        {result && (
          <Alert variant={result.imported > 0 ? "success" : "info"}>
            {fmt(t.done, { imported: result.imported, duplicates: result.duplicates, filtered: result.filteredOut, found: result.found })}
          </Alert>
        )}

        <Field label={t.product} required error={errors.product}>
          {({ id, ...aria }) => (
            <Select
              ref={productField}
              id={id}
              {...aria}
              value={form.productId}
              disabled={busy || products.loading}
              onChange={(event) => {
                set({ productId: event.target.value });
                if (errors.product) setErrors((prev) => ({ ...prev, product: undefined }));
              }}
            >
              <option value="">{t.chooseProduct}</option>
              {(products.data?.products ?? []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={t.url} required hint={t.urlHint} error={errors.url}>
          {({ id, ...aria }) => (
            <Input
              ref={urlField}
              id={id}
              {...aria}
              type="url"
              inputMode="url"
              dir="ltr"
              maxLength={1000}
              placeholder="https://"
              value={form.url}
              disabled={busy}
              onChange={(event) => {
                set({ url: event.target.value });
                if (errors.url) setErrors((prev) => ({ ...prev, url: undefined }));
              }}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.minRating}>
            {({ id, ...aria }) => (
              <Select id={id} {...aria} value={String(form.minRating)} disabled={busy} onChange={(event) => set({ minRating: Number(event.target.value) })}>
                <option value="1">{t.anyRating}</option>
                {[2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {fmt(t.stars, { n })}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.language}>
            {({ id, ...aria }) => (
              <Select
                id={id}
                {...aria}
                value={form.language}
                disabled={busy}
                onChange={(event) => set({ language: event.target.value as ReviewImportRequest["language"] })}
              >
                <option value="any">{t.anyLanguage}</option>
                <option value="ar">{t.arabic}</option>
                <option value="en">{t.english}</option>
                <option value="fr">{t.french}</option>
              </Select>
            )}
          </Field>
        </div>

        <div>
          <label className={CHECK_ROW}>
            <input type="checkbox" className={CHECK_BOX} checked={Boolean(form.photosOnly)} disabled={busy} onChange={(event) => set({ photosOnly: event.target.checked })} />
            {t.photosOnly}
          </label>
          <label className={CHECK_ROW}>
            <input
              type="checkbox"
              role="switch"
              className={CHECK_BOX}
              checked={form.status === "approved"}
              disabled={busy}
              onChange={(event) => set({ status: event.target.checked ? "approved" : "pending" })}
            />
            {t.publish}
          </label>
          <p className="text-xs leading-5 text-ink-soft">{t.publishHint}</p>
        </div>
      </form>
    </Modal>
  );
}
