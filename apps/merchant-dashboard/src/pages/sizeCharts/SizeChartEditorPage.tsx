import { useId, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconDelete, IconNote, IconPin } from "@/components/icons";
import { Alert } from "@store-builder/ui";
import {
  SIZE_CHART_LIMITS,
  sizeChartCreate,
  sizeChartDelete,
  sizeChartGet,
  sizeChartUpdate,
  type Product,
  type SizeChart,
  type SizeChartPayload,
  type SizeChartUnit,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { getFieldErrors } from "@/lib/errors";
import { pluralOf } from "@/lib/plural";
import { UnsavedGuardProvider, useReportDirty } from "@/lib/useUnsavedGuard";
import { fmt, useT } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Section } from "@/components/Section";
import { AccordionSection } from "@/components/Accordion";
import { Field, TextField } from "@/components/Field";
import { Segmented } from "@/components/Segmented";
import { Textarea } from "@/components/Textarea";
import { SaveBar } from "@/components/SaveBar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { useToast } from "@/components/Toast";
import { ImageUrlInput } from "@/pages/catalog/components/ImageUrlInput";
import { ItemMenu } from "@/pages/catalog/media/ItemMenu";
import { AttachList } from "./AttachList";
import { SizeChartGrid, type GridColumn } from "./SizeChartGrid";
import { SIZE_CHART_STRINGS } from "./sizeChartStrings";

interface Draft {
  name: string;
  unit: SizeChartUnit;
  columns: GridColumn[];
  rows: string[][];
  noteAr: string;
  noteEn: string;
  imageUrl: string;
  productIds: string[];
  collectionIds: string[];
}

/** A new chart starts as the table most clothing stores need; every box can be changed. */
const STARTER: Draft = {
  name: "",
  unit: "cm",
  columns: [
    { ar: "المقاس", en: "Size" },
    { ar: "الصدر", en: "Chest" },
    { ar: "الطول", en: "Length" },
  ],
  rows: [
    ["S", "", ""],
    ["M", "", ""],
    ["L", "", ""],
    ["XL", "", ""],
  ],
  noteAr: "",
  noteEn: "",
  imageUrl: "",
  productIds: [],
  collectionIds: [],
};

function toDraft(chart: SizeChart | null): Draft {
  if (!chart) return STARTER;
  return {
    name: chart.name,
    unit: chart.unit,
    columns: chart.columns.map((c) => ({ ar: c.ar ?? "", en: c.en ?? "" })),
    // A row the API somehow kept short is padded, so the grid stays a rectangle.
    rows: chart.rows.map((row) => chart.columns.map((_, i) => row[i] ?? "")),
    noteAr: chart.note?.ar ?? "",
    noteEn: chart.note?.en ?? "",
    imageUrl: chart.imageUrl ?? "",
    productIds: chart.productIds,
    collectionIds: chart.collectionIds,
  };
}

/** The store's products for the tick list: the newest 600 at most (three pages of the list). */
async function loadProducts(workspaceId: string): Promise<{ products: Product[]; complete: boolean }> {
  const products: Product[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 3; page += 1) {
    const result = await apiClient.listProducts(workspaceId, { limit: 200, cursor });
    products.push(...result.products);
    if (!result.nextCursor) return { products, complete: true };
    cursor = result.nextCursor;
  }
  return { products, complete: false };
}

/**
 * Products → Size charts → one chart (change products.manage):
 * its name and unit and the sizes as a grid, open; the note with the "how to
 * measure" picture and the products and collections it shows on, each one
 * fold under them with a line saying what is inside. Deleting the chart is in
 * the header's «…» menu.
 */
export function SizeChartEditorPage() {
  const t = useT(SIZE_CHART_STRINGS);
  const { chartId } = useParams<{ chartId: string }>();
  const workspaceId = useWorkspaceId();
  const chart = useAsync(
    () => (chartId ? sizeChartGet(apiClient, workspaceId, chartId) : Promise.resolve(null)),
    [workspaceId, chartId]
  );
  const back = { to: "/size-charts", label: t.back };

  if (!chartId) {
    return (
      <div className="max-w-4xl">
        <UnsavedGuardProvider>
          <SizeChartForm chart={null} />
        </UnsavedGuardProvider>
      </div>
    );
  }

  if (!chart.data) {
    return (
      <div className="max-w-4xl">
        <PageHeader title={t.editTitle} back={back} />
        <DataState loading={chart.loading} error={chart.error} onRetry={() => void chart.refresh()}>
          {null}
        </DataState>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <UnsavedGuardProvider>
        <SizeChartForm key={chart.data.id} chart={chart.data} onSaved={(saved) => chart.setData(saved)} />
      </UnsavedGuardProvider>
    </div>
  );
}

type Errors = Partial<Record<"name" | "columns" | "imageUrl", string>>;

function SizeChartForm({ chart, onSaved }: { chart: SizeChart | null; onSaved?: (saved: SizeChart) => void }) {
  const t = useT(SIZE_CHART_STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const imageId = useId();

  const [saved, setSaved] = useState<Draft>(() => toDraft(chart));
  const [draft, setDraft] = useState<Draft>(saved);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  // The note's fold opens by itself when it holds something, and when its picture's link is refused.
  const [noteOpen, setNoteOpen] = useState(() => Boolean(saved.noteAr || saved.noteEn || saved.imageUrl));

  const catalog = useAsync(() => loadProducts(workspaceId), [workspaceId]);
  const collections = useAsync(() => apiClient.listCollections(workspaceId), [workspaceId]);

  const edited = JSON.stringify(draft) !== JSON.stringify(saved);
  // A chart that does not exist yet is unsaved from the start.
  const dirty = !chart || edited;
  // Reload and close ask first, once something was typed (lib/useUnsavedGuard).
  useReportDirty(edited);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key === "name" || key === "imageUrl") setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const name = draft.name.trim();
    const imageUrl = draft.imageUrl.trim();
    const found: Errors = {};
    if (!name) found.name = t.nameRequired;
    if (draft.columns.some((c) => !c.ar.trim() && !c.en.trim())) found.columns = t.headingRequired;
    if (imageUrl && !/^https:\/\/\S+$/i.test(imageUrl)) found.imageUrl = t.imageHttps;
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = (["name", "columns", "imageUrl"] as const).find((k) => found[k]);
      if (first === "imageUrl") setNoteOpen(true);
      // After the fold has opened, when it is the picture's link that is wrong.
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`#${CSS.escape(formId)} [data-field="${first}"]`)?.scrollIntoView({ block: "center" });
        document
          .querySelector<HTMLElement>(`#${CSS.escape(formId)} [data-field="${first}"] [aria-invalid="true"], #${CSS.escape(formId)} [data-field="${first}"] input`)
          ?.focus({ preventScroll: true });
      });
      return;
    }

    // An id the complete list no longer has is a deleted product or collection: the API would refuse the whole chart.
    const knownProducts = catalog.data?.complete ? new Set(catalog.data.products.map((p) => p.id)) : null;
    const knownCollections = collections.data ? new Set(collections.data.map((c) => c.id)) : null;
    const note = { ar: draft.noteAr.trim(), en: draft.noteEn.trim() };
    const payload: SizeChartPayload = {
      name,
      unit: draft.unit,
      columns: draft.columns.map((c) => ({ ar: c.ar.trim(), en: c.en.trim() })),
      rows: draft.rows.map((row) => row.map((cell) => cell.trim())),
      note: note.ar || note.en ? note : null,
      imageUrl: imageUrl || null,
      productIds: knownProducts ? draft.productIds.filter((id) => knownProducts.has(id)) : draft.productIds,
      collectionIds: knownCollections ? draft.collectionIds.filter((id) => knownCollections.has(id)) : draft.collectionIds,
    };

    setSaving(true);
    setFailure(null);
    try {
      if (chart) {
        const result = await sizeChartUpdate(apiClient, workspaceId, chart.id, payload);
        const next = toDraft(result);
        setSaved(next);
        setDraft(next);
        onSaved?.(result);
        toast.success(t.saved);
      } else {
        const result = await sizeChartCreate(apiClient, workspaceId, payload);
        toast.success(t.created);
        navigate(`/size-charts/${result.id}`, { replace: true });
      }
    } catch (err) {
      const fields = getFieldErrors(err);
      if (fields.imageUrl) {
        setErrors((prev) => ({ ...prev, imageUrl: t.imageHttps }));
        setNoteOpen(true);
      }
      setFailure(fields.productIds || fields.collectionIds ? t.attachGone : fields.imageUrl ? null : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setDraft(saved);
    setErrors({});
    setFailure(null);
  }

  const productItems = catalog.data ? catalog.data.products.map((p) => ({ id: p.id, name: p.name })) : null;
  const collectionItems = collections.data ? collections.data.map((c) => ({ id: c.id, name: c.name })) : null;

  const hasNote = Boolean(draft.noteAr.trim() || draft.noteEn.trim());
  const hasImage = Boolean(draft.imageUrl.trim());
  const noteSummary = hasNote && hasImage ? t.noteBoth : hasNote ? t.noteOnly : hasImage ? t.imageOnly : t.noteNone;
  const attachParts = [
    draft.collectionIds.length > 0 ? pluralOf(t, "collections", draft.collectionIds.length) : null,
    draft.productIds.length > 0 ? pluralOf(t, "products", draft.productIds.length) : null,
  ].filter(Boolean);
  const attachSummary = attachParts.length > 0 ? attachParts.join(" · ") : t.notAttached;

  const headerMenu: ContextMenuItem[] = chart
    ? [{ id: "delete", label: t.remove, icon: IconDelete, destructive: true, disabled: saving, onSelect: () => setRemoving(true) }]
    : [];

  return (
    <>
      <PageHeader
        title={chart ? draft.name.trim() || chart.name : t.newTitle}
        back={{ to: "/size-charts", label: t.back }}
        actions={chart ? <ItemMenu items={headerMenu} label={t.more} /> : undefined}
      />

      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <Section title={t.basicsTitle}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div data-field="name">
              <TextField
                label={t.name}
                hint={t.nameHint}
                required
                autoComplete="off"
                maxLength={SIZE_CHART_LIMITS.name}
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                error={errors.name}
                className="[&_input]:h-11"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-ink">{t.unit}</p>
              <Segmented
                label={t.unit}
                value={draft.unit}
                onChange={(unit) => set("unit", unit)}
                options={[
                  { value: "cm", label: `${t.unitLong_cm} (cm)` },
                  { value: "inch", label: `${t.unitLong_inch} (inch)` },
                ]}
                className="max-sm:w-full"
              />
              <p className="text-xs text-ink-soft">{t.unitHint}</p>
            </div>
          </div>
        </Section>

        <Section title={t.tableTitle} description={t.tableHint}>
          <div data-field="columns">
            <SizeChartGrid
              columns={draft.columns}
              rows={draft.rows}
              headingError={errors.columns}
              disabled={saving}
              onChange={({ columns, rows }) => {
                setDraft((d) => ({ ...d, columns, rows }));
                if (errors.columns && columns.every((c) => c.ar.trim() || c.en.trim())) setErrors((prev) => ({ ...prev, columns: undefined }));
              }}
            />
          </div>
        </Section>

        <AccordionSection
          title={t.attachTitle}
          icon={IconPin}
          summary={attachSummary}
          // A new chart shows nowhere until it is attached: the fold starts open.
          defaultOpen={!chart}
          keepMounted
        >
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">{t.attachHint}</p>
            <div className="grid gap-6 md:grid-cols-2">
              <AttachList
                title={t.collections}
                items={collectionItems}
                selected={draft.collectionIds}
                onChange={(ids) => set("collectionIds", ids)}
                max={SIZE_CHART_LIMITS.collections}
                loading={collections.loading}
                error={collections.error}
                searchLabel={t.searchCollections}
                emptyText={t.noCollections}
                disabled={saving}
              />
              <AttachList
                title={t.products}
                items={productItems}
                selected={draft.productIds}
                onChange={(ids) => set("productIds", ids)}
                max={SIZE_CHART_LIMITS.products}
                loading={catalog.loading}
                error={catalog.error}
                searchLabel={t.searchProducts}
                emptyText={t.noProducts}
                note={catalog.data && !catalog.data.complete ? fmt(t.listPartial, { count: catalog.data.products.length }) : null}
                disabled={saving}
              />
            </div>
          </div>
        </AccordionSection>

        <AccordionSection title={t.noteTitle} icon={IconNote} summary={noteSummary} open={noteOpen} onOpenChange={setNoteOpen} keepMounted>
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">{t.noteHint}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.noteAr}>
                {(props) => (
                  <Textarea
                    {...props}
                    rows={2}
                    dir="rtl"
                    lang="ar"
                    maxLength={SIZE_CHART_LIMITS.note}
                    value={draft.noteAr}
                    onChange={(e) => set("noteAr", e.target.value)}
                  />
                )}
              </Field>
              <Field label={t.noteEn}>
                {(props) => (
                  <Textarea
                    {...props}
                    rows={2}
                    dir="ltr"
                    lang="en"
                    maxLength={SIZE_CHART_LIMITS.note}
                    value={draft.noteEn}
                    onChange={(e) => set("noteEn", e.target.value)}
                  />
                )}
              </Field>
            </div>
            <div data-field="imageUrl" className="space-y-1.5">
              <label htmlFor={imageId} className="block text-sm font-medium text-ink">
                {t.image}
              </label>
              <ImageUrlInput id={imageId} value={draft.imageUrl} disabled={saving} onChange={(url) => set("imageUrl", url)} />
              <p role={errors.imageUrl ? "alert" : undefined} className={errors.imageUrl ? "text-xs font-medium text-danger" : "text-xs text-ink-soft"}>
                {errors.imageUrl ?? t.imageHint}
              </p>
            </div>
          </div>
        </AccordionSection>

        {failure && <Alert variant="danger">{failure}</Alert>}

        <SaveBar
          dirty={dirty}
          saving={saving}
          message={chart ? undefined : t.unsavedNew}
          saveLabel={chart ? t.save : t.create}
          savingLabel={t.saving}
          onDiscard={chart ? discard : undefined}
        />
      </form>

      {chart && (
        <ConfirmDialog
          open={removing}
          title={fmt(t.removeTitle, { name: chart.name })}
          description={t.removeBody}
          confirmLabel={t.remove}
          cancelLabel={t.cancel}
          busyLabel={t.removing}
          destructive
          onCancel={() => setRemoving(false)}
          onConfirm={async () => {
            try {
              await sizeChartDelete(apiClient, workspaceId, chart.id);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
            toast.success(t.removed);
            navigate("/size-charts", { replace: true });
          }}
        />
      )}
    </>
  );
}
