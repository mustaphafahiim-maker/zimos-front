import { useEffect, useState, type FormEvent } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Alert, Chip, SegmentedControl } from "@store-builder/ui";
import type { UpdateWorkspacePayload } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { ApiError, getErrorMessage, getFieldErrors } from "@/lib/errors";
import { useT } from "@/i18n/LocaleContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { TextField } from "@/components/Field";
import { CATEGORIES, CURRENCIES, SLUG_PATTERN, slugFromName, type Category, type Currency } from "./data";
import type { StepProps } from "./state";
import { STRINGS } from "./strings";

type SlugStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "current" }
  | { kind: "unavailable"; reason: string };

export function StepBasics({ state, next, update, setSaving, saving, formId, initialName }: StepProps & { initialName?: string }) {
  const t = useT(STRINGS);
  const { workspaces, createWorkspace, selectWorkspace, refresh } = useWorkspace();
  const existing = state.workspaceId ? workspaces.find((w) => w.id === state.workspaceId) ?? null : null;

  const [name, setName] = useState(state.basics?.name ?? existing?.name ?? initialName ?? "");
  const [slug, setSlug] = useState(state.basics?.slug ?? existing?.slug ?? slugFromName(initialName ?? ""));
  const [slugTouched, setSlugTouched] = useState(Boolean(state.basics?.slug || existing));
  const [currency, setCurrency] = useState<Currency>(
    state.basics?.currency ?? ((CURRENCIES as readonly string[]).includes(existing?.defaultCurrency ?? "") ? (existing!.defaultCurrency as Currency) : "EGP")
  );
  const [locale, setLocale] = useState<"ar" | "en">(state.basics?.locale ?? (existing?.defaultLocale === "en" ? "en" : "ar"));
  const [categories, setCategories] = useState<Category[]>(state.basics?.categories ?? []);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ kind: "idle" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Auto-derive the address from the name until the merchant edits it.
  useEffect(() => {
    if (!slugTouched) setSlug(slugFromName(name));
  }, [name, slugTouched]);

  // Live availability via GET /workspaces/check-slug (debounced).
  useEffect(() => {
    const value = slug.trim().toLowerCase();
    if (!value) {
      setSlugStatus({ kind: "idle" });
      return;
    }
    if (existing && value === existing.slug) {
      setSlugStatus({ kind: "current" });
      return;
    }
    setSlugStatus({ kind: "checking" });
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await apiClient.request<{ available: boolean; reason?: string }>(
          `/workspaces/check-slug?slug=${encodeURIComponent(value)}`,
          { signal: ctrl.signal }
        );
        setSlugStatus(res.available ? { kind: "available" } : { kind: "unavailable", reason: res.reason ?? "taken" });
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setSlugStatus({ kind: "idle" });
      }
    }, 400);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [slug, existing]);

  const reasonText = (reason: string) =>
    (t as Record<string, string>)[`reason_${reason}`] ?? t.reason_invalid_format;

  const toggleCategory = (c: Category) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setErrors({});
    setFormError(null);

    const trimmed = name.trim();
    const cleanSlug = slug.trim().toLowerCase();
    const errs: Record<string, string> = {};
    if (trimmed.length < 2) errs.name = t.nameTooShort;
    if (cleanSlug && !SLUG_PATTERN.test(cleanSlug)) errs.slug = t.reason_invalid_format;
    if (slugStatus.kind === "unavailable") errs.slug = reasonText(slugStatus.reason);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      let workspace = existing;
      let workspaceId = state.workspaceId;
      if (!workspaceId) {
        workspace = await createWorkspace(trimmed);
        workspaceId = workspace.id;
        // Persist immediately so a failure below never creates a second store.
        update({ workspaceId });
      }

      const payload: UpdateWorkspacePayload = {};
      if (workspace && workspace.name !== trimmed) payload.name = trimmed;
      if (cleanSlug && workspace && cleanSlug !== workspace.slug) payload.slug = cleanSlug;
      // The workspace API has no currency / default-language / category
      // columns a merchant can PATCH, so the choices are kept in the opaque
      // themeSettings blob (merged, never replaced).
      payload.themeSettings = {
        ...(workspace?.themeSettings ?? {}),
        onboarding: { currency, locale, categories },
      };
      const updated = await apiClient.updateWorkspace(workspaceId, payload);

      selectWorkspace(workspaceId);
      await refresh();
      next({
        workspaceId,
        basics: { name: trimmed, slug: updated.slug, currency, locale, categories },
      });
    } catch (err) {
      const fe = getFieldErrors(err);
      const mapped: Record<string, string> = {};
      if (fe.name) mapped.name = fe.name;
      if (fe.slug) mapped.slug = fe.slug;
      if (err instanceof ApiError && err.status === 409) mapped.slug = t.reason_taken;
      if (Object.keys(mapped).length) setErrors(mapped);
      else setFormError(getErrorMessage(err, t.basicsError));
    } finally {
      setSaving(false);
    }
  }

  const slugHint = (() => {
    switch (slugStatus.kind) {
      case "checking":
        return (
          <span className="inline-flex items-center gap-1 text-ink-muted">
            <Loader2 className="size-3 animate-spin" aria-hidden /> {t.slugChecking}
          </span>
        );
      case "available":
        return (
          <span className="inline-flex items-center gap-1 text-success">
            <Check className="size-3" aria-hidden /> {t.slugAvailable}
          </span>
        );
      case "current":
        return (
          <span className="inline-flex items-center gap-1 text-success">
            <Check className="size-3" aria-hidden /> {t.slugCurrent}
          </span>
        );
      case "unavailable":
        return (
          <span className="inline-flex items-center gap-1 text-danger">
            <X className="size-3" aria-hidden /> {reasonText(slugStatus.reason)}
          </span>
        );
      default:
        return <span className="text-ink-muted">{slug ? t.slugHint : t.slugAuto}</span>;
    }
  })();

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-6">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <TextField
        label={t.storeName}
        required
        autoFocus={!state.workspaceId}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.storeNamePlaceholder}
        error={errors.name}
        maxLength={200}
      />

      <div className="space-y-1.5">
        <TextField
          label={t.slug}
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
          }}
          dir="ltr"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          error={errors.slug}
          aria-describedby="onb-slug-status"
          maxLength={63}
        />
        <p
          className="rounded-[10px] bg-paper px-3 py-2 text-xs text-ink-soft"
          dir="ltr"
          aria-hidden={!slug}
        >
          <span className="text-ink-muted">https://</span>
          <span className="font-medium text-ink">{slug || "…"}</span>
          <span className="text-ink-muted">.zimos.co</span>
        </p>
        {!errors.slug && (
          <p id="onb-slug-status" className="text-xs" aria-live="polite">
            {slugHint}
          </p>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-sm font-medium text-ink">{t.currency}</legend>
          <SegmentedControl
            ariaLabel={t.currency}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            value={currency}
            onChange={setCurrency}
            className="flex-wrap"
          />
          <p className="text-xs text-ink-muted">{t.currencyNote}</p>
        </fieldset>
        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-sm font-medium text-ink">{t.language}</legend>
          <SegmentedControl
            ariaLabel={t.language}
            options={[
              { value: "ar" as const, label: <span lang="ar">{t.langAr}</span> },
              { value: "en" as const, label: <span lang="en">{t.langEn}</span> },
            ]}
            value={locale}
            onChange={setLocale}
          />
        </fieldset>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{t.whatSell}</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Chip key={c} active={categories.includes(c)} onClick={() => toggleCategory(c)}>
              {categories.includes(c) && <Check className="size-3.5" aria-hidden />}
              {(t as Record<string, string>)[`cat_${c}`]}
            </Chip>
          ))}
        </div>
      </fieldset>
    </form>
  );
}
