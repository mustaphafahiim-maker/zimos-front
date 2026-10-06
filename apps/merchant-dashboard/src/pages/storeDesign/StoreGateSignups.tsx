import { useState } from "react";
import { Download, Mail } from "lucide-react";
import { Button } from "@store-builder/ui";
import { storeGateSignups, type StoreGateSignup } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDateTime } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Section } from "@/components/Section";

const STRINGS = {
  en: {
    title: "Sign-ups",
    description: "Visitors who asked to hear when you open — from the coming-soon page and the password page.",
    count_one: "1 sign-up",
    count_other: "{n} sign-ups",
    email: "Email",
    language: "Language",
    signedUp: "Signed up",
    notified: "Emailed",
    ar: "Arabic",
    en: "English",
    fr: "French",
    unknown: "—",
    download: "Download CSV",
    showAll: "Show all",
    emptyTitle: "No sign-ups yet",
    emptyBody: "While your store shows the coming-soon or password page, visitors can leave their email, and it shows here.",
  },
  ar: {
    title: "التسجيلات",
    description: "الزوار اللي طلبوا نبلغهم لما تفتح — من صفحة «قريبًا» وصفحة الباسورد.",
    count_one: "تسجيل واحد",
    count_two: "تسجيلين",
    count_few: "{n} تسجيلات",
    count_other: "{n} تسجيل",
    email: "الإيميل",
    language: "اللغة",
    signedUp: "سجّل في",
    notified: "اتبعتله",
    ar: "عربي",
    en: "إنجليزي",
    fr: "فرنساوي",
    unknown: "—",
    download: "نزّل ملف CSV",
    showAll: "اعرض الكل",
    emptyTitle: "مفيش تسجيلات لسه",
    emptyBody: "لما متجرك يكون على صفحة «قريبًا» أو صفحة الباسورد، الزوار يقدروا يسيبوا إيميلهم وهيظهر هنا.",
  },
} satisfies Messages;

/** Rows shown before «اعرض الكل»: a long list stays one tap away, not one long page. */
const FIRST = 20;

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function downloadCsv(rows: readonly StoreGateSignup[]) {
  const lines = [
    "email,locale,created_at,notified_at",
    ...rows.map((r) => [r.email, r.locale ?? "", r.createdAt, r.notifiedAt ?? ""].map(csvCell).join(",")),
  ];
  // A BOM so spreadsheet apps read the file as UTF-8.
  const url = URL.createObjectURL(new Blob([`﻿${lines.join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `store-sign-ups-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Store settings → Store access → Sign-ups (frontend-handoff 197): the emails
 * visitors left on the coming-soon or password page, newest first, with a
 * CSV download. Same permission as the gate (website.publish).
 */
export function StoreGateSignups() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const list = useAsync(() => storeGateSignups(apiClient, workspaceId), [workspaceId]);
  const [all, setAll] = useState(false);
  const rows = list.data?.signups ?? [];
  const total = list.data?.total ?? rows.length;
  const shown = all ? rows : rows.slice(0, FIRST);

  const columns: Column<StoreGateSignup>[] = [
    {
      key: "email",
      header: t.email,
      cell: (r) => (
        <bdi dir="ltr" className="font-medium text-ink">
          {r.email}
        </bdi>
      ),
    },
    { key: "language", header: t.language, cell: (r) => (r.locale ? t[r.locale] : t.unknown), phoneSkip: (r) => !r.locale },
    { key: "createdAt", header: t.signedUp, cell: (r) => formatDateTime(r.createdAt) },
  ];
  // Only once someone was emailed (the "we're open" email): until then the column would be all dashes.
  if (rows.some((r) => r.notifiedAt)) {
    columns.push({ key: "notifiedAt", header: t.notified, cell: (r) => formatDateTime(r.notifiedAt), phoneSkip: (r) => !r.notifiedAt });
  }

  return (
    <Section
      title={total > 0 ? fmt("{title} ({n})", { title: t.title, n: total }) : t.title}
      description={t.description}
      actions={
        rows.length > 0 && (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => downloadCsv(rows)}>
            <Download className="size-4" aria-hidden />
            {t.download}
          </Button>
        )
      }
    >
      <DataState loading={list.loading && !list.data} error={list.error} onRetry={() => void list.refresh()}>
        {rows.length === 0 ? (
          <EmptyState icon={<Mail aria-hidden />} title={t.emptyTitle} description={t.emptyBody} />
        ) : (
          <div className="space-y-3">
            <DataTable columns={columns} rows={shown} rowKey={(r) => r.email} />
            {!all && rows.length > FIRST && (
              <div className="flex justify-center">
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setAll(true)}>
                  {`${t.showAll} (${pluralOf(t, "count", rows.length)})`}
                </Button>
              </div>
            )}
          </div>
        )}
      </DataState>
    </Section>
  );
}
