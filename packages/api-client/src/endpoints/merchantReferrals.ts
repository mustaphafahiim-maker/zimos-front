/**
 * ZIMOS's referral program for merchants (backend referrals/merchantReferrals.js).
 *
 *   GET  /me/referrals                 the program, the person's code, sign-ups, earnings, payout requests
 *   POST /me/referrals/join            409 REFERRAL_PROGRAM_CLOSED until ZIMOS opens it
 *   POST /me/referrals/payouts         { method, details } — 409 PAYOUT_ALREADY_REQUESTED / NOTHING_TO_PAY
 *   GET/PUT /admin/referral-program    the share (agents.view / agents.manage) and the requests
 *   POST /admin/referral-program/payouts/:id/(paid|rejected)   commissions.mark_paid
 */
import type { ApiClient } from "../client";

export interface ReferralProgram {
  open: boolean;
  /** Basis points: 2000 = 20%. Null until ZIMOS decides it. */
  rateBp: number | null;
  configured: boolean;
}

export type ReferralPayoutMethod = "vodafone_cash" | "instapay" | "bank_transfer";

export interface ReferralPayout {
  id: string;
  amounts: { currency: string; amount: number }[];
  method: ReferralPayoutMethod;
  details: string;
  status: "requested" | "paid" | "rejected";
  note: string | null;
  handledAt: string | null;
  createdAt: string;
}

export interface MerchantReferrals {
  program: ReferralProgram;
  code: { code: string; rateBp: number | null; active: boolean; link: string; createdAt: string } | null;
  signups?: number;
  totals?: { currency: string; pending: number; markedPaid: number; amountPaid: number; payments: number }[];
  earnings?: { paidAt: string; amountPaid: number; currency: string; commission: number; status: "pending" | "marked_paid" | "voided" }[];
  payouts?: ReferralPayout[];
}

export function merchantReferralsGet(client: ApiClient): Promise<MerchantReferrals> {
  return client.request<MerchantReferrals>("/me/referrals");
}

export function merchantReferralsJoin(client: ApiClient): Promise<MerchantReferrals> {
  return client.request<MerchantReferrals>("/me/referrals/join", { method: "POST" });
}

export function merchantReferralsRequestPayout(client: ApiClient, body: { method: ReferralPayoutMethod; details: string }): Promise<MerchantReferrals> {
  return client.request<MerchantReferrals>("/me/referrals/payouts", { method: "POST", body });
}

export interface AdminReferralProgram {
  program: ReferralProgram;
  members: number;
  payouts: (ReferralPayout & { user: { id: string; fullName: string; email: string } | null })[];
}

export function adminReferralProgramGet(client: ApiClient): Promise<AdminReferralProgram> {
  return client.request<AdminReferralProgram>("/admin/referral-program");
}

export async function adminReferralProgramSave(client: ApiClient, body: { open: boolean; rateBp: number | null }): Promise<ReferralProgram> {
  const { program } = await client.request<{ program: ReferralProgram }>("/admin/referral-program", { method: "PUT", body });
  return program;
}

export async function adminReferralPayoutHandle(client: ApiClient, payoutId: string, outcome: "paid" | "rejected", note?: string): Promise<ReferralPayout> {
  const { payout } = await client.request<{ payout: ReferralPayout }>(`/admin/referral-program/payouts/${payoutId}/${outcome}`, { method: "POST", body: { note: note || null } });
  return payout;
}
