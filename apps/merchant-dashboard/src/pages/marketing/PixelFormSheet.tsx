import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  GOOGLE_ADS_LABEL,
  PINTEREST_AD_ACCOUNT_ID,
  X_CAPI_TOKEN,
  funnelsList,
  googleAdsLabelsOf,
  googleAdsPixelConfig,
  pinterestAdAccountIdOf,
  pinterestPixelConfig,
  trackingPixelsCreate,
  trackingPixelsUpdate,
  xEventIdProblems,
  xEventIdsOf,
  xPixelConfig,
  type TrackingPixelDto,
  type TrackingPixelPlatform,
  type TrackingPixelPlatformInfo,
  type TrackingPixelScopeType,
  type XPixelEvent,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Segmented } from "@/components/Segmented";
import { PinterestCapiFields } from "./PinterestCapiFields";
// X, Taboola, Outbrain, Kwai, Reddit, Microsoft Ads and the sandbox chip (handoffs 251, 255, 257).
import { PixelPlatformTiles } from "./PixelPlatformTiles";
import { AdPlatformCapiFields, BrowserOnlyPixelNote, XEventIdsField, isServerAdPlatform, useAdPlatformIdField } from "./AdPlatformPixelFields";
import { ServerModeChip } from "./ServerModeChip";
import { AD_PLATFORM_PIXEL_STRINGS } from "./adPlatformPixelStrings";
import { Well } from "./kit/Facts";
import { focusFirstInvalid } from "./kit/form";
import { SwitchRow } from "./kit/Switch";
import { PLATFORM_META, pixelPlatformName } from "./pixelPlatforms";
import { PIXEL_STRINGS } from "./pixelStrings";

interface FormState {
  platform: TrackingPixelPlatform;
  pixelId: string;
  label: string;
  capiEnabled: boolean;
  capiToken: string;
  testEventCode: string;
  adsConversionLabel: string;
  /** The Google Ads lead conversion label (config.adsLeadLabel, handoff 169). */
  adsLeadLabel: string;
  /** Pinterest's Conversions API needs the ad account (config.adAccountId). */
  adAccountId: string;
  /** X's event ID per standard event (config.eventIds, handoff 251). */
  xEventIds: Record<XPixelEvent, string>;
  scopeType: TrackingPixelScopeType;
  scopeIds: string[];
}

const emptyForm = (): FormState => ({
  platform: "meta",
  pixelId: "",
  label: "",
  capiEnabled: false,
  capiToken: "",
  testEventCode: "",
  adsConversionLabel: "",
  adsLeadLabel: "",
  adAccountId: "",
  xEventIds: xEventIdsOf(null),
  scopeType: "all",
  scopeIds: [],
});

const formOf = (p: TrackingPixelDto): FormState => ({
  platform: p.platform,
  pixelId: p.pixelId,
  label: p.label ?? "",
  capiEnabled: p.capiEnabled,
  capiToken: "",
  testEventCode: p.testEventCode ?? "",
  adsConversionLabel: googleAdsLabelsOf(p).purchase,
  adsLeadLabel: googleAdsLabelsOf(p).lead,
  adAccountId: pinterestAdAccountIdOf(p),
  xEventIds: xEventIdsOf(p),
  scopeType: p.scope.type,
  scopeIds: p.scope.ids,
});

/**
 * Add or edit one pixel, in a sheet over the list (a bottom sheet on a phone).
 * Mount it with a `key` per pixel, so every open starts from that pixel.
 *
 * What it saves and what it refuses are the page's own rules, unchanged; what
 * is new is how a refusal is told: the save button is always there, and a
 * press with something missing says what, under the field, and goes to it.
 */
export function PixelFormSheet({
  pixel,
  platforms,
  onClose,
  onSaved,
}: {
  /** The pixel being edited, or null for a new one. */
  pixel: TrackingPixelDto | null;
  platforms: TrackingPixelPlatformInfo[];
  onClose: () => void;
  onSaved: (created: boolean) => Promise<void>;
}) {
  const t = useT(PIXEL_STRINGS);
  const more = useT(AD_PLATFORM_PIXEL_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const scopeLabelId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<FormState>(() => (pixel ? formOf(pixel) : emptyForm()));
  const [saving, setSaving] = useState(false);
  // True once a save was tried: from then on an empty required field says so.
  const [tried, setTried] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const meta = PLATFORM_META[form.platform];
  const info = platforms.find((p) => p.name === form.platform);
  const id = form.pixelId.trim();
  const idBad = id !== "" && !meta.pattern.test(id);
  // GA4's server API only takes a G- id; an Ads id has a conversion label instead.
  const isAdsId = form.platform === "google" && /^AW-/i.test(id);
  const capiPossible = Boolean(info?.capi) && !(form.platform === "google" && id !== "" && !/^G-/i.test(id));
  const tokenSaved = Boolean(pixel?.capiTokenSet);
  const tokenMissing = form.capiEnabled && capiPossible && !tokenSaved && form.capiToken.trim() === "";
  // X, Reddit and Microsoft Ads (handoffs 251, 255): X's token is four keys joined, and its event IDs have one shape.
  const idField = useAdPlatformIdField(form.platform);
  const xTokenBad = form.platform === "x" && form.capiEnabled && capiPossible && form.capiToken !== "" && !X_CAPI_TOKEN.test(form.capiToken);
  const adPlatformBad = xTokenBad || (form.platform === "x" && xEventIdProblems(form.xEventIds).length > 0);
  const scopeMissing = form.scopeType !== "all" && form.scopeIds.length === 0;
  const pinterest = form.platform === "pinterest";
  const adAccount = form.adAccountId.trim();
  // Checked here before saving; the server's own refusal (config.adAccountId) shows the same words.
  const adAccountBad: "missing" | "invalid" | null = !pinterest
    ? null
    : adAccount !== "" && !PINTEREST_AD_ACCOUNT_ID.test(adAccount)
      ? "invalid"
      : form.capiEnabled && capiPossible && adAccount === ""
        ? "missing"
        : null;
  const adAccountProblem = adAccountBad ?? (fieldErrors["config.adAccountId"] ? "missing" : null);
  // Google Ads labels (handoff 169): checked here; the server refuses one on a non-Ads tag.
  const labelBad = (value: string) => isAdsId && value.trim() !== "" && !GOOGLE_ADS_LABEL.test(value.trim());
  const purchaseLabelBad = labelBad(form.adsConversionLabel);
  const leadLabelBad = labelBad(form.adsLeadLabel);
  const labelError = (bad: boolean, field: string) =>
    bad ? t.adsLabelInvalid : fieldErrors[field] ? (isAdsId ? t.adsLabelInvalid : t.adsLabelNeedsAds) : undefined;
  const setLabel = (key: "adsConversionLabel" | "adsLeadLabel", value: string) => {
    set(key, value);
    setFieldErrors((prev) => ({ ...prev, [`config.${key}`]: "" }));
  };

  // The scope lists load only when that scope is picked.
  const funnels = useAsync(
    async () => (form.scopeType === "funnels" ? (await funnelsList(apiClient, workspaceId)).map((f) => ({ id: f.id, name: f.name })) : []),
    [workspaceId, form.scopeType === "funnels"]
  );
  const products = useAsync(
    async () =>
      form.scopeType === "products"
        ? (await apiClient.listProducts(workspaceId, { limit: 100 })).products.map((p) => ({ id: p.id, name: p.name }))
        : [],
    [workspaceId, form.scopeType === "products"]
  );
  const options = form.scopeType === "funnels" ? funnels : form.scopeType === "products" ? products : null;

  const scopeIdSet = useMemo(() => new Set(form.scopeIds), [form.scopeIds]);
  const scopeProblem = (tried && scopeMissing && options && !options.loading ? t.scopeRequired : undefined) ?? (fieldErrors.ids || undefined);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (id === "" || idBad || tokenMissing || scopeMissing || adAccountBad || purchaseLabelBad || leadLabelBad || adPlatformBad) {
      setTried(true);
      focusFirstInvalid(formRef.current);
      return;
    }
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    // X's four keys are only sent whole: a half-typed set left behind a switched-off section is dropped.
    const token = form.platform === "x" && !X_CAPI_TOKEN.test(form.capiToken) ? "" : form.capiToken.trim();
    const shared = {
      pixelId: id,
      label: form.label.trim() || null,
      capiEnabled: form.capiEnabled && capiPossible,
      testEventCode: info?.testEventCode ? form.testEventCode.trim() || null : undefined,
      scope: { type: form.scopeType, ids: form.scopeType === "all" ? [] : form.scopeIds },
      config:
        form.platform === "google"
          ? googleAdsPixelConfig(id, { purchase: form.adsConversionLabel, lead: form.adsLeadLabel })
          : pinterest
            ? pinterestPixelConfig(form.adAccountId)
            : form.platform === "x"
              ? xPixelConfig(form.xEventIds)
              : undefined,
      ...(token ? { capiToken: token } : {}),
    };
    try {
      if (pixel) await trackingPixelsUpdate(apiClient, workspaceId, pixel.id, shared);
      else await trackingPixelsCreate(apiClient, workspaceId, { platform: form.platform, ...shared });
      await onSaved(!pixel);
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      setFormError(
        Object.keys(fields).length ? null : errorMessage(err, { TRACKING_PIXEL_EXISTS: more.pixelExists, TRACKING_PIXEL_LIMIT: more.pixelLimit })
      );
      setSaving(false);
      // The server's own refusals land on their fields: go to the first.
      if (Object.keys(fields).length) focusFirstInvalid(formRef.current);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={pixel ? t.editTitle : t.addTitle}
      description={pixel ? pixelPlatformName(pixel.platform) : undefined}
      className="max-w-xl"
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose} disabled={saving}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={saving}>
            {saving ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <form id={formId} ref={formRef} onSubmit={submit} noValidate className="space-y-4">
        {formError && <Alert variant="danger">{formError}</Alert>}

        {/* Tiles with each platform's mark (handoff 251). A token or test code typed for one platform never follows to another. */}
        <PixelPlatformTiles
          platforms={platforms.filter((p) => PLATFORM_META[p.name])}
          value={form.platform}
          locked={Boolean(pixel)}
          nameOf={pixelPlatformName}
          onChange={(platform: TrackingPixelPlatform) =>
            setForm((prev) => ({ ...prev, platform, capiEnabled: false, capiToken: "", testEventCode: "" }))
          }
        />

        <TextField
          label={idField?.label ?? t.pixelId}
          dir="ltr"
          required
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={form.pixelId}
          placeholder={meta.example}
          hint={idField?.hint}
          onChange={(e) => set("pixelId", e.target.value)}
          error={idBad ? t.invalid : tried && id === "" ? t.idRequired : fieldErrors.pixelId}
        />

        <TextField label={t.label} value={form.label} maxLength={120} hint={t.labelHint} onChange={(e) => set("label", e.target.value)} />

        {form.platform === "x" && (
          <XEventIdsField pixelId={id} value={form.xEventIds} onChange={(next) => set("xEventIds", next)} serverErrors={fieldErrors} />
        )}

        {isAdsId && (
          <>
            <TextField
              label={t.adsLabel}
              dir="ltr"
              autoComplete="off"
              maxLength={60}
              value={form.adsConversionLabel}
              hint={t.adsLabelHint}
              onChange={(e) => setLabel("adsConversionLabel", e.target.value)}
              error={labelError(purchaseLabelBad, "config.adsConversionLabel")}
            />
            <TextField
              label={t.adsLeadLabel}
              dir="ltr"
              autoComplete="off"
              maxLength={60}
              value={form.adsLeadLabel}
              hint={t.adsLeadLabelHint}
              onChange={(e) => setLabel("adsLeadLabel", e.target.value)}
              error={labelError(leadLabelBad, "config.adsLeadLabel")}
            />
          </>
        )}

        {capiPossible && pinterest && (
          <PinterestCapiFields
            enabled={form.capiEnabled}
            onEnabledChange={(next) => set("capiEnabled", next)}
            adAccountId={form.adAccountId}
            onAdAccountIdChange={(next) => {
              set("adAccountId", next);
              setFieldErrors((prev) => ({ ...prev, "config.adAccountId": "" }));
            }}
            adAccountProblem={adAccountProblem}
            token={form.capiToken}
            onTokenChange={(next) => set("capiToken", next)}
            tokenMissing={tokenMissing}
            tokenError={fieldErrors.capiToken}
            tokenMask={tokenSaved ? (pixel?.capiTokenMask ?? "••••") : null}
            testEventCode={form.testEventCode}
            onTestEventCodeChange={(next) => set("testEventCode", next)}
            warning={t.capiWarning}
            serverMode={info?.serverMode}
          />
        )}
        <BrowserOnlyPixelNote platform={form.platform} hasServerApi={Boolean(info?.capi)} />
        {capiPossible && isServerAdPlatform(form.platform) && (
          <AdPlatformCapiFields
            key={form.platform}
            platform={form.platform}
            serverMode={info?.serverMode}
            enabled={form.capiEnabled}
            onEnabledChange={(next) => set("capiEnabled", next)}
            token={form.capiToken}
            onTokenChange={(next) => {
              set("capiToken", next);
              setFieldErrors((prev) => ({ ...prev, capiToken: "" }));
            }}
            tokenProblem={tokenMissing ? "missing" : xTokenBad || fieldErrors.capiToken ? "invalid" : null}
            tokenMask={tokenSaved ? (pixel?.capiTokenMask ?? "••••") : null}
            testEventCode={form.testEventCode}
            onTestEventCodeChange={(next) => set("testEventCode", next)}
            warning={t.capiWarning}
          />
        )}
        {capiPossible && !pinterest && !isServerAdPlatform(form.platform) && (
          <Well className="space-y-3">
            <SwitchRow checked={form.capiEnabled} onChange={(next) => set("capiEnabled", next)} label={t.capiEnabled} />
            <ServerModeChip mode={info?.serverMode} />
            {form.capiEnabled && (
              <>
                <Alert>{t.capiWarning}</Alert>
                <TextField
                  label={t.capiToken}
                  dir="ltr"
                  type="password"
                  autoComplete="off"
                  value={form.capiToken}
                  onChange={(e) => set("capiToken", e.target.value)}
                  error={tokenMissing ? t.capiTokenRequired : fieldErrors.capiToken}
                  hint={
                    tokenSaved
                      ? fmt(t.capiTokenKeep, { mask: pixel?.capiTokenMask ?? "••••" })
                      : form.platform === "google"
                        ? t.capiTokenGa4
                        : undefined
                  }
                />
                {info?.testEventCode && (
                  <TextField
                    label={t.testCode}
                    dir="ltr"
                    autoComplete="off"
                    value={form.testEventCode}
                    hint={t.testCodeHint}
                    onChange={(e) => set("testEventCode", e.target.value)}
                  />
                )}
              </>
            )}
          </Well>
        )}

        <div className="space-y-1.5">
          <p id={scopeLabelId} className="text-sm leading-none font-medium text-ink">
            {t.scope}
          </p>
          <Segmented
            label={t.scope}
            size="sm"
            className="w-full"
            value={form.scopeType}
            onChange={(scopeType) => setForm((prev) => ({ ...prev, scopeType, scopeIds: [] }))}
            options={[
              { value: "all", label: t.scopeAll },
              { value: "funnels", label: t.scopeFunnels },
              { value: "products", label: t.scopeProducts },
            ]}
          />
          {scopeProblem && !options && <p className="text-xs font-medium text-danger">{scopeProblem}</p>}
        </div>

        {options && (
          <DataState loading={options.loading} error={options.error} onRetry={() => void options.refresh()}>
            {(options.data ?? []).length === 0 ? (
              <p className="text-sm text-ink-soft">{t.scopeEmpty}</p>
            ) : (
              <div
                role="group"
                aria-label={form.scopeType === "funnels" ? t.chooseFunnels : t.chooseProducts}
                aria-invalid={scopeProblem ? true : undefined}
                tabIndex={-1}
                className="rounded-[0.875rem] ring-1 ring-line outline-none focus-visible:ring-2 focus-visible:ring-primary aria-invalid:ring-danger"
              >
                <ul className="max-h-56 space-y-0.5 overflow-y-auto p-1.5">
                  {(options.data ?? []).map((item) => (
                    <li key={item.id}>
                      <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-[0.625rem] px-2.5 text-sm text-ink hover:bg-paper-sunken pointer-coarse:min-h-11">
                        <input
                          type="checkbox"
                          className="size-[18px] shrink-0 cursor-pointer accent-primary"
                          checked={scopeIdSet.has(item.id)}
                          onChange={(e) =>
                            set("scopeIds", e.target.checked ? [...form.scopeIds, item.id] : form.scopeIds.filter((x) => x !== item.id))
                          }
                        />
                        <span dir="auto" className="min-w-0 truncate">
                          {item.name}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {scopeProblem && <p className="mt-1.5 text-xs font-medium text-danger">{scopeProblem}</p>}
          </DataState>
        )}
      </form>
    </Modal>
  );
}
