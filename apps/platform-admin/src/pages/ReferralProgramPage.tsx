import { useEffect, useState } from "react";
import { Button, Input, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import {
  adminReferralPayoutHandle,
  adminReferralProgramGet,
  adminReferralProgramSave,
  type AdminReferralProgram,
} from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Panel, Td, Th } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, formatMinorMoney } from "@/lib/format";
import { P } from "@/lib/permissions";
import { useAsync } from "@/lib/useAsync";

const METHOD_LABEL = { vodafone_cash: "Vodafone Cash", instapay: "InstaPay", bank_transfer: "Bank transfer" } as const;
const STATUS_TONE = { requested: "warning", paid: "success", rejected: "neutral" } as const;

/**
 * ZIMOS's referral program for merchants (SPEC §20.4): whether it is open and
 * the share merchants earn — a decision, so it lives here and not in code —
 * and the payout requests to pay by hand. Marking one paid marks the
 * merchant's commission rows owed at the time of the request as paid.
 */
export function ReferralProgramPage() {
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, error, refresh, setData } = useAsync(() => adminReferralProgramGet(apiClient), []);
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setOpen(data.program.open);
    setRate(data.program.rateBp === null ? "" : String(data.program.rateBp / 100));
  }, [data]);

  async function save() {
    const value = rate.trim() === "" ? null : Math.round(Number(rate) * 100);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 10000)) return toast.error("The share is a percentage between 0 and 100.");
    setBusy("save");
    try {
      const program = await adminReferralProgramSave(apiClient, { open, rateBp: value });
      if (data) setData({ ...data, program });
      toast.success(program.open ? "The referral program is open." : "Referral program saved — closed to new members.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handle(id: string, outcome: "paid" | "rejected") {
    setBusy(id);
    try {
      await adminReferralPayoutHandle(apiClient, id, outcome);
      toast.success(outcome === "paid" ? "Marked paid." : "Request declined.");
      void refresh({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const payouts: AdminReferralProgram["payouts"] = data?.payouts ?? [];
  return (
    <div>
      <PageHeader
        title="Referral program"
        description="Merchants who bring other merchants earn a share of what those stores pay ZIMOS. Their earnings are in the commission ledger, under their name on the Agents page."
      />
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && (
          <div className="space-y-4">
            <Panel title="Program" description={`${data.members} merchant${data.members === 1 ? "" : "s"} joined.`}>
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-ink">
                  <input type="checkbox" checked={open} disabled={!can(P.AGENTS_MANAGE)} onChange={(e) => setOpen(e.target.checked)} />
                  Open to new members
                </label>
                <label className="text-sm text-ink">
                  <span className="mb-1 block font-medium">Merchants' share (%)</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    inputMode="decimal"
                    className="w-32"
                    value={rate}
                    disabled={!can(P.AGENTS_MANAGE)}
                    onChange={(e) => setRate(e.target.value)}
                  />
                </label>
                {can(P.AGENTS_MANAGE) && (
                  <Button disabled={busy === "save"} onClick={() => void save()}>
                    {busy === "save" ? "Saving…" : "Save"}
                  </Button>
                )}
              </div>
              <p className="mt-2 text-xs text-ink-soft">
                Nobody can join until a share is set and the program is open. A new share applies to merchants who join after it; existing
                codes keep the share they were given.
              </p>
            </Panel>

            <Panel title="Payout requests" flush>
              {payouts.length === 0 ? (
                <EmptyBlock message="No payout requests yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <Th>Merchant</Th>
                      <Th>Owed when asked</Th>
                      <Th>Send by</Th>
                      <Th>Asked</Th>
                      <Th>Status</Th>
                      <Th />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((p) => (
                      <TableRow key={p.id} className="align-top">
                        <Td>
                          <span className="font-medium">{p.user?.fullName ?? "—"}</span>
                          <p className="text-xs text-ink-soft">{p.user?.email}</p>
                        </Td>
                        <Td className="tabular">{p.amounts.map((a) => formatMinorMoney(a.amount, a.currency)).join(" + ")}</Td>
                        <Td>
                          {METHOD_LABEL[p.method]}
                          <p dir="ltr" className="font-mono text-xs text-ink-soft">
                            {p.details}
                          </p>
                        </Td>
                        <Td>{formatDateTime(p.createdAt)}</Td>
                        <Td>
                          <StatusBadge tone={STATUS_TONE[p.status]}>{p.status}</StatusBadge>
                        </Td>
                        <Td className="text-end">
                          {p.status === "requested" && can(P.COMMISSIONS_MARK_PAID) && (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" disabled={busy === p.id} onClick={() => void handle(p.id, "paid")}>
                                Mark paid
                              </Button>
                              <Button size="sm" variant="ghost" disabled={busy === p.id} onClick={() => void handle(p.id, "rejected")}>
                                Decline
                              </Button>
                            </div>
                          )}
                        </Td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Panel>
          </div>
        )}
      </DataState>
    </div>
  );
}
