/**
 * Courier statement import and money held by couriers (backend:
 * src/modules/settlements/settlementStatementService.js).
 *
 * Mounted at /workspaces/:workspaceId/settlements. Reads need
 * financial_reports.view, the import needs refunds.manage (like every
 * settlement write). All exported names in this file are prefixed with
 * `statement` / `Statement`.
 *
 * The statement is sent as the courier's own file — Excel (.xlsx, its first
 * sheet) or CSV, base64 in `fileBase64` with its `fileName`, at most 1 MB —
 * or as CSV text (`csv`). It needs a waybill column and a collected-amount
 * column; a fee column is optional. Title lines above the table and a totals
 * line under it are skipped. Amounts in the file are major units; every
 * amount in the answers is integer minor units.
 */
import type { ApiClient } from "../client";

export type StatementLineStatus =
  | "ok"
  | "amount_mismatch"
  | "already_settled"
  | "not_settleable"
  | "not_found"
  | "duplicate"
  | "invalid";

export interface StatementLine {
  /** Line in the file (the header is line 1). */
  line: number;
  waybill: string;
  statementAmount: number | null;
  feeAmount: number;
  status: StatementLineStatus;
  orderId?: string;
  orderNumber?: string | null;
  customerName?: string | null;
  shipmentStatus?: string;
  dueAmount?: number;
  /** Statement amount − amount due (negative: the courier paid less). */
  differenceAmount?: number;
}

export interface StatementMissingOrder {
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  waybill: string | null;
  carrierCode: string;
  deliveredAt: string | null;
  dueAmount: number;
}

export interface StatementSummary {
  rows: number;
  ok: number;
  amountMismatch: number;
  alreadySettled: number;
  notSettleable: number;
  notFound: number;
  duplicate: number;
  invalid: number;
  statementAmount: number;
  matchedDueAmount: number;
  differenceAmount: number;
  /** Delivered, unsettled orders of the courier the statement leaves out. */
  missingOrders: number;
  missingAmount: number;
}

export interface StatementReport {
  carrierCode: string | null;
  currency: string;
  summary: StatementSummary;
  lines: StatementLine[];
  missingFromStatement: StatementMissingOrder[];
}

/** The statement: the courier's file (base64, .xlsx or .csv) or CSV text. */
export type StatementSource = { csv: string; fileBase64?: never; fileName?: never } | { fileBase64: string; fileName?: string; csv?: never };

export type StatementImportPayload = StatementSource & {
  carrierCode: string;
  reference?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  notes?: string | null;
};

export interface StatementHeldCarrier {
  carrierCode: string;
  orders: number;
  dueAmount: number;
  oldestDeliveredAt: string | null;
  /** Amount by days since delivery. */
  buckets: { upTo7: number; upTo14: number; over14: number };
}

export interface StatementHeld {
  currency: string;
  totalAmount: number;
  totalOrders: number;
  carriers: StatementHeldCarrier[];
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/settlements`;

/** Matches a statement without saving anything. */
export async function statementMatch(
  client: ApiClient,
  workspaceId: string,
  payload: StatementSource & { carrierCode?: string }
): Promise<StatementReport> {
  const { report } = await client.request<{ report: StatementReport }>(`${base(workspaceId)}/statement/match`, {
    method: "POST",
    body: payload,
  });
  return report;
}

/** Creates a draft settlement from the statement's matching rows; returns its id. */
export async function statementImport(
  client: ApiClient,
  workspaceId: string,
  payload: StatementImportPayload
): Promise<{ settlementId: string; report: StatementReport }> {
  const result = await client.request<{ settlement: { id: string }; report: StatementReport }>(
    `${base(workspaceId)}/statement/import`,
    { method: "POST", body: payload }
  );
  return { settlementId: result.settlement.id, report: result.report };
}

export async function statementGetHeld(client: ApiClient, workspaceId: string): Promise<StatementHeld> {
  const { held } = await client.request<{ held: StatementHeld }>(`${base(workspaceId)}/held`);
  return held;
}
