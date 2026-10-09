import { useState } from "react";
import { IconDownload, IconPackageOpen } from "@/components/icons";
import { Alert, Button } from "@store-builder/ui";
import {
  GTM_ADS_ID,
  GTM_ADS_LABEL,
  GTM_CONTAINER_FILENAME,
  GTM_GA4_ID,
  googleAdsLabelsOf,
  trackingPixelsGtmContainerFile,
  trackingPixelsGtmEvents,
  type GtmDataLayerEvent,
  type GtmDataLayerField,
  type TrackingPixelDto,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { AccordionSection } from "@/components/Accordion";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
// Handoff 303: the store's own Google tags are left out of the file, and said so.
import { GtmSkippedNote, useGtmOwnTagSource } from "./GtmSkippedNote";

const STRINGS = {
  en: {
    title: "Ready-made container",
    description: "One file sets up Google Tag Manager to listen to every event your store sends — no triggers to build by hand.",
    download: "Download container",
    downloading: "Downloading…",
    downloaded: "Container downloaded. Import it in Google Tag Manager.",
    step1: "Download the container file.",
    step2: "In Google Tag Manager: Admin → Import container → choose the file → Merge.",
    step3: "Check it in Preview, then Submit to publish it.",
    idsTitle: "Google tags in the container",
    fromPixels: "From your pixels",
    ga4: "GA4 measurement id",
    ga4Hint: "Optional — your store has no GA4 pixel. Leave it empty to keep GA4 out of the container.",
    ga4Invalid: "Use the GA4 id, like G-ABC123XYZ.",
    ads: "Google Ads id",
    adsHint: "Optional — your store has no Google Ads pixel. Leave it empty to keep Google Ads out of the container.",
    adsInvalid: "Use the Google Ads id, like AW-123456789.",
    purchaseLabel: "Purchase conversion label",
    leadLabel: "Lead conversion label",
    noLabel: "no label",
    labelInvalid: "Use 4 to 60 letters, digits, - or _.",
    labelNeedsAds: "A conversion label needs a Google Ads id (AW-…)",
    othersStay: "Meta, TikTok and Snapchat stay in Zimos so nothing is counted twice.",
    eventsTitle: "Events sent to the dataLayer",
    colEvent: "Event",
    colWhen: "When",
    noEvents: "No events listed.",
    fieldsTitle: "Data with each event",
    colField: "Field",
    colType: "Type",
    colNote: "What it holds",
    when_view_item: "A product page or a funnel product step opens",
    when_add_to_cart: "A product is added to the cart",
    when_begin_checkout: "The checkout form opens",
    when_add_payment_info: "A payment method is chosen",
    when_purchase: "The order is placed (with “When the order is placed” timing), unless orders are reported as Lead",
    when_generate_lead: "An opt-in form is sent, or the order is placed when the store or funnel reports orders as Lead",
    "note_ecommerce.value": "The amount in the currency's main unit (e.g. 450.5)",
    "note_ecommerce.currency": "The currency code (ISO 4217), e.g. EGP",
    "note_ecommerce.transaction_id": "The order id, on purchase and generate_lead after an order",
    "note_ecommerce.items": "[{ item_id }] — the SKU or product id",
    note_event_id: "The same id the server-side events use, so nothing is counted twice",
  },
  ar: {
    title: "كونتينر جاهز",
    description: "ملف واحد بيجهّز Google Tag Manager يسمع كل الأحداث اللي متجرك بيبعتها — من غير ما تعمل تريجرز بإيدك.",
    download: "نزّل الكونتينر",
    downloading: "بينزّل…",
    downloaded: "الكونتينر نزل. استورده في Google Tag Manager.",
    step1: "نزّل ملف الكونتينر.",
    step2: "في Google Tag Manager: الإدارة ← استيراد كونتينر ← اختار الملف ← دمج.",
    step3: "جرّبه من Preview وبعدين اضغط Submit علشان يتنشر.",
    idsTitle: "تاجات جوجل اللي في الكونتينر",
    fromPixels: "من البيكسلات بتاعتك",
    ga4: "رقم قياس GA4",
    ga4Hint: "اختياري — متجرك مفيهوش بيكسل GA4. سيبه فاضي لو مش عايز GA4 في الكونتينر.",
    ga4Invalid: "اكتب رقم GA4 بالشكل ده: G-ABC123XYZ.",
    ads: "رقم إعلانات جوجل",
    adsHint: "اختياري — متجرك مفيهوش بيكسل Google Ads. سيبه فاضي لو مش عايز Google Ads في الكونتينر.",
    adsInvalid: "اكتب رقم إعلانات جوجل بالشكل ده: AW-123456789.",
    purchaseLabel: "ليبل تحويل الشراء",
    leadLabel: "ليبل تحويل العميل المحتمل",
    noLabel: "من غير ليبل",
    labelInvalid: "اكتب من 4 لـ 60 حرف إنجليزي أو رقم، ومسموح بالشرطة (-) والشرطة السفلية (_).",
    labelNeedsAds: "الليبل محتاج رقم إعلانات جوجل (AW-…)",
    othersStay: "فيسبوك وتيك توك وسناب بيفضلوا في زيموس علشان مفيش حاجة تتحسب مرتين.",
    eventsTitle: "الأحداث اللي بتتبعت للـ dataLayer",
    colEvent: "الحدث",
    colWhen: "إمتى",
    noEvents: "مفيش أحداث.",
    fieldsTitle: "البيانات اللي مع كل حدث",
    colField: "الخانة",
    colType: "النوع",
    colNote: "فيها إيه",
    when_view_item: "لما صفحة منتج أو خطوة منتج في مسار بيع تفتح",
    when_add_to_cart: "لما منتج يتضاف للسلة",
    when_begin_checkout: "لما فورم الأوردر يفتح",
    when_add_payment_info: "لما طريقة دفع تتختار",
    when_purchase: "لما الأوردر يتعمل (لو توقيت الشرا «أول ما الأوردر يتعمل»)، إلا لو الأوردرات بتتسجّل كـ Lead",
    when_generate_lead: "لما فورم اشتراك يتبعت، أو لما الأوردر يتعمل والمتجر أو مسار البيع بيسجّل الأوردرات كـ Lead",
    "note_ecommerce.value": "المبلغ بالعملة نفسها مش بالقروش (مثلاً 450.5)",
    "note_ecommerce.currency": "كود العملة (ISO 4217)، مثلاً EGP",
    "note_ecommerce.transaction_id": "رقم الأوردر، في purchase و generate_lead بعد الأوردر",
    "note_ecommerce.items": "الـ SKU أو رقم المنتج لكل منتج (item_id)",
    note_event_id: "نفس الرقم اللي أحداث السيرفر بتستخدمه، علشان مفيش حاجة تتحسب مرتين",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

/** A localized line for a known key, the server's own words otherwise. */
function lookup(t: T, key: string, fallback: string): string {
  return (t as Record<string, string>)[key] ?? fallback;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Marketing → Tracking tools, shown once the store has a Google Tag Manager
 * pixel (handoff 170): the ready-made container to import, how to import it,
 * which Google tags it holds, and the dataLayer events it listens to.
 *
 * The container uses the store's own Google pixels (the first active G- tag,
 * the first active AW- tag with its labels); for one the store lacks, the
 * merchant may type the id here and it goes along as a query value.
 */
export function GtmContainerCard({ pixels }: { pixels: TrackingPixelDto[] }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const reference = useAsync(() => trackingPixelsGtmEvents(apiClient, workspaceId), [workspaceId]);
  const [busy, setBusy] = useState(false);
  const [ids, setIds] = useState({ ga4: "", ads: "", purchaseLabel: "", leadLabel: "" });
  const setId = (key: keyof typeof ids, value: string) => setIds((prev) => ({ ...prev, [key]: value }));

  // The same picks the backend makes (gtmContainer.js storeGoogleIds): active pixels, oldest first.
  const google = pixels.filter((p) => p.platform === "google" && p.isActive);
  const ownGa4 = google.find((p) => /^G-/i.test(p.pixelId)) ?? null;
  const ownAds = google.find((p) => /^AW-/i.test(p.pixelId)) ?? null;
  const ownLabels = googleAdsLabelsOf(ownAds);
  // The ids the file leaves out: what the last download's header named, or — before one — the store's own tags.
  const ownTagSource = useGtmOwnTagSource();
  const [skippedByServer, setSkippedByServer] = useState<string[] | null>(null);
  const skippedIds = skippedByServer ?? [ownGa4?.pixelId, ownAds?.pixelId].filter((id): id is string => Boolean(id));

  const ga4 = ids.ga4.trim();
  const ads = ids.ads.trim();
  const purchaseLabel = ids.purchaseLabel.trim();
  const leadLabel = ids.leadLabel.trim();
  const ga4Error = !ownGa4 && ga4 !== "" && !GTM_GA4_ID.test(ga4) ? t.ga4Invalid : undefined;
  const adsError = ownAds
    ? undefined
    : ads !== "" && !GTM_ADS_ID.test(ads)
      ? t.adsInvalid
      : ads === "" && (purchaseLabel !== "" || leadLabel !== "")
        ? t.labelNeedsAds
        : undefined;
  const labelError = (value: string) => (!ownAds && value !== "" && !GTM_ADS_LABEL.test(value) ? t.labelInvalid : undefined);
  const purchaseLabelError = labelError(purchaseLabel);
  const leadLabelError = labelError(leadLabel);
  const invalid = Boolean(ga4Error || adsError || purchaseLabelError || leadLabelError);

  async function download() {
    if (invalid) return;
    setBusy(true);
    try {
      const { blob, skipped } = await trackingPixelsGtmContainerFile(apiClient, workspaceId, {
        ...(ownGa4 ? {} : { ga4 }),
        ...(ownAds ? {} : { ads, purchaseLabel, leadLabel }),
      });
      setSkippedByServer(skipped);
      saveBlob(blob, GTM_CONTAINER_FILENAME);
      toast.success(t.downloaded);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const eventColumns: Column<GtmDataLayerEvent>[] = [
    {
      key: "event",
      header: t.colEvent,
      cell: (e) => (
        <code dir="ltr" className="font-mono text-xs font-medium text-ink">
          {e.event}
        </code>
      ),
    },
    { key: "when", header: t.colWhen, cell: (e) => <span className="text-ink-soft">{lookup(t, `when_${e.event}`, e.when)}</span> },
  ];
  const fieldColumns: Column<GtmDataLayerField>[] = [
    {
      key: "name",
      header: t.colField,
      cell: (f) => (
        <code dir="ltr" className="font-mono text-xs font-medium text-ink">
          {f.name}
        </code>
      ),
    },
    {
      key: "type",
      header: t.colType,
      cell: (f) => (
        <code dir="ltr" className="font-mono text-xs text-ink-soft">
          {f.type}
        </code>
      ),
    },
    { key: "note", header: t.colNote, cell: (f) => <span className="text-ink-soft">{lookup(t, `note_${f.name}`, f.note)}</span> },
  ];

  const steps = [t.step1, t.step2, t.step3];

  return (
    <AccordionSection title={t.title} summary={t.description} icon={IconPackageOpen} persistKey="marketing:gtm" keepMounted>
      <p className="text-[13px] leading-5 text-ink-soft">{t.description}</p>
      <Button className="mt-3 rounded-full px-5 max-sm:w-full" onClick={() => void download()} disabled={busy || invalid}>
        <IconDownload className="size-4" weight="bold" aria-hidden />
        {busy ? t.downloading : t.download}
      </Button>

      <ol className="mt-4 space-y-2">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-ink">
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold tabular-nums text-primary-dark"
            >
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 border-t border-line pt-4">
        <h3 className="text-sm font-semibold text-ink">{t.idsTitle}</h3>
        <div className="mt-2 space-y-3">
          {ownGa4 ? (
            <OwnTag name="GA4" id={ownGa4.pixelId} source={ownTagSource} />
          ) : (
            <TextField
              label={t.ga4}
              dir="ltr"
              autoComplete="off"
              placeholder="G-ABC123XYZ"
              maxLength={22}
              value={ids.ga4}
              hint={t.ga4Hint}
              error={ga4Error}
              onChange={(e) => setId("ga4", e.target.value.toUpperCase())}
            />
          )}
          {ownAds ? (
            <OwnTag
              name="Google Ads"
              id={ownAds.pixelId}
              source={ownTagSource}
              extra={[
                `${t.purchaseLabel}: ${ownLabels.purchase || t.noLabel}`,
                `${t.leadLabel}: ${ownLabels.lead || t.noLabel}`,
              ]}
            />
          ) : (
            <>
              <TextField
                label={t.ads}
                dir="ltr"
                autoComplete="off"
                placeholder="AW-123456789"
                maxLength={23}
                value={ids.ads}
                hint={t.adsHint}
                error={adsError}
                onChange={(e) => setId("ads", e.target.value.toUpperCase())}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label={t.purchaseLabel}
                  dir="ltr"
                  autoComplete="off"
                  maxLength={60}
                  value={ids.purchaseLabel}
                  error={purchaseLabelError}
                  onChange={(e) => setId("purchaseLabel", e.target.value)}
                />
                <TextField
                  label={t.leadLabel}
                  dir="ltr"
                  autoComplete="off"
                  maxLength={60}
                  value={ids.leadLabel}
                  error={leadLabelError}
                  onChange={(e) => setId("leadLabel", e.target.value)}
                />
              </div>
            </>
          )}
        </div>
        <GtmSkippedNote ids={skippedIds} />
        <Alert className="mt-3">{t.othersStay}</Alert>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <DataState loading={reference.loading} error={reference.error} onRetry={() => void reference.refresh()}>
          <h3 className="text-sm font-semibold text-ink">{t.eventsTitle}</h3>
          <div className="mt-2">
            <DataTable
              columns={eventColumns}
              rows={reference.data?.events ?? []}
              rowKey={(e) => e.event}
              empty={<p className="p-3 text-sm text-ink-soft">{t.noEvents}</p>}
            />
          </div>
          {(reference.data?.fields.length ?? 0) > 0 && (
            <>
              <h3 className="mt-4 text-sm font-semibold text-ink">{t.fieldsTitle}</h3>
              <div className="mt-2">
                <DataTable columns={fieldColumns} rows={reference.data?.fields ?? []} rowKey={(f) => f.name} />
              </div>
            </>
          )}
        </DataState>
      </div>
    </AccordionSection>
  );
}

/** One of the store's own Google tags the container will use. */
function OwnTag({ name, id, source, extra = [] }: { name: string; id: string; source: string; extra?: string[] }) {
  return (
    <div data-slot="sweep-well" className="rounded-2xl bg-paper-sunken px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-sm font-medium text-ink">{name}</span>
        <code dir="ltr" className="font-mono text-xs text-ink">
          {id}
        </code>
        <span className="text-xs text-ink-soft">· {source}</span>
      </div>
      {extra.map((line) => (
        <p key={line} className="mt-1 text-xs text-ink-soft">
          {line}
        </p>
      ))}
    </div>
  );
}
