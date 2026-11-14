import { useState } from "react";
import { IconDevices } from "@/components/icons";
import { Alert, Input, cn } from "@store-builder/ui";
import {
  REDDIT_TEST_MODE,
  X_CAPI_KEYS,
  X_EVENT_ID,
  X_PIXEL_EVENTS,
  emptyXCapiKeys,
  isAdPlatformPixel,
  xCapiToken,
  type TrackingPixelPlatform,
  type TrackingPixelServerMode,
  type XCapiKeys,
  type XPixelEvent,
} from "@store-builder/api-client";
import { fmt, useT } from "@/i18n/LocaleContext";
import { TextField } from "@/components/Field";
import { AD_PLATFORM_PIXEL_STRINGS, eventKey, idHintKey, idLabelKey, xKeyLabel } from "./adPlatformPixelStrings";
import { ServerModeChip } from "./ServerModeChip";
import { Well } from "./kit/Facts";
import { SwitchRow } from "./kit/Switch";

/**
 * The parts of the pixel form that X, Taboola, Outbrain, Kwai, Reddit and
 * Microsoft Ads add (257). They live in
 * TrackingPixelsSection's pixel dialog, beside PinterestCapiFields.
 */

/** The platforms with a server API and their own fields in the form. */
export type ServerAdPlatform = "x" | "reddit" | "microsoft";

export function isServerAdPlatform(platform: TrackingPixelPlatform): platform is ServerAdPlatform {
  return platform === "x" || platform === "reddit" || platform === "microsoft";
}

/** What the ID field is called for one of the six platforms, and where the ID is found; null for the others. */
export function useAdPlatformIdField(platform: TrackingPixelPlatform): { label: string; hint: string } | null {
  const t = useT(AD_PLATFORM_PIXEL_STRINGS);
  return isAdPlatformPixel(platform) ? { label: t[idLabelKey(platform)], hint: t[idHintKey(platform)] } : null;
}

/** Taboola, Outbrain and Kwai have no server API: the form says so where the Conversions API switch would be. */
export function BrowserOnlyPixelNote({ platform, hasServerApi }: { platform: TrackingPixelPlatform; hasServerApi: boolean }) {
  const t = useT(AD_PLATFORM_PIXEL_STRINGS);
  if (hasServerApi || !isAdPlatformPixel(platform)) return null;
  return (
    <p data-slot="sweep-well" className="flex items-start gap-2.5 rounded-2xl bg-paper-sunken px-4 py-3 text-sm leading-6 text-ink-soft">
      <IconDevices className="mt-1 size-4 shrink-0" aria-hidden />
      {t.browserOnly}
    </p>
  );
}

/**
 * X has no fixed event names: each standard event goes out under the ID of an
 * event made in X Ads Manager, and an event left empty is not sent.
 */
export function XEventIdsField({
  pixelId,
  value,
  onChange,
  serverErrors,
}: {
  /** The pixel ID typed so far, for the example in each row. */
  pixelId: string;
  value: Record<XPixelEvent, string>;
  onChange: (next: Record<XPixelEvent, string>) => void;
  /** The form's field errors: a refused ID comes back as `config.eventIds.<event>`. */
  serverErrors: Record<string, string>;
}) {
  const t = useT(AD_PLATFORM_PIXEL_STRINGS);
  const example = `tw-${/^[a-z0-9]{4,12}$/i.test(pixelId) ? pixelId : "o1abc"}-o2def`;
  return (
    <div data-slot="sweep-well" className="rounded-2xl bg-paper-sunken px-4 py-3.5">
      <h3 className="text-sm font-medium text-ink">{t.eventIds}</h3>
      <p className="mt-0.5 text-xs text-ink-soft">{t.eventIdsHint}</p>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-xs text-ink-soft">
            <th scope="col" className="py-1.5 pe-3 text-start font-medium">
              {t.eventCol}
            </th>
            <th scope="col" className="py-1.5 text-start font-medium">
              {t.eventIdCol}
            </th>
          </tr>
        </thead>
        <tbody>
          {X_PIXEL_EVENTS.map((event) => {
            const id = value[event].trim();
            const bad = (id !== "" && !X_EVENT_ID.test(id)) || Boolean(serverErrors[`config.eventIds.${event}`]);
            const label = t[eventKey(event)];
            return (
              <tr key={event} className="border-t border-line align-top">
                <th scope="row" className="w-2/5 py-2.5 pe-3 text-start font-normal text-ink">
                  {label}
                </th>
                <td className="py-1.5">
                  <Input
                    aria-label={fmt(t.eventIdFor, { event: label })}
                    aria-invalid={bad || undefined}
                    dir="ltr"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={40}
                    placeholder={example}
                    value={value[event]}
                    onChange={(e) => onChange({ ...value, [event]: e.target.value })}
                    className={cn(bad && "border-danger focus-visible:ring-danger/30")}
                  />
                  {bad && <p className="mt-1 text-xs font-medium text-danger">{t.eventIdInvalid}</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The server-side part of an X, Reddit or Microsoft Ads pixel: the switch, the
 * sandbox chip, and the platform's own token — one field for Reddit and
 * Microsoft, four keys for X (joined into the one `capiToken` the API takes).
 * Tokens are write-only: a saved one shows as its mask.
 */
export function AdPlatformCapiFields({
  platform,
  serverMode,
  enabled,
  onEnabledChange,
  token,
  onTokenChange,
  tokenProblem,
  tokenMask,
  testEventCode,
  onTestEventCodeChange,
  warning,
}: {
  platform: ServerAdPlatform;
  serverMode: TrackingPixelServerMode | undefined;
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  /** The form's `capiToken`: "" keeps the saved one. For X it is the four keys joined, written here. */
  token: string;
  onTokenChange: (next: string) => void;
  /** Why the token cannot be saved, if it cannot. */
  tokenProblem: "missing" | "invalid" | null;
  /** The saved token's mask, or null when none is saved. */
  tokenMask: string | null;
  testEventCode: string;
  onTestEventCodeChange: (next: string) => void;
  /** The double-counting warning every Conversions API section shows. */
  warning: string;
}) {
  const t = useT(AD_PLATFORM_PIXEL_STRINGS);
  // X's keys are typed one by one and never read back, so they live here; the form only holds them joined.
  const [xKeys, setXKeys] = useState<XCapiKeys>(emptyXCapiKeys);

  return (
    <Well className="space-y-3">
      <SwitchRow checked={enabled} onChange={onEnabledChange} label={t.capiEnabled} />
      <ServerModeChip mode={serverMode} />
      {enabled && (
        <>
          <Alert>{warning}</Alert>
          {platform === "x" ? (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-ink">{t.xKeys}</legend>
              <p className="text-xs text-ink-soft">{t.xKeysHint}</p>
              {X_CAPI_KEYS.map((key) => (
                <TextField
                  key={key}
                  label={t[xKeyLabel(key)]}
                  dir="ltr"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={xKeys[key]}
                  onChange={(e) => {
                    const next = { ...xKeys, [key]: e.target.value };
                    setXKeys(next);
                    onTokenChange(xCapiToken(next));
                  }}
                  error={
                    tokenProblem === "missing" && xKeys[key].trim() === ""
                      ? t.xKeysRequired
                      : tokenProblem === "invalid" && (xKeys[key].trim() === "" || /[\s:]/.test(xKeys[key].trim()))
                        ? t.xKeysInvalid
                        : undefined
                  }
                />
              ))}
              {tokenMask && <p className="text-xs text-ink-soft">{fmt(t.xKeysKeep, { mask: tokenMask })}</p>}
              <p className="text-xs text-ink-soft">{t.xNeedsEventIds}</p>
            </fieldset>
          ) : (
            <>
              {/* Where the token is made stays on screen while the field still asks for it. */}
              <p className="text-xs text-ink-soft">{t[`tokenHint_${platform}`]}</p>
              <TextField
                label={t[`token_${platform}`]}
                dir="ltr"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={token}
                onChange={(e) => onTokenChange(e.target.value)}
                error={tokenProblem ? t.tokenRequired : undefined}
                hint={tokenMask ? fmt(t.tokenKeep, { mask: tokenMask }) : undefined}
              />
              {platform === "reddit" && (
                <SwitchRow
                  checked={testEventCode.trim() !== ""}
                  onChange={(next) => onTestEventCodeChange(next ? REDDIT_TEST_MODE : "")}
                  label={t.testMode}
                  hint={t.testModeHint}
                />
              )}
            </>
          )}
        </>
      )}
    </Well>
  );
}
