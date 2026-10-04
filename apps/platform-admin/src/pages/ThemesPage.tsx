import { useState } from "react";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { adminThemeUpdate, adminThemesList, type CatalogTheme } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Panel, Td, Th } from "@/components/Panel";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { SelectField, TextAreaField, TextField } from "@/components/forms";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { formatMinorMoney } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

/**
 * The store theme catalog (SPEC §8.1, themes/themesCatalog.js). A theme is
 * storefront code; each row here describes one — its names, category, kind,
 * preview pictures, order, whether stores may pick it, and its price. Prices
 * are set here, never in code; a paid theme can't be bought until the wallet
 * exists, so stores see it with its price but can't switch to it.
 */
export function ThemesPage() {
  const { can } = useAuth();
  const { data, loading, error, refresh } = useAsync(() => adminThemesList(apiClient), []);
  const [editing, setEditing] = useState<CatalogTheme | null>(null);
  const canManage = can("templates.manage");

  return (
    <div>
      <PageHeader
        title="Themes"
        description="The store themes merchants can pick. A theme's look is code in the storefront; here you name it, sort it, price it and switch it on or off."
      />
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && data.length === 0 ? (
          <EmptyBlock message="No themes yet — the catalog starts with the storefront's own themes once the migrations have run." />
        ) : (
          <Panel title="Catalog">
            <Table>
              <TableHeader>
                <TableRow>
                  <Th>Theme</Th>
                  <Th>Category</Th>
                  <Th>Kind</Th>
                  <Th>Price</Th>
                  <Th>Stores using it</Th>
                  <Th>Status</Th>
                  <Th />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((theme) => (
                  <TableRow key={theme.key}>
                    <Td>
                      <div className="font-medium">{theme.name.en || theme.key}</div>
                      <div className="text-xs text-ink-soft" dir="rtl">
                        {theme.name.ar}
                      </div>
                      <div className="font-mono text-[11px] text-ink-soft">{theme.key}</div>
                    </Td>
                    <Td>{theme.category}</Td>
                    <Td>{theme.kind}</Td>
                    <Td>{theme.price ? formatMinorMoney(theme.price.amount, theme.price.currency) : "Free"}</Td>
                    <Td>{theme.stores ?? 0}</Td>
                    <Td>
                      <StatusBadge tone={theme.isActive ? "success" : "neutral"}>{theme.isActive ? "Offered" : "Hidden"}</StatusBadge>
                    </Td>
                    <Td>
                      {canManage && (
                        <Button size="sm" variant="outline" onClick={() => setEditing(theme)}>
                          Edit
                        </Button>
                      )}
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </DataState>
      {editing && (
        <ThemeEditor
          theme={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh({ silent: true });
          }}
        />
      )}
    </div>
  );
}

function ThemeEditor({ theme, onClose, onSaved }: { theme: CatalogTheme; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    nameEn: theme.name.en ?? "",
    nameAr: theme.name.ar ?? "",
    descriptionEn: theme.description.en ?? "",
    descriptionAr: theme.description.ar ?? "",
    category: theme.category,
    kind: theme.kind,
    tags: theme.tags.join(", "),
    previewImages: theme.previewImages.join("\n"),
    position: String(theme.position),
    isActive: theme.isActive,
    price: theme.price ? String(theme.price.amount / 100) : "",
    currency: theme.price?.currency ?? "EGP",
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));
  const original = theme.key === "original";

  async function save() {
    const amount = form.price.trim() === "" ? null : Math.round(Number(form.price) * 100);
    if (amount !== null && (!Number.isFinite(amount) || amount < 1)) return toast.error("The price is a positive amount, or empty for free.");
    setBusy(true);
    try {
      await adminThemeUpdate(apiClient, theme.key, {
        name: { en: form.nameEn.trim(), ar: form.nameAr.trim() },
        description: { en: form.descriptionEn.trim(), ar: form.descriptionAr.trim() },
        category: form.category.trim().toLowerCase(),
        kind: form.kind,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        previewImages: form.previewImages.split("\n").map((u) => u.trim()).filter(Boolean),
        position: Number.parseInt(form.position, 10) || 0,
        ...(original ? {} : { isActive: form.isActive, price: amount === null ? null : { amount, currency: form.currency.trim().toUpperCase() } }),
      });
      toast.success("Theme saved.");
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={`Edit ${theme.name.en || theme.key}`}
      description={original ? "The original look is every store's fallback: it stays free and offered." : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Name (English)" value={form.nameEn} maxLength={80} onChange={(e) => set({ nameEn: e.target.value })} />
        <TextField label="Name (Arabic)" dir="rtl" value={form.nameAr} maxLength={80} onChange={(e) => set({ nameAr: e.target.value })} />
        <TextAreaField label="Description (English)" rows={2} value={form.descriptionEn} maxLength={300} onChange={(e) => set({ descriptionEn: e.target.value })} />
        <TextAreaField label="Description (Arabic)" dir="rtl" rows={2} value={form.descriptionAr} maxLength={300} onChange={(e) => set({ descriptionAr: e.target.value })} />
        <TextField label="Category" hint="e.g. fashion, kids, electronics" value={form.category} onChange={(e) => set({ category: e.target.value })} />
        <SelectField label="Kind" value={form.kind} onChange={(e) => set({ kind: e.target.value as CatalogTheme["kind"] })}>
          <option value="store">Store (many products)</option>
          <option value="landing">Landing (one product)</option>
        </SelectField>
        <TextField label="Tags" hint="Comma-separated" value={form.tags} onChange={(e) => set({ tags: e.target.value })} />
        <TextField label="Order" type="number" min={0} value={form.position} onChange={(e) => set({ position: e.target.value })} />
        <TextAreaField
          label="Preview pictures"
          hint="One https link per line, up to 6 (desktop and mobile)."
          className="sm:col-span-2"
          rows={3}
          value={form.previewImages}
          onChange={(e) => set({ previewImages: e.target.value })}
        />
        {!original && (
          <>
            <TextField label="Price" hint="Empty = free. Paid themes show their price but can't be bought until the wallet exists." inputMode="decimal" value={form.price} onChange={(e) => set({ price: e.target.value })} />
            <TextField label="Currency" maxLength={3} value={form.currency} onChange={(e) => set({ currency: e.target.value })} />
            <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
              Offered to stores (stores already on it keep it)
            </label>
          </>
        )}
      </div>
    </Modal>
  );
}
