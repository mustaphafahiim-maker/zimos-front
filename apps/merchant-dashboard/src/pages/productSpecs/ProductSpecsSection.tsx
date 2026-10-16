import { useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  SPEC_LIMITS,
  apiFieldProblems,
  productSpecsGet,
  productSpecsSave,
  specKeysList,
  specKeyValues,
  type SpecKey,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { canManageProducts, canViewProducts } from "@/lib/productAccess";
import { useT } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { ProductPageCard } from "@/pages/catalog/components/ProductPageCard";
import { SPEC_STRINGS, specKeyName } from "./specStrings";

/**
 * The product page's «المواصفات»: one field per specification
 * the store defined, with the values other products already use offered as
 * suggestions while typing. Saving replaces the product's values as a whole —
 * a field left empty has no value and is not shown to shoppers.
 *
 * A store that has not defined any specification sees nothing here; the list
 * is managed on Products → Specifications.
 */
export function ProductSpecsSection({ productId }: { productId: string }) {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const canView = canViewProducts(currentWorkspace?.role);
  const loaded = useAsync(async () => {
    if (!canView) return null;
    try {
      const [keys, values] = await Promise.all([specKeysList(apiClient, workspaceId), productSpecsGet(apiClient, workspaceId, productId)]);
      return { keys, values };
    } catch {
      // An extra on a page that works without it.
      return null;
    }
  }, [workspaceId, productId, canView]);

  if (!loaded.data || loaded.data.keys.length === 0) return null;
  return (
    <SpecsForm
      // A reload (a specification deleted meanwhile) starts the form again from what the server holds.
      key={loaded.data.keys.map((k) => k.id).join(",")}
      productId={productId}
      keys={loaded.data.keys}
      initial={loaded.data.values}
      canManage={canManageProducts(currentWorkspace?.role)}
      onReload={() => loaded.refresh({ silent: true })}
    />
  );
}

function SpecsForm({
  productId,
  keys,
  initial,
  canManage,
  onReload,
}: {
  productId: string;
  keys: SpecKey[];
  initial: Record<string, string>;
  canManage: boolean;
  onReload: () => Promise<void>;
}) {
  const t = useT(SPEC_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const ids = useId();
  const [saved, setSaved] = useState<Record<string, string>>(initial);
  const [draft, setDraft] = useState<Record<string, string>>(initial);
  // The values already used for a specification, read the first time its field is focused.
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const value = (table: Record<string, string>, keyId: string) => (table[keyId] ?? "").trim();
  const dirty = keys.some((k) => value(draft, k.id) !== value(saved, k.id));
  // No guard mounted (any other screen): nothing happens.
  useReportDirty(dirty);

  function suggest(keyId: string) {
    if (suggestions[keyId]) return;
    setSuggestions((prev) => ({ ...prev, [keyId]: [] }));
    specKeyValues(apiClient, workspaceId, keyId)
      .then((values) => setSuggestions((prev) => ({ ...prev, [keyId]: values.map((v) => v.value) })))
      .catch(() => {
        /* no suggestions: the field still takes any value */
      });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !dirty) return;
    setSaving(true);
    setFailure(null);
    try {
      const next = await productSpecsSave(apiClient, workspaceId, productId, Object.fromEntries(keys.map((k) => [k.id, value(draft, k.id)])));
      setSaved(next);
      setDraft(next);
      toast.success(t.valuesSaved);
    } catch (err) {
      // A specification deleted on another screen: read the list again.
      if (apiFieldProblems(err).some((p) => p.field.startsWith("values"))) {
        // Said in a toast: the form itself starts over with the new list.
        toast.error(t.unknownKey);
        await onReload();
      } else {
        setFailure(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProductPageCard title={t.productTitle} description={t.productHint}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {keys.map((k) => {
            const fieldId = `${ids}-${k.id}`;
            const options = suggestions[k.id] ?? [];
            return (
              <div key={k.id} className="space-y-1.5">
                <label htmlFor={fieldId} className="block text-sm font-medium text-ink">
                  <bdi>{specKeyName(k.name)}</bdi>
                  {k.unit && (
                    <span className="ms-1.5 text-xs font-normal text-ink-soft">
                      (<bdi>{k.unit}</bdi>)
                    </span>
                  )}
                </label>
                <Input
                  id={fieldId}
                  dir="auto"
                  autoComplete="off"
                  maxLength={SPEC_LIMITS.value}
                  list={options.length > 0 ? `${fieldId}-values` : undefined}
                  placeholder={t.valuePlaceholder}
                  value={draft[k.id] ?? ""}
                  disabled={saving || !canManage}
                  onFocus={() => suggest(k.id)}
                  onChange={(e) => setDraft((d) => ({ ...d, [k.id]: e.target.value }))}
                  className="h-11"
                />
                {options.length > 0 && (
                  <datalist id={`${fieldId}-values`}>
                    {options.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                )}
              </div>
            );
          })}
        </div>

        {failure && <Alert variant="danger">{failure}</Alert>}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link to="/catalog/specifications" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline md:min-h-0">
            {t.manage}
          </Link>
          {(dirty || saving) && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={saving}
                onClick={() => {
                  setDraft(saved);
                  setFailure(null);
                }}
              >
                {t.cancel}
              </Button>
              <Button type="submit" className="min-h-11" disabled={saving}>
                {saving ? t.saving : t.saveValues}
              </Button>
            </div>
          )}
        </div>
      </form>
    </ProductPageCard>
  );
}
