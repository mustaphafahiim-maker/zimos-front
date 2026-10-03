import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { AdminAgent } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/forms";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { CodeFields, CommissionTotals } from "@/components/referrals";
import { describeDiscount, initialCodeForm, toCodeInput, type CodeFormState } from "@/lib/referrals";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import * as adminApi from "@/lib/adminApi";
import { formatBp } from "@/lib/format";
import { P } from "@/lib/permissions";

export function AgentsPage() {
  const toast = useToast();
  const { can } = useAuth();
  const { data, loading, error, refresh } = useAsync(() => adminApi.listAgents(), []);
  const [creating, setCreating] = useState(false);

  const agents = data?.agents ?? [];
  const defaultRateBp = data?.defaultCommissionRateBp ?? 3000;

  return (
    <div>
      <PageHeader
        title="Agents"
        description="Referral codes, the merchants who used them, and the commission each payment suggests."
        actions={
          can(P.AGENTS_MANAGE) && (
            <Button onClick={() => setCreating(true)}>
              <UserPlus /> New agent
            </Button>
          )
        }
      />

      <Alert className="mb-4">
        Commission is tracking only: Zimos never pays an agent. Each payment a referred merchant makes suggests{" "}
        {formatBp(defaultRateBp)} of what they paid (or the code&rsquo;s own rate), and someone marks it paid by hand
        once they&rsquo;ve paid it.
      </Alert>

      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {agents.length === 0 ? (
          <EmptyBlock message="No agents yet." />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>Agent</Th>
                  <Th>Codes</Th>
                  <Th className="text-end">Merchants</Th>
                  <Th>Suggested commission</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <AgentRow key={agent.id} agent={agent} />
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </DataState>

      {creating && (
        <CreateAgentModal
          defaultRateBp={defaultRateBp}
          onClose={() => setCreating(false)}
          onCreated={(email) => {
            toast.success(`${email} is now an agent.`);
            setCreating(false);
            void refresh({ silent: true });
          }}
        />
      )}
    </div>
  );
}

function AgentRow({ agent }: { agent: AdminAgent }) {
  return (
    <TableRow>
      <Td className="align-top">
        <Link to={`/agents/${agent.id}`} className="font-medium hover:text-primary hover:underline">
          {agent.fullName}
        </Link>
        {!agent.isAgent && (
          <StatusBadge tone="neutral" className="ms-2">
            No longer an agent
          </StatusBadge>
        )}
        <span className="block text-xs text-ink-soft">{agent.email}</span>
      </Td>
      <Td className="align-top">
        {agent.codes.length === 0 ? (
          <span className="text-sm text-ink-soft">No codes</span>
        ) : (
          <ul className="space-y-1.5">
            {agent.codes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Mono>{c.code}</Mono>
                {c.label && <span className="text-ink-soft">{c.label}</span>}
                <span className="text-xs text-ink-soft">{describeDiscount(c)}</span>
                <span className="text-xs text-ink-soft">
                  · {c.merchantsReferred} merchant{c.merchantsReferred === 1 ? "" : "s"}
                </span>
                {!c.active && <StatusBadge tone="neutral">Inactive</StatusBadge>}
              </li>
            ))}
          </ul>
        )}
      </Td>
      <Td className="text-end align-top text-sm">{agent.merchantsReferred}</Td>
      <Td className="align-top">
        <CommissionTotals totals={agent.commission} empty="No payments yet" />
      </Td>
    </TableRow>
  );
}

function CreateAgentModal({
  defaultRateBp,
  onClose,
  onCreated,
}: {
  defaultRateBp: number;
  onClose: () => void;
  onCreated: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [withCode, setWithCode] = useState(true);
  const [code, setCode] = useState<CodeFormState>(() => initialCodeForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let firstCode;
    try {
      firstCode = withCode ? { ...toCodeInput(code, { includeCode: true }), code: code.code.trim().toUpperCase() } : undefined;
    } catch (err) {
      setError(getErrorMessage(err));
      return;
    }
    setBusy(true);
    try {
      await adminApi.createAgent({ email: email.trim(), firstCode });
      onCreated(email.trim());
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="New agent"
      description="The person needs an active Zimos account first — there are no invitations. They'll sign in here and see only their own codes and commissions."
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="agent-form"
            disabled={busy || !email.trim() || (withCode && code.code.trim().length < 3)}
          >
            {busy ? "Creating…" : "Create agent"}
          </Button>
        </>
      }
    >
      <form id="agent-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <TextField
          label="Account email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Toggle
          label="Add their first referral code now"
          description="You can add more codes later, for example one per area."
          checked={withCode}
          onChange={setWithCode}
        />
        {withCode && <CodeFields form={code} setForm={setCode} creating defaultRateBp={defaultRateBp} />}
      </form>
    </Modal>
  );
}
