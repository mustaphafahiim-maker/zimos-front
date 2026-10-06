import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import { exportFileDownload, exportFileGet } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";

const STRINGS = {
  en: {
    title: "Exported file",
    back: "Orders",
    orders: "Orders export",
    s_queued: "Waiting",
    s_running: "Being prepared",
    s_done: "Ready",
    s_failed: "Failed",
    s_expired: "Removed",
    working: "The file is being prepared. This page updates on its own, and you'll get a notification when it's ready.",
    ready: "{size} · kept until {date}",
    failed: "The file couldn't be prepared. Export again from the orders list, or narrow the filters.",
    expired: "Files are kept for 7 days. Export again from the orders list.",
    download: "Download",
    downloading: "Downloading…",
  },
  ar: {
    title: "ملف مُصدَّر",
    back: "الطلبات",
    orders: "تصدير الطلبات",
    s_queued: "في الانتظار",
    s_running: "بنجهّز",
    s_done: "جاهز",
    s_failed: "تعذّر",
    s_expired: "حُذف",
    working: "بنجهّز الملف. تتحدّث هذه الصفحة تلقائيًا، وسيصلك إشعار عندما يجهز.",
    ready: "{size} · متاح حتى {date}",
    failed: "تعذّر تجهيز الملف. صدّر مرة أخرى من قائمة الطلبات، أو ضيّق الفلاتر.",
    expired: "تُحفظ الملفات 7 أيام. صدّر مرة أخرى من قائمة الطلبات.",
    download: "تنزيل",
    downloading: "بننزّل…",
  },
} satisfies Messages;

const TONE = {
  queued: "neutral",
  running: "info",
  done: "success",
  failed: "danger",
  expired: "neutral",
} as const;

function sizeLabel(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Where an `export.ready` notification leads: the file's state and its download. */
export function ExportFilePage() {
  const t = useT(STRINGS);
  const { exportId = "" } = useParams();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const file = useAsync(() => exportFileGet(apiClient, workspaceId, exportId), [workspaceId, exportId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = file.data;
  const working = data ? data.status === "queued" || data.status === "running" : false;
  const { refresh } = file;
  // Live while the queue builds it.
  useEffect(() => {
    if (!working) return;
    const id = window.setInterval(() => void refresh({ silent: true }), 2000);
    return () => window.clearInterval(id);
  }, [working, refresh]);

  async function download() {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await exportFileDownload(apiClient, workspaceId, data.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.fileName ?? `export.${data.format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err));
      void refresh({ silent: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={data?.fileName ?? t.title}
        back={{ to: "/orders", label: t.back }}
        description={data ? t.orders : undefined}
        actions={
          data?.status === "done" ? (
            <Button className="min-h-11" onClick={download} disabled={busy}>
              <Download className="size-4" aria-hidden />
              {busy ? t.downloading : t.download}
            </Button>
          ) : undefined
        }
      />
      <DataState loading={file.loading && !data} error={file.error} onRetry={() => void file.refresh()}>
        {data && (
          <div className="space-y-4">
            {error && (
              <Alert variant="danger" role="alert">
                {error}
              </Alert>
            )}
            <div>
              <StatusBadge value={data.status} tone={TONE[data.status]} text={t[`s_${data.status}`]} />
            </div>
            {working && <p className="text-sm text-ink-soft">{t.working}</p>}
            {data.status === "done" && (
              <p className="text-sm text-ink-soft">
                {fmt(t.ready, { size: sizeLabel(data.sizeBytes), date: formatDateTime(data.expiresAt) })}
              </p>
            )}
            {data.status === "failed" && <p className="text-sm text-ink-soft">{t.failed}</p>}
            {data.status === "expired" && <p className="text-sm text-ink-soft">{t.expired}</p>}
          </div>
        )}
      </DataState>
    </div>
  );
}
