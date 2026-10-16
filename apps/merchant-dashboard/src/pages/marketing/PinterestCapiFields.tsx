import { IconExternal } from "@/components/icons";
import { Alert } from "@store-builder/ui";
import { PINTEREST_CONVERSIONS_HELP_URL, PINTEREST_TEST_EVENTS } from "@store-builder/api-client";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { TextField } from "@/components/Field";
import { ServerModeChip } from "./ServerModeChip";
import { Well } from "./kit/Facts";
import { SwitchRow } from "./kit/Switch";

const STRINGS = {
  en: {
    capiEnabled: "Send events from the server (Conversions API)",
    adAccountId: "Ad account id",
    adAccountHint: "The number of your ad account in Pinterest Ads Manager (6–20 digits).",
    adAccountRequired: "The Pinterest ad account id is needed to turn the Conversions API on",
    adAccountInvalid: "Use the ad account's number: 6 to 20 digits.",
    token: "Conversion access token",
    tokenKeep: "A token is saved ({mask}). Leave empty to keep it.",
    tokenRequired: "Paste the token to turn server events on.",
    testEvents: "Send as test events",
    testEventsHint: "While on, Pinterest shows the events as tests and does not count them.",
    help: "In Pinterest Ads Manager open Conversions, then “Generate access token”, and copy the token and your ad account id here.",
    helpLink: "Open Pinterest Ads Manager",
  },
  ar: {
    capiEnabled: "إرسال الأحداث من الخادم (Conversions API)",
    adAccountId: "رقم الحساب الإعلاني",
    adAccountHint: "رقم حسابك الإعلاني في Pinterest Ads Manager (من 6 إلى 20 رقمًا).",
    adAccountRequired: "يلزم رقم الحساب الإعلاني في Pinterest لتفعيل Conversions API",
    adAccountInvalid: "أدخل رقم الحساب الإعلاني: من 6 إلى 20 رقمًا.",
    token: "رمز التحويلات",
    tokenKeep: "يوجد رمز محفوظ ({mask}). اتركه فارغًا ليبقى كما هو.",
    tokenRequired: "الصق الرمز لتفعيل أحداث الخادم.",
    testEvents: "إرسالها كأحداث تجريبية",
    testEventsHint: "ما دام هذا مفعّلًا، يعرض Pinterest الأحداث كتجربة ولا يحتسبها.",
    help: "في Pinterest Ads Manager افتح Conversions ثم «Generate access token»، وانسخ الرمز ورقم الحساب الإعلاني هنا.",
    helpLink: "فتح Pinterest Ads Manager",
  },
} satisfies Messages;

/**
 * The server-side part of a Pinterest pixel's form, the same
 * shape as Meta's: the switch, the ad account id (needed while it is on), the
 * conversion access token (write-only; its mask when one is saved) and
 * "Send as test events". Lives in TrackingPixelsSection's pixel dialog.
 */
export function PinterestCapiFields({
  enabled,
  onEnabledChange,
  adAccountId,
  onAdAccountIdChange,
  adAccountProblem,
  token,
  onTokenChange,
  tokenMissing,
  tokenError,
  tokenMask,
  testEventCode,
  onTestEventCodeChange,
  warning,
  serverMode,
}: {
  /** "sandbox" while Pinterest's server events are only built and logged. */
  serverMode?: "live" | "sandbox" | null;
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  adAccountId: string;
  onAdAccountIdChange: (next: string) => void;
  /** Why the ad account id cannot be saved, if it cannot. */
  adAccountProblem: "missing" | "invalid" | null;
  token: string;
  onTokenChange: (next: string) => void;
  tokenMissing: boolean;
  tokenError?: string;
  /** The saved token's mask, or null when none is saved. */
  tokenMask: string | null;
  testEventCode: string;
  onTestEventCodeChange: (next: string) => void;
  /** The double-counting warning every Conversions API section shows. */
  warning: string;
}) {
  const t = useT(STRINGS);
  return (
    <Well className="space-y-3">
      <SwitchRow checked={enabled} onChange={onEnabledChange} label={t.capiEnabled} />
      <ServerModeChip mode={serverMode} />
      {enabled && (
        <>
          <Alert>{warning}</Alert>
          <p className="text-xs text-ink-soft">
            {t.help}{" "}
            <a
              href={PINTEREST_CONVERSIONS_HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {t.helpLink}
              <IconExternal className="size-3.5" aria-hidden />
            </a>
          </p>
          <TextField
            label={t.adAccountId}
            dir="ltr"
            inputMode="numeric"
            autoComplete="off"
            maxLength={20}
            required
            value={adAccountId}
            hint={t.adAccountHint}
            onChange={(e) => onAdAccountIdChange(e.target.value)}
            error={adAccountProblem === "missing" ? t.adAccountRequired : adAccountProblem === "invalid" ? t.adAccountInvalid : undefined}
          />
          <TextField
            label={t.token}
            dir="ltr"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
            error={tokenMissing ? t.tokenRequired : tokenError}
            hint={tokenMask ? fmt(t.tokenKeep, { mask: tokenMask }) : undefined}
          />
          <SwitchRow
            checked={testEventCode.trim() !== ""}
            onChange={(next) => onTestEventCodeChange(next ? PINTEREST_TEST_EVENTS : "")}
            label={t.testEvents}
            hint={t.testEventsHint}
          />
        </>
      )}
    </Well>
  );
}
