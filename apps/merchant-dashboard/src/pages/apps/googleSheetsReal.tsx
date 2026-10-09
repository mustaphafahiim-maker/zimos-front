import { useEffect, useRef } from "react";
import { Input, Label } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";

/**
 * Google Sheets with a real Google account (handoff 393): the wording the page
 * and its dialog add for it — coming back from Google with a refusal, an
 * account Google took the access from, sheets that stopped, and reusing a
 * spreadsheet by its link.
 */
export const SHEETS_REAL_STRINGS = {
  en: {
    cancelled: "Google connection cancelled",
    refused: "Google refused the connection, try again",
    scopeNote: "ZIMOS only gets access to the spreadsheets it creates — not your other files",
    reconnectBanner: "Google removed ZIMOS's access to your sheets — connect the account again",
    reconnectAccount: "Account: {email}",
    revokedRow: "Stopped — connect Google again",
    errorRow: "Pick another sheet or remove it",
    openInGoogle: "Open in Google Sheets",
    existingLabel: "Use an existing spreadsheet (optional)",
    existingPlaceholder: "https://docs.google.com/spreadsheets/d/…",
    existingHint: "ZIMOS can only reuse spreadsheets it created",
    existingInvalid: "Paste the spreadsheet's link from Google Sheets, or its id.",
    SHEETS_STATE_INVALID: "The Google sign-in expired or was for another store — try again",
    SHEETS_AUTH_FAILED: "The Google sign-in didn't complete — try again",
    SHEETS_SCOPE_MISSING: "Allow the Google Drive files permission so we can write to your sheet",
    SHEETS_NOT_FOUND: "The spreadsheet does not exist or was deleted",
    SHEETS_PERMISSION_DENIED: "This account can't edit that spreadsheet",
    SHEETS_UNREACHABLE: "Google asked us to slow down — try again in a minute",
    SHEETS_ACCESS_REVOKED: "Google removed ZIMOS's access to your sheets — connect the account again",
    SHEETS_UNAVAILABLE: "Google Sheets isn't available on this server yet. It will appear here once it is set up.",
    SHEETS_PREVIEW_UNAVAILABLE: "Open the sheet in Google Sheets to see it",
  },
  ar: {
    cancelled: "تم إلغاء الربط مع Google",
    refused: "Google رفض الربط، حاول مرة أخرى",
    scopeNote: "هنطلب صلاحية على الملفات اللي ZIMOS بيعملها بس — مش على كل ملفاتك",
    reconnectBanner: "Google وقف صلاحية ZIMOS على الشيتات — اربط الحساب تاني",
    reconnectAccount: "الحساب: {email}",
    revokedRow: "متوقف — اربط Google تاني",
    errorRow: "اختر شيت تاني أو احذف الاتصال",
    openInGoogle: "افتح في Google Sheets",
    existingLabel: "استخدم شيت موجود (اختياري)",
    existingPlaceholder: "https://docs.google.com/spreadsheets/d/…",
    existingHint: "ZIMOS يقدر يستخدم الشيتات اللي عملها بنفسه بس",
    existingInvalid: "الصق لينك الشيت من Google Sheets، أو الـ id بتاعه.",
    SHEETS_STATE_INVALID: "انتهت صلاحية تسجيل الدخول أو كان لمتجر آخر — حاول مرة أخرى",
    SHEETS_AUTH_FAILED: "تسجيل الدخول مع Google لم يكتمل — حاول مرة أخرى",
    SHEETS_SCOPE_MISSING: "لازم توافق على صلاحية ملفات Google Drive علشان نكتب في الشيت",
    SHEETS_NOT_FOUND: "الشيت ده مش موجود أو اتمسح",
    SHEETS_PERMISSION_DENIED: "الحساب ده مايقدرش يعدّل الشيت ده",
    SHEETS_UNREACHABLE: "Google طالب نستنى شوية — جرّب بعد دقيقة",
    SHEETS_ACCESS_REVOKED: "Google وقف صلاحية ZIMOS على الشيتات — اربط الحساب تاني",
    SHEETS_UNAVAILABLE: "Google Sheets لسه مش متاح على السيرفر ده. هيظهر هنا أول ما يتجهّز.",
    SHEETS_PREVIEW_UNAVAILABLE: "افتح الشيت في Google Sheets علشان تشوفه",
  },
} satisfies Messages;

const CODES = [
  "SHEETS_STATE_INVALID",
  "SHEETS_AUTH_FAILED",
  "SHEETS_SCOPE_MISSING",
  "SHEETS_NOT_FOUND",
  "SHEETS_PERMISSION_DENIED",
  "SHEETS_UNREACHABLE",
  "SHEETS_ACCESS_REVOKED",
  "SHEETS_UNAVAILABLE",
  "SHEETS_PREVIEW_UNAVAILABLE",
] as const;

/** The sentences for the Google Sheets error codes, as `useErrorMessage` overrides. */
export function useSheetErrorOverrides(): Record<string, string> {
  const t = useT(SHEETS_REAL_STRINGS);
  return Object.fromEntries(CODES.map((code) => [code, t[code]]));
}

/**
 * Google sent the merchant back with `?error=` (they pressed Cancel, or Google
 * refused): say which, once, and take it out of the address so a reload does
 * not say it again.
 */
export function useGoogleReturnError(error: string | null, onError: (message: string) => void) {
  const t = useT(SHEETS_REAL_STRINGS);
  const handled = useRef(false);
  useEffect(() => {
    if (!error || handled.current) return;
    handled.current = true;
    onError(error === "access_denied" ? t.cancelled : t.refused);
    window.history.replaceState(window.history.state, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);
}

/** The codes a sheet's preview answers that have their own sentence here (429 SHEETS_UNREACHABLE, 403 SHEETS_ACCESS_REVOKED, 409 SHEETS_PREVIEW_UNAVAILABLE). */
export function sheetPreviewProblem(error: unknown): "SHEETS_UNREACHABLE" | "SHEETS_ACCESS_REVOKED" | "SHEETS_PREVIEW_UNAVAILABLE" | null {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "SHEETS_UNREACHABLE" || code === "SHEETS_ACCESS_REVOKED" || code === "SHEETS_PREVIEW_UNAVAILABLE" ? code : null;
}

/** That sentence, in place of the rows. */
export function SheetPreviewProblem({ error }: { error: unknown }) {
  const t = useT(SHEETS_REAL_STRINGS);
  const code = sheetPreviewProblem(error);
  if (!code) return null;
  return (
    <p role="alert" className="rounded-[0.875rem] bg-accent-soft px-3 py-2 text-sm leading-6 text-accent-dark">
      {t[code]}
    </p>
  );
}

/** A spreadsheet link (https://docs.google.com/spreadsheets/d/<id>/…) or a bare id, as the API takes it. */
const SPREADSHEET_REF = /^(?:[A-Za-z0-9_-]+|https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+(?:[/?#]\S*)?)$/;

export function isSpreadsheetRef(value: string): boolean {
  return value.trim().length <= 500 && SPREADSHEET_REF.test(value.trim());
}

/** "Use an existing spreadsheet" in the new-sheet dialog: a pasted link or an id; empty makes a new spreadsheet. */
export function ExistingSpreadsheetField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useT(SHEETS_REAL_STRINGS);
  const bad = value.trim() !== "" && !isSpreadsheetRef(value);
  return (
    <div className="space-y-1.5">
      <Label htmlFor="sheet-existing">{t.existingLabel}</Label>
      <Input
        id="sheet-existing"
        dir="ltr"
        inputMode="url"
        maxLength={500}
        value={value}
        placeholder={t.existingPlaceholder}
        aria-invalid={bad || undefined}
        aria-describedby="sheet-existing-hint"
        onChange={(e) => onChange(e.target.value)}
      />
      <p id="sheet-existing-hint" className={bad ? "text-xs font-medium text-danger" : "text-xs text-ink-soft"}>
        {bad ? t.existingInvalid : t.existingHint}
      </p>
    </div>
  );
}
