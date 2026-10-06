import { useState } from "react";
import { AlertTriangle, CircleCheck } from "lucide-react";
import { Button } from "@store-builder/ui";
import { funnelExtrasIssues, type FunnelIssue } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";

/**
 * The funnel map's issues counter (SPEC §9.2 "Quality"): a button showing how
 * many things are worth fixing, opening the list. Fatal issues are the ones
 * that block publishing; warnings do not. The list is the server's
 * (GET /funnels/:id/issues), re-read each time the dialog opens and whenever
 * `version` changes (the editor passes its save counter).
 */

const STRINGS = {
  en: {
    none: "No issues",
    count: "Issues",
    title: "Things to fix",
    description: "Problems marked \"blocks publishing\" must be fixed first. The rest are advice.",
    fatal: "Blocks publishing",
    warning: "Advice",
    page: "Page",
    allGood: "Nothing to fix — this funnel is ready.",
    close: "Close",
    page_without_product: "This page sells nothing yet: add a product to it.",
    unlinked_button: "A button on this page goes nowhere.",
    image_without_alt: "An image on this page has no description.",
    missing_policies: "Your store has no policies yet (Store settings → Policies). Ad platforms ask for them.",
    untranslated_text: "{n} texts on this page are not translated into {language} yet (Store settings → Languages).",
  },
  ar: {
    none: "مفيش مشاكل",
    count: "مشاكل",
    title: "أشياء تحتاج إصلاحًا",
    description: "المشاكل المعلَّمة «تمنع النشر» يجب إصلاحها أولًا. الباقي نصائح.",
    fatal: "تمنع النشر",
    warning: "نصيحة",
    page: "الصفحة",
    allGood: "مفيش ما يحتاج إصلاحًا — المسار جاهز.",
    close: "إغلاق",
    page_without_product: "هذه الصفحة لا تبيع شيئًا بعد: أضف منتجًا إليها.",
    unlinked_button: "زرار في هذه الصفحة لا يؤدي لأي مكان.",
    image_without_alt: "صورة في هذه الصفحة بدون وصف.",
    missing_policies: "متجرك بدون سياسات حتى الآن (إعدادات المتجر ← السياسات). منصات الإعلانات تطلبها.",
    untranslated_text: "{n} نص في الصفحة دي لسه مش مترجم لـ{language} (إعدادات المتجر ← اللغات).",
  },
} satisfies Messages;

/** A language's name in the dashboard's language ("English", "الفرنسية"). */
function languageName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function FunnelIssuesButton({
  funnelId,
  version = 0,
  stepNames = {},
}: {
  funnelId: string;
  /** Bump to re-read the issues (e.g. after a save). */
  version?: number;
  /** Step key → the name the merchant gave the page. */
  stepNames?: Record<string, string>;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const [open, setOpen] = useState(false);
  const state = useAsync(() => funnelExtrasIssues(apiClient, workspaceId, funnelId), [workspaceId, funnelId, version]);
  const counts = state.data?.counts ?? { fatal: 0, warning: 0 };
  const total = counts.fatal + counts.warning;

  // Graph problems come as the server's own sentence; the content checks are translated by code.
  const text = (issue: FunnelIssue) =>
    issue.code === "graph"
      ? issue.message
      : issue.code === "untranslated_text"
        ? fmt(t.untranslated_text, { n: issue.count ?? 0, language: languageName(issue.locale ?? "", locale) })
        : ((t as Record<string, string>)[issue.code] ?? issue.message);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={state.loading && !state.data}
        onClick={() => {
          setOpen(true);
          void state.refresh({ silent: true });
        }}
        className={counts.fatal > 0 ? "border-danger/50 text-danger" : undefined}
      >
        {total === 0 ? <CircleCheck className="size-4 text-success" aria-hidden /> : <AlertTriangle className="size-4" aria-hidden />}
        {total === 0 ? t.none : `${t.count} (${total})`}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={t.title} description={t.description}>
        {total === 0 ? (
          <p className="text-sm text-ink-soft">{t.allGood}</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {(state.data?.issues ?? []).map((issue, i) => (
              <li key={i} className="rounded-[0.5rem] border border-line p-3">
                <p className={`text-xs font-semibold ${issue.severity === "fatal" ? "text-danger" : "text-ink-soft"}`}>
                  {issue.severity === "fatal" ? t.fatal : t.warning}
                  {issue.stepKey && (
                    <span className="ms-2 font-normal text-ink-soft">
                      {t.page}: {stepNames[issue.stepKey] ?? issue.stepKey}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-ink" dir="auto">
                  {text(issue)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {t.close}
          </Button>
        </div>
      </Modal>
    </>
  );
}
