import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  digitalAddCodes,
  digitalDeleteCode,
  digitalListCodes,
  digitalListFiles,
  digitalListProducts,
  digitalSaveDelivery,
  type DigitalDeliveryType,
  type DigitalFile,
  type DigitalProduct,
  type LicenseCode,
} from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Field, TextField } from "@/components/Field";
import { IconDelete, IconDigital, IconPlus, IconProducts, IconSearch, IconSliders } from "@/components/icons";
import { ChipRow, ListRowCard, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { Modal } from "@/components/Modal";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useViewNavigate } from "@/lib/viewTransition";
import { fold, matches } from "@/pages/quotes/kit/Facts";
import { SwitchRow } from "@/pages/quotes/kit/Switch";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction } from "@/pages/returns/rowkit/RowBits";
import { useIsCompact } from "@/pages/returns/rowkit/useScreen";
import { CodeAlerts, OpenProductFromLink } from "./CodeAlerts";
import { DIGITAL_STRINGS, LOW_CODES, TYPE_ICON, sizeText } from "./digitalText";

type DeliveryFilter = "all" | "not_set" | "paused" | "low";

const DELIVERY_COLUMNS = "grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_max-content_max-content]";

const isLow = (p: DigitalProduct) => p.delivery?.type === "license_codes" && p.codes.available <= LOW_CODES;

/**
 * What each digital product delivers. The list is read whole, so the chips
 * say how many products still need setting up, are paused, or are running out
 * of codes; search narrows as it is typed. A row opens the delivery sheet —
 * where a product's codes are, too. `?product=<id>` opens that product's
 * sheet (the code alert's link, handoff 213).
 */
export function DeliveriesView() {
  const t = useT(DIGITAL_STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const compact = useIsCompact();
  const list = useCachedAsync<DigitalProduct[]>(`digital:${workspaceId}:products`, () => digitalListProducts(apiClient, workspaceId), [workspaceId]);
  const products = useMemo(() => list.data ?? [], [list.data]);
  const [filter, setFilter] = useState<DeliveryFilter>("all");
  const [search, setSearch] = useState("");
  // The product in the sheet stays here while the sheet closes, so it does not empty on its way out.
  const [editing, setEditing] = useState<{ product: DigitalProduct; open: boolean } | null>(null);
  const openProduct = (product: DigitalProduct) => setEditing({ product, open: true });

  const query = fold(search.trim());
  const inFilter = (p: DigitalProduct) =>
    filter === "all" || (filter === "not_set" ? !p.delivery : filter === "paused" ? Boolean(p.delivery && !p.delivery.isActive) : isLow(p));
  const visible = useMemo(
    () => products.filter((p) => inFilter(p) && matches(query, [p.name, p.productCode])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, filter, query]
  );
  const known = list.data !== null;
  const chips: ChipItem<DeliveryFilter>[] = [
    { value: "all", label: t.all, count: known ? products.length : null },
    { value: "not_set", label: t.chipNotSet, count: known ? products.filter((p) => !p.delivery).length : null, tone: "attention" },
    { value: "low", label: t.chipLow, count: known ? products.filter(isLow).length : null, tone: "danger" },
    { value: "paused", label: t.chipPaused, count: known ? products.filter((p) => p.delivery && !p.delivery.isActive).length : null },
  ];

  const pill = "min-h-11 rounded-full px-5";

  const rows = visible.map((product) => {
    const delivery = product.delivery;
    const open = () => openProduct(product);
    const openLabel = fmt(t.editName, { name: product.name });
    const menu: ContextMenuItem[] = [
      { id: "edit", label: delivery ? t.edit : t.setUp, icon: IconSliders, onSelect: open },
      { id: "product", label: t.openProduct, icon: IconProducts, onSelect: () => navigate(`/catalog/${product.id}`) },
    ];
    const TypeIcon = delivery ? TYPE_ICON[delivery.type] : null;
    const kind = delivery ? (
      <span className="inline-flex min-w-0 items-center gap-1.5 text-ink">
        {TypeIcon && <TypeIcon className="size-4 shrink-0 text-ink-soft" aria-hidden />}
        <span className="shrink-0">{t[`type_${delivery.type}`]}</span>
        {delivery.file && <bdi className="min-w-0 truncate text-xs text-ink-soft">{delivery.file.name}</bdi>}
      </span>
    ) : null;
    const state = !delivery ? (
      <StatusBadge value="not_set" tone="warning" text={t.notSet} />
    ) : !delivery.isActive ? (
      <StatusBadge value="paused" tone="neutral" text={t.paused} />
    ) : null;
    const stock =
      delivery?.type === "license_codes" ? (
        <StatusBadge
          value="stock"
          tone={product.codes.available === 0 ? "danger" : product.codes.available <= LOW_CODES ? "warning" : "success"}
          text={fmt(t.stock, { available: product.codes.available, total: product.codes.total })}
        />
      ) : null;
    const action = <RowAction tone={delivery ? "quiet" : "primary"} label={delivery ? t.edit : t.setUp} onClick={open} />;

    if (compact) {
      return (
        <li key={product.id}>
          <ContextMenu items={menu} label={t.menuLabel}>
            <ListRowCard
              leading={
                product.imageUrl ? (
                  <img src={product.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center bg-primary-soft text-primary">
                    <IconDigital className="size-5" aria-hidden />
                  </span>
                )
              }
              title={<bdi>{product.name}</bdi>}
              status={state ?? stock ?? undefined}
              meta={delivery ? kind : t.notSetHint}
              action={action}
              footer={state && stock ? stock : undefined}
              onOpen={open}
              openLabel={openLabel}
              aria-haspopup="dialog"
            />
          </ContextMenu>
        </li>
      );
    }
    return (
      <DeskRow key={product.id} onOpen={open} openLabel={openLabel} current={editing?.open === true && editing.product.id === product.id} menu={menu} menuLabel={t.menuLabel}>
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-6 font-medium text-ink">
            <ViewLink to={`/catalog/${product.id}`} className="rounded-sm hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <bdi>{product.name}</bdi>
            </ViewLink>
          </p>
          {product.productCode && (
            <p className="text-xs leading-5 text-ink-soft tabular-nums">
              <bdi dir="ltr">#{product.productCode}</bdi>
            </p>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          {kind}
          {state}
          {!delivery && <span className="text-xs text-ink-soft">{t.notSetHint}</span>}
        </div>
        <div className="flex items-center text-ink-soft">{stock ?? "—"}</div>
        <div className="flex items-center justify-end">{action}</div>
      </DeskRow>
    );
  });

  return (
    <div className="flex flex-col gap-3">
      <DataState
        loading={list.loading}
        error={products.length === 0 ? list.error : null}
        onRetry={() => void list.refresh()}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={5} />}
      >
        {products.length === 0 ? (
          <EmptyState
            icon={<IconDigital aria-hidden />}
            title={t.emptyProductsTitle}
            description={t.emptyProductsDescription}
            action={
              <Button asChild className={pill}>
                <ViewLink to="/catalog/new">
                  <IconPlus className="size-4" weight="bold" aria-hidden />
                  {t.newProduct}
                </ViewLink>
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            <ListToolbar search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }} />
            <ChipRow items={chips} value={filter} onChange={setFilter} label={t.chipsLabel} />
            {visible.length === 0 ? (
              <EmptyState
                icon={<IconSearch aria-hidden />}
                title={t.emptyFiltered}
                action={
                  <Button
                    variant="outline"
                    className={pill}
                    onClick={() => {
                      setSearch("");
                      setFilter("all");
                    }}
                  >
                    {t.clearAll}
                  </Button>
                }
              />
            ) : compact ? (
              <ul aria-label={t.listLabel} className="flex flex-col gap-2.5">
                {rows}
              </ul>
            ) : (
              <DeskList columns={DELIVERY_COLUMNS} label={t.listLabel} head={[{ label: t.colProduct }, { label: t.colDelivery }, { label: t.colStock }, { label: t.edit, end: true }]}>
                {rows}
              </DeskList>
            )}
          </div>
        )}
      </DataState>

      {/* ?product=<id>: the code alert's link opens that product's delivery (handoff 213). */}
      <OpenProductFromLink products={products} onOpen={openProduct} />
      <DeliverySheet
        product={editing?.product ?? null}
        open={Boolean(editing?.open)}
        onClose={() => {
          setEditing((current) => (current ? { ...current, open: false } : current));
          // Codes may have been added or removed in the sheet: the row's stock is read again.
          void list.refresh({ silent: true });
        }}
      />
    </div>
  );
}

function DeliverySheet({ product, open, onClose }: { product: DigitalProduct | null; open: boolean; onClose: () => void }) {
  const t = useT(DIGITAL_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const fileBox = useRef<HTMLDivElement>(null);
  const linkBox = useRef<HTMLDivElement>(null);

  const [type, setType] = useState<DigitalDeliveryType>("file");
  const [fileId, setFileId] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [message, setMessage] = useState("");
  const [maxDownloads, setMaxDownloads] = useState("");
  const [validHours, setValidHours] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [files, setFiles] = useState<DigitalFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<{ file?: string; link?: string }>({});
  const [error, setError] = useState<string | null>(null);

  // The sheet opens on what is saved: a change left behind by Cancel never comes back.
  useEffect(() => {
    if (!product || !open) return;
    const d = product.delivery;
    setType(d?.type ?? "file");
    setFileId(d?.fileId ?? "");
    setLinkUrl(d?.linkUrl ?? "");
    setMessage(d?.message ?? "");
    setMaxDownloads(d?.maxDownloads ? String(d.maxDownloads) : "");
    setValidHours(d?.linkValidHours ? String(d.linkValidHours) : "");
    setIsActive(d?.isActive ?? true);
    setProblems({});
    setError(null);
    let cancelled = false;
    digitalListFiles(apiClient, workspaceId)
      .then((result) => {
        if (!cancelled) setFiles(result.files);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, open, workspaceId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!product || busy) return;
    // What used to keep the button off is now said under the field, and the caret goes to it.
    const next: typeof problems = {};
    if (type === "file" && !fileId) next.file = t.fileRequired;
    if (type === "link" && linkUrl.trim().length === 0) next.link = t.linkRequired;
    setProblems(next);
    setError(null);
    if (next.file || next.link) {
      (next.file ? fileBox.current?.querySelector("select") : linkBox.current?.querySelector("input"))?.focus();
      return;
    }
    setBusy(true);
    const positive = (text: string) => {
      const n = Math.floor(Number(text));
      return text.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
    };
    try {
      await digitalSaveDelivery(apiClient, workspaceId, product.id, {
        type,
        fileId: type === "file" ? fileId || null : null,
        linkUrl: type === "link" ? linkUrl.trim() : null,
        message: message.trim() || null,
        maxDownloads: type === "file" ? positive(maxDownloads) : null,
        linkValidHours: positive(validHours),
        isActive,
      });
      toast.success(t.saved);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open && product !== null}
      onClose={onClose}
      title={product ? fmt(t.deliveryTitle, { name: product.name }) : ""}
      description={t.deliveryDescription}
      className="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy}>
            {busy ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">{t.type}</p>
          <Segmented<DigitalDeliveryType>
            className="w-full"
            label={t.type}
            value={type}
            onChange={(next) => {
              setType(next);
              setProblems({});
            }}
            options={[
              { value: "file", label: t.type_file, icon: TYPE_ICON.file },
              { value: "link", label: t.type_link, icon: TYPE_ICON.link },
              { value: "license_codes", label: t.type_license_codes, icon: TYPE_ICON.license_codes },
            ]}
          />
        </div>

        {type === "file" && (
          <>
            <div ref={fileBox}>
              <Field label={t.file} hint={files.length === 0 ? t.noFiles : undefined} error={problems.file} required>
                {(props) => (
                  <Select
                    {...props}
                    className="h-11"
                    value={fileId}
                    onChange={(e) => {
                      setFileId(e.target.value);
                      setProblems({});
                    }}
                  >
                    <option value="">{t.chooseFile}</option>
                    {files.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.name} ({sizeText(t, file.sizeBytes)})
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <TextField label={t.maxDownloads} hint={t.maxDownloadsHint} type="number" inputMode="numeric" min={1} max={1000} value={maxDownloads} onChange={(e) => setMaxDownloads(e.target.value)} />
          </>
        )}
        {type === "link" && (
          <div ref={linkBox}>
            <TextField
              label={t.linkUrl}
              hint={t.linkHint}
              required
              type="url"
              inputMode="url"
              dir="ltr"
              maxLength={1000}
              value={linkUrl}
              error={problems.link}
              onChange={(e) => {
                setLinkUrl(e.target.value);
                setProblems({});
              }}
            />
          </div>
        )}

        <TextField label={t.validHours} hint={t.validHoursHint} type="number" inputMode="numeric" min={1} value={validHours} onChange={(e) => setValidHours(e.target.value)} />
        <Field label={t.message} hint={t.messageHint}>
          {(props) => <Textarea {...props} dir="auto" rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />}
        </Field>
        <SwitchRow label={t.active} hint={t.activeHint} checked={isActive} onChange={setIsActive} />
        {error && <Alert variant="danger">{error}</Alert>}
      </form>

      {product && type === "license_codes" && <CodesSection productId={product.id} />}
    </Modal>
  );
}

function CodesSection({ productId }: { productId: string }) {
  const t = useT(DIGITAL_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => digitalListCodes(apiClient, workspaceId, productId), [workspaceId, productId]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    try {
      const result = await digitalAddCodes(apiClient, workspaceId, productId, text);
      toast.success(fmt(t.codesAdded, { added: result.added, duplicates: result.duplicates }));
      setText("");
      void list.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(code: LicenseCode) {
    try {
      await digitalDeleteCode(apiClient, workspaceId, code.id);
      void list.refresh({ silent: true });
      // The code itself is all it takes to put it back.
      toast.undo(t.codeRemoved, async () => {
        await digitalAddCodes(apiClient, workspaceId, productId, code.code);
        void list.refresh({ silent: true });
      });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const codes = list.data?.codes ?? [];
  return (
    <div className="mt-6 border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{t.codesTitle}</h3>
        {list.data && <span className="text-xs text-ink-soft tabular-nums">{fmt(t.stock, { available: list.data.available, total: list.data.total })}</span>}
      </div>
      {/* Orders waiting for codes, and when to warn that codes run low (handoff 213). */}
      <CodeAlerts productId={productId} available={list.data?.available} />
      <form onSubmit={add} className="mt-3 space-y-2">
        <Field label={t.addCodes} hint={t.codesHint}>
          {(props) => <Textarea {...props} rows={3} dir="ltr" value={text} onChange={(e) => setText(e.target.value)} placeholder={"XXXX-1111\nXXXX-2222"} />}
        </Field>
        <Button type="submit" variant="outline" className="h-11 rounded-full px-5" disabled={busy || !text.trim()}>
          {busy ? t.adding : t.addCodes}
        </Button>
      </form>
      <ul data-slot="kinds-well" className="mt-3 max-h-56 divide-y divide-line overflow-y-auto rounded-2xl bg-paper-sunken">
        {codes.length === 0 && <li className="px-3.5 py-3 text-sm text-ink-soft">{t.noCodes}</li>}
        {codes.map((code) => (
          <li key={code.id} className="flex min-h-11 items-center justify-between gap-3 py-1 ps-3.5 pe-1 text-sm">
            <code dir="ltr" className="min-w-0 break-all text-ink">
              {code.code}
            </code>
            {code.assignedAt ? (
              <span className="shrink-0 pe-2.5 text-xs text-ink-soft">{fmt(t.codeGiven, { date: formatDate(code.assignedAt) })}</span>
            ) : (
              <span className="flex shrink-0 items-center gap-1">
                <span className="text-xs font-medium text-success">{t.codeFree}</span>
                <button
                  type="button"
                  aria-label={fmt(t.removeCode, { code: code.code })}
                  title={fmt(t.removeCode, { code: code.code })}
                  onClick={() => void remove(code)}
                  className="flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] pointer-fine:size-9 motion-reduce:transition-none"
                >
                  <IconDelete className="size-4" aria-hidden />
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
