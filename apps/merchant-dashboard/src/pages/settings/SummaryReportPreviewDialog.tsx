import { useEffect, useState } from "react";
import { Button } from "@store-builder/ui";
import { scheduledReportPreview, type ScheduledReportKind, type ScheduledReportPreview } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";

const STRINGS = {
  en: {
    title_daily: "Daily report — preview",
    title_weekly: "Weekly report — preview",
    description: "The email as you would get it, with the store's numbers as they are now.",
    covers: "Covers {from} to {to}",
    coversDay: "Covers {day}",
    subject: "Subject",
    frame: "The report email",
    close: "Close",
  },
  ar: {
    title_daily: "التقرير اليومي — معاينة",
    title_weekly: "التقرير الأسبوعي — معاينة",
    description: "الإيميل زي ما هيوصلك، بأرقام المتجر دلوقتي.",
    covers: "بيغطي من {from} لـ {to}",
    coversDay: "بيغطي {day}",
    subject: "العنوان",
    frame: "إيميل التقرير",
    close: "إغلاق",
  },
} satisfies Messages;

/** "2026-10-06" (a store-local calendar day) → "6 Oct 2026", whatever zone this browser is in. */
function dayLabel(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString(getIntlLocale(), { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}

/**
 * The email's own markup, made a whole page for the frame: a white sheet with
 * a little margin, and every link aimed at a new window — which the sandbox
 * refuses, so a click in the preview goes nowhere instead of loading the
 * dashboard inside the frame.
 */
function frameDocument(html: string): string {
  const base = '<base target="_blank">';
  if (/<head[\s>]/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>${base}`);
  return `<!doctype html><html><head><meta charset="utf-8">${base}<style>html,body{margin:0;background:#fff}body{padding:16px}</style></head><body>${html}</body></html>`;
}

/**
 * «معاينة» of a summary report (GET /scheduled-reports/preview?kind=). The
 * email's HTML comes from the server and is shown only inside a fully
 * sandboxed frame (`sandbox=""`: no scripts, no forms, no access to this
 * page) — never written into the dashboard's own document.
 */
export function SummaryReportPreviewDialog({ kind, onClose }: { kind: ScheduledReportKind | null; onClose: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  // The report being shown; kept while the dialog closes so it does not flash empty.
  const [shown, setShown] = useState<ScheduledReportKind>("daily");
  const [state, setState] = useState<{ loading: boolean; error: unknown; data: ScheduledReportPreview | null }>({
    loading: false,
    error: null,
    data: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!kind) return;
    let alive = true;
    setShown(kind);
    setState({ loading: true, error: null, data: null });
    scheduledReportPreview(apiClient, workspaceId, kind)
      .then((data) => alive && setState({ loading: false, error: null, data }))
      .catch((error: unknown) => alive && setState({ loading: false, error, data: null }));
    return () => {
      alive = false;
    };
  }, [kind, workspaceId, attempt]);

  const report = state.data?.report;

  return (
    <Modal
      open={kind !== null}
      onClose={onClose}
      title={t[`title_${shown}`]}
      description={t.description}
      className="max-w-2xl"
      footer={
        <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
          {t.close}
        </Button>
      }
    >
      <DataState loading={state.loading} error={state.error} onRetry={() => setAttempt((n) => n + 1)}>
        {state.data && report && (
          <div className="space-y-3">
            <dl className="space-y-1 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-ink-soft">{t.subject}:</dt>
                <dd className="min-w-0 font-medium text-ink">
                  <bdi>{state.data.email.subject}</bdi>
                </dd>
              </div>
              <div className="text-xs text-ink-soft">
                {report.fromDay === report.lastDay
                  ? fmt(t.coversDay, { day: dayLabel(report.fromDay) })
                  : fmt(t.covers, { from: dayLabel(report.fromDay), to: dayLabel(report.lastDay) })}
              </div>
            </dl>
            <iframe
              title={t.frame}
              sandbox=""
              referrerPolicy="no-referrer"
              srcDoc={frameDocument(state.data.email.html)}
              className="h-[55dvh] w-full rounded-[var(--radius)] bg-white ring-1 ring-line"
            />
          </div>
        )}
      </DataState>
    </Modal>
  );
}
