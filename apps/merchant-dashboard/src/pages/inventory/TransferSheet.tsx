import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  apiErrorDetails,
  isApiErrorCode,
  stockLocationStock,
  stockTransferCreate,
  type LocationStockVariant,
  type StockLocation,
  type StockTransferShortage,
} from "@store-builder/api-client";
import { Field } from "@/components/Field";
import { IconDelete, IconSwap } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { parseWholeNumber } from "@/lib/wholeNumber";
import { INVENTORY_STRINGS } from "./inventoryStrings";
import { variantDetail, variantFullName } from "./inventoryText";
import { VariantCell } from "./InventoryParts";
import { SHEET_ACTION } from "./kit";
import { VariantAddRow, type PickVariant } from "./VariantAddRow";

interface Line {
  variantId: string;
  quantity: string;
  error?: string;
}

/**
 * «نقل مخزون» / Transfer stock (handoff 206), as a sheet over the history:
 * from one location to another, variant lines with quantities — each shows
 * what is free at the source — and a note (POST /stock-locations/transfers).
 * The store's total never changes; at most what is free at the source moves
 * (422 INSUFFICIENT_STOCK names the line and what is free).
 *
 * `preset` picks the two ends when the sheet is opened from somewhere that
 * already knows one of them (a location short of stock asks to be filled).
 */
export function TransferSheet({
  open,
  locations,
  preset,
  onClose,
  onDone,
}: {
  open: boolean;
  locations: StockLocation[];
  preset?: { from?: string | null; to?: string | null };
  onClose: () => void;
  /** The transfer was saved. */
  onDone: () => void;
}) {
  const t = useT(INVENTORY_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Each opening starts clean: from the default location towards the first other one, unless the opener named an end.
  useEffect(() => {
    if (!open) return;
    const known = (id: string | null | undefined) => (id && locations.some((l) => l.id === id) ? id : "");
    const to = known(preset?.to);
    let from = known(preset?.from);
    if (from === to) from = "";
    if (!from) from = (locations.find((l) => l.isDefault && l.id !== to) ?? locations.find((l) => l.id !== to))?.id ?? "";
    setFromId(from);
    setToId(to || (locations.find((l) => l.id !== from && l.isActive)?.id ?? locations.find((l) => l.id !== from)?.id ?? ""));
    setLines([]);
    setNote("");
    setFailure(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The source's stock: what can be picked, and what is free of each.
  const source = useAsync(
    () =>
      open && fromId ? stockLocationStock(apiClient, workspaceId, fromId).then((r) => r.variants) : Promise.resolve([] as LocationStockVariant[]),
    [workspaceId, fromId, open]
  );
  const stockById = useMemo(() => new Map((source.data ?? []).map((v) => [v.variantId, v])), [source.data]);
  const fromName = locations.find((l) => l.id === fromId)?.name ?? "";
  const nameOf = (variantId: string) => {
    const v = stockById.get(variantId);
    return v ? variantFullName(v.productName ?? t.unknownProduct, variantDetail(v.optionValues, v.sku)) : t.unknownProduct;
  };

  const taken = useMemo(() => new Set(lines.map((l) => l.variantId)), [lines]);
  const options: PickVariant[] = useMemo(
    () =>
      (source.data ?? []).map((v) => ({
        variantId: v.variantId,
        productId: v.productId,
        productName: v.productName ?? t.unknownProduct,
        detail: variantDetail(v.optionValues, v.sku),
        note: fmt(t.availableNote, { n: Math.max(0, v.available) }),
        disabled: v.available <= 0,
      })),
    [source.data, t]
  );

  function setLine(variantId: string, change: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, ...change } : l)));
  }

  /** Puts the cursor where the form says something is wrong: a line's quantity, or the picker. */
  function focusIn(selector: string) {
    window.requestAnimationFrame(() => {
      document.getElementById(formId)?.querySelector<HTMLElement>(selector)?.focus();
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFailure(null);
    if (!fromId || !toId || fromId === toId) {
      setFailure(t.sameLocation);
      focusIn('[data-field="to"] select');
      return;
    }
    if (lines.length === 0) {
      setFailure(t.noLines);
      focusIn('[data-field="picker"] select');
      return;
    }
    // Each line: a whole number from 1 to what is free at the source.
    const quantities = new Map<string, number>();
    const checked = lines.map((line) => {
      const free = Math.max(0, stockById.get(line.variantId)?.available ?? 0);
      const quantity = parseWholeNumber(line.quantity, 1, Math.max(1, free));
      if (free < 1) return { ...line, error: t.lineNothingFree };
      if (quantity === null || Number.isNaN(quantity)) return { ...line, error: fmt(t.lineQuantityError, { n: free }) };
      quantities.set(line.variantId, quantity);
      return { ...line, error: undefined };
    });
    setLines(checked);
    if (quantities.size !== lines.length) {
      focusIn('[data-line] input[aria-invalid="true"]');
      return;
    }

    setSaving(true);
    try {
      await stockTransferCreate(apiClient, workspaceId, {
        fromLocationId: fromId,
        toLocationId: toId,
        lines: lines.map((line) => ({ variantId: line.variantId, quantity: quantities.get(line.variantId) ?? 0 })),
        note: note.trim() || null,
      });
      onDone();
    } catch (err) {
      if (isApiErrorCode(err, "INSUFFICIENT_STOCK")) {
        // Someone sold or moved units meanwhile: the answer names the line and what is free now.
        const shortage = apiErrorDetails<StockTransferShortage[]>(err)?.[0];
        const free = Math.max(0, shortage?.available ?? 0);
        if (shortage?.variantId) setLine(shortage.variantId, { error: free < 1 ? t.lineNothingFree : fmt(t.lineQuantityError, { n: free }) });
        setFailure(fmt(t.transferShort, { n: free }));
        void source.refresh({ silent: true });
      } else {
        setFailure(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={t.transferTitle}
      description={t.transferDescription}
      className="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" className={SHEET_ACTION} disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className={SHEET_ACTION} disabled={saving}>
            <IconSwap className="size-4" weight="bold" aria-hidden />
            {saving ? t.transferring : t.transferSubmit}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.from}>
            {(props) => (
              <Select
                {...props}
                className="h-11"
                value={fromId}
                disabled={saving}
                onChange={(e) => {
                  const next = e.target.value;
                  setFromId(next);
                  // The two ends swap rather than name the same place twice.
                  if (next === toId) setToId(fromId);
                  setFailure(null);
                }}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div data-field="to">
            <Field label={t.to}>
              {(props) => (
                <Select
                  {...props}
                  className="h-11"
                  value={toId}
                  disabled={saving}
                  onChange={(e) => {
                    setToId(e.target.value);
                    setFailure(null);
                  }}
                >
                  <option value="">{t.choose}</option>
                  {locations
                    .filter((l) => l.id !== fromId)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
          </div>
        </div>

        {lines.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-ink-soft">{t.noLines}</p>
        ) : (
          <ul className="zimos-inv-lines divide-y divide-line rounded-2xl ring-1 ring-line">
            {lines.map((line) => {
              const v = stockById.get(line.variantId);
              const name = nameOf(line.variantId);
              return (
                <li key={line.variantId} data-line="" className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1 basis-48">
                    <VariantCell name={v?.productName ?? t.unknownProduct} detail={v ? variantDetail(v.optionValues, v.sku) : undefined} />
                    <p className={line.error ? "text-xs font-medium text-danger" : "text-xs text-ink-soft"}>
                      {line.error ?? fmt(t.availableAt, { name: fromName, n: Math.max(0, v?.available ?? 0) })}
                    </p>
                  </div>
                  <Input
                    inputMode="numeric"
                    dir="ltr"
                    autoComplete="off"
                    maxLength={7}
                    value={line.quantity}
                    disabled={saving}
                    aria-label={fmt(t.transferQuantityFor, { name })}
                    aria-invalid={line.error ? true : undefined}
                    onChange={(e) => setLine(line.variantId, { quantity: e.target.value, error: undefined })}
                    className="h-11 w-24 text-center tabular-nums"
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setLines((prev) => prev.filter((l) => l.variantId !== line.variantId))}
                    aria-label={fmt(t.removeLine, { name })}
                    className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[color,background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none"
                  >
                    <IconDelete className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div data-field="picker">
          <VariantAddRow
            variants={options}
            loading={source.loading}
            failed={Boolean(source.error)}
            taken={taken}
            disabled={saving}
            onAdd={(v) => {
              setLines((prev) => [...prev, { variantId: v.variantId, quantity: "1" }]);
              setFailure(null);
            }}
          />
        </div>

        <Field label={t.note}>
          {(props) => (
            <Input
              {...props}
              dir="auto"
              autoComplete="off"
              maxLength={300}
              placeholder={t.notePlaceholder}
              value={note}
              disabled={saving}
              onChange={(e) => setNote(e.target.value)}
              className="h-11"
            />
          )}
        </Field>

        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
