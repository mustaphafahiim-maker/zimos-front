/**
 * Scheduled summary reports (backend src/modules/scheduledReports).
 *
 * A daily and/or weekly email to chosen team members with the dashboard
 * home's numbers against the period before — sales, orders, average order,
 * confirmation rate, delivery rate, new customers, lost orders, net profit —
 * and the top 5 products. Sent at the chosen hour in the store's time zone,
 * once per period, in each member's dashboard language. Daily covers
 * yesterday (store time); weekly covers the 7 days before the send day.
 *
 * /workspaces/:ws/scheduled-reports:
 *   GET  /                 (analytics.view)   → ScheduledReportSettings
 *   PUT  /                 (workspace.manage) ScheduledReportSettingsPayload → ScheduledReportSettings
 *        422 VALIDATION_ERROR on `recipientUserIds`: a recipient who is not an
 *        active member with analytics access, or a report on with nobody chosen.
 *   GET  /preview?kind=    (analytics.view)   → ScheduledReportPreview
 *   POST /send-test {kind} (analytics.view)   → { sent, email } — now, to the signed-in member only
 */
import type { ApiClient } from "../client";

export type ScheduledReportKind = "daily" | "weekly";

/** A member who may get the report: active, can see analytics, has an email. */
export interface ScheduledReportMember {
  userId: string;
  email: string;
  fullName: string | null;
  /** Their dashboard language; the report is written in it. */
  locale: string | null;
}

/** One report that went out (the last 10 are listed, newest first). */
export interface ScheduledReportDelivery {
  kind: ScheduledReportKind;
  /** The store-local send day, "2026-10-07". */
  periodKey: string;
  /** How many members it was emailed to. */
  sentCount: number;
  sentAt: string;
}

export interface ScheduledReportSchedule {
  daily: { enabled: boolean; /** 0–23, store time. */ hour: number };
  weekly: { enabled: boolean; /** 0 Sunday … 6 Saturday. */ weekday: number; /** 0–23, store time. */ hour: number };
  /** At most 50, each one of `members`. */
  recipientUserIds: string[];
}

export interface ScheduledReportSettings extends ScheduledReportSchedule {
  /** The store's IANA time zone, e.g. "Africa/Cairo": the hours above are on this clock. */
  timeZone: string;
  /** The only members who can be chosen. */
  members: ScheduledReportMember[];
  lastSent: ScheduledReportDelivery[];
}

export type ScheduledReportSettingsPayload = ScheduledReportSchedule;

export interface ScheduledReportMetric {
  key: string;
  type: "money" | "count" | "rate";
  label: { en: string; ar: string };
  /** Money in minor units; a rate in %. */
  value: number | null;
  previous: number | null;
  /** Money and counts: the change in %. */
  changePercent: number | null;
  /** Rates: the change in points. */
  changePoints: number | null;
}

export interface ScheduledReport {
  kind: ScheduledReportKind;
  /** The store-local days covered, inclusive ("2026-10-06"). */
  fromDay: string;
  lastDay: string;
  currency: string;
  metrics: ScheduledReportMetric[];
  topProducts: Array<{ productId: string; name: string; quantity: number; sales: number }>;
}

export interface ScheduledReportPreview {
  report: ScheduledReport;
  /** The email as the signed-in member would get it. Show `html` only inside a sandboxed frame. */
  email: { subject: string; html: string; text: string };
}

/** Most recipients a store can choose. */
export const SCHEDULED_REPORT_MAX_RECIPIENTS = 50;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/scheduled-reports`;

export function scheduledReportsGet(client: ApiClient, workspaceId: string): Promise<ScheduledReportSettings> {
  return client.request<ScheduledReportSettings>(base(workspaceId));
}

export function scheduledReportsSave(
  client: ApiClient,
  workspaceId: string,
  body: ScheduledReportSettingsPayload
): Promise<ScheduledReportSettings> {
  return client.request<ScheduledReportSettings>(base(workspaceId), { method: "PUT", body });
}

export function scheduledReportPreview(client: ApiClient, workspaceId: string, kind: ScheduledReportKind): Promise<ScheduledReportPreview> {
  return client.request<ScheduledReportPreview>(`${base(workspaceId)}/preview?kind=${kind}`);
}

/** Emails the report now to the signed-in member only; `sent` is false when the email could not go out. */
export function scheduledReportSendTest(
  client: ApiClient,
  workspaceId: string,
  kind: ScheduledReportKind
): Promise<{ sent: boolean; email: string }> {
  return client.request(`${base(workspaceId)}/send-test`, { method: "POST", body: { kind } });
}
