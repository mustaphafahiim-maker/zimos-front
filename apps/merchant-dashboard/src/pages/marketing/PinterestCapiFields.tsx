import { ExternalLink } from "lucide-react";
import { Alert } from "@store-builder/ui";
import { PINTEREST_CONVERSIONS_HELP_URL, PINTEREST_TEST_EVENTS } from "@store-builder/api-client";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { TextField } from "@/components/Field";

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
    capiEnabled: "ابعت الأحداث من السيرفر (Conversions API)",
    adAccountId: "رقم الحساب الإعلاني",
    adAccountHint: "رقم حسابك الإعلاني في Pinterest Ads Manager (من 6 لـ 20 رقم).",
    adAccountRequired: "محتاج رقم الحساب الإعلاني في بنترست علشان تشغّل الـ Conversions API",
    adAccountInvalid: "اكتب رقم الحساب الإعلاني: من 6 لـ 20 رقم.",
    token: "توكن التحويلات",
    tokenKeep: "فيه توكن محفوظ ({mask}). سيبه فاضي علشان يفضل زي ما هو.",
    tokenRequired: "الصق التوكن علشان تشغّل أحداث السيرفر.",
    testEvents: "ابعتها كأحداث تجريبية",
    testEventsHint: "طول ما دي شغالة، بنترست بيعرض الأحداث كتجربة ومش بيحسبها.",
    help: "في Pinterest Ads Manager افتح Conversions وبعدين «Generate access token»، وانسخ التوكن ورقم الحساب الإعلاني هنا.",
    helpLink: "افتح Pinterest Ads Manager",
  },
} satisfies Messages;

/**
 * The server-side part of a Pinterest pixel's form (handoff 168), the same
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
}: {
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
    <div className="space-y-3 rounded-[0.5rem] border border-line p-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 size-4 cursor-pointer accent-primary"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        <span className="text-sm font-medium text-ink">{t.capiEnabled}</span>
      </label>
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
              <ExternalLink className="size-3.5" aria-hidden />
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
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4 cursor-pointer accent-primary"
              checked={testEventCode.trim() !== ""}
              onChange={(e) => onTestEventCodeChange(e.target.checked ? PINTEREST_TEST_EVENTS : "")}
            />
            <span>
              <span className="block text-sm font-medium text-ink">{t.testEvents}</span>
              <span className="block text-xs text-ink-soft">{t.testEventsHint}</span>
            </span>
          </label>
        </>
      )}
    </div>
  );
}
