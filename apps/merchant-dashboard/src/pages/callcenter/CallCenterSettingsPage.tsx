import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import { Info } from "lucide-react";
import type { CallCenterSettings } from "@/mock/types2";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";

type Provider = CallCenterSettings["voipProvider"];

const PROVIDER_LABEL: Record<Provider, string> = {
  none: "None (manual dialing)",
  twilio: "Twilio",
  maqsam: "Maqsam",
  ziwo: "Ziwo",
};

const PROVIDER_FIELDS: Record<Exclude<Provider, "none">, Array<{ key: string; label: string; secret: boolean }>> = {
  twilio: [
    { key: "accountSid", label: "Account SID", secret: false },
    { key: "authToken", label: "Auth token", secret: true },
    { key: "callerId", label: "Caller ID number", secret: false },
  ],
  maqsam: [
    { key: "accessKey", label: "Access key", secret: false },
    { key: "accessSecret", label: "Access secret", secret: true },
  ],
  ziwo: [
    { key: "instance", label: "Instance URL", secret: false },
    { key: "apiKey", label: "API key", secret: true },
  ],
};

export function CallCenterSettingsPage() {
  const workspaceId = useWorkspaceId();
  const settings = useAsync(() => mockApi.getCallCenterSettings(workspaceId), [workspaceId]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Call center settings" description="How and when the team calls to confirm cash-on-delivery orders." back={{ to: "/call-center", label: "Call center" }} />
      <DataState loading={settings.loading} error={settings.error} onRetry={() => settings.refresh()}>
        {settings.data && <SettingsForm key={workspaceId} initial={settings.data} onSaved={(s) => settings.setData(s)} />}
      </DataState>
    </div>
  );
}

function SettingsForm({ initial, onSaved }: { initial: CallCenterSettings; onSaved: (s: CallCenterSettings) => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [form, setForm] = useState<CallCenterSettings>(initial);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);

  function patch(p: Partial<CallCenterSettings>) {
    setForm((f) => ({ ...f, ...p }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.maxAttempts < 1 || form.maxAttempts > 10) return setError("Max attempts must be between 1 and 10.");
    if (form.retryAfterMinutes < 5) return setError("Retry delay must be at least 5 minutes.");
    if (form.whatsappFallbackAfterAttempt < 0 || form.whatsappFallbackAfterAttempt > form.maxAttempts) return setError("WhatsApp fallback attempt must be between 0 and max attempts.");
    if (form.workingHours.from >= form.workingHours.to) return setError("Working hours must end after they start.");
    setError(null);
    setSaving(true);
    try {
      await mockApi.saveCallCenterSettings(workspaceId, form);
      onSaved(form);
      toast.success("Call center settings saved.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const providerFields = form.voipProvider === "none" ? [] : PROVIDER_FIELDS[form.voipProvider];

  return (
    <form onSubmit={submit} className="space-y-6">
      <Alert variant="info" className="border-primary/30 bg-primary-soft/40">
        <Info />
        <div>
          <p className="font-medium text-ink">How confirmation flows</p>
          <p className="text-sm text-ink-soft">
            New COD order → WhatsApp message asks the customer to reply <span className="font-mono">1</span> → no reply within {form.retryAfterMinutes} min → order enters the call queue → up to{" "}
            {form.maxAttempts} call attempts (retry every {form.retryAfterMinutes} min inside working hours) → {form.autoCancelAfterAttempts ? "auto-cancelled" : "flagged for review"} after the last
            attempt.
          </p>
        </div>
      </Alert>

      {error && <Alert variant="danger">{error}</Alert>}

      <Section title="Attempts & retries" description="How hard the team tries before giving up on an order.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Max attempts" type="number" min={1} max={10} value={form.maxAttempts} onChange={(e) => patch({ maxAttempts: Number(e.target.value) })} hint="Calls before the order is closed." />
          <TextField label="Retry after (minutes)" type="number" min={5} step={5} value={form.retryAfterMinutes} onChange={(e) => patch({ retryAfterMinutes: Number(e.target.value) })} hint="Wait between attempts when no answer." />
        </div>
        <Toggle
          checked={form.autoCancelAfterAttempts}
          onChange={(v) => patch({ autoCancelAfterAttempts: v })}
          label="Auto-cancel after max attempts"
          description="Off: the order is flagged for a manager instead of cancelled."
          className="mt-4"
        />
      </Section>

      <Section title="Working hours" description="Calls are only scheduled inside this window (Africa/Cairo).">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From">{({ id }) => <Input id={id} type="time" value={form.workingHours.from} onChange={(e) => patch({ workingHours: { ...form.workingHours, from: e.target.value } })} />}</Field>
          <Field label="To">{({ id }) => <Input id={id} type="time" value={form.workingHours.to} onChange={(e) => patch({ workingHours: { ...form.workingHours, to: e.target.value } })} />}</Field>
        </div>
      </Section>

      <Section title="WhatsApp fallback" description="Send a WhatsApp confirmation template when calls are not getting through.">
        <TextField
          label="Send WhatsApp after attempt"
          type="number"
          min={0}
          max={form.maxAttempts}
          value={form.whatsappFallbackAfterAttempt}
          onChange={(e) => patch({ whatsappFallbackAfterAttempt: Number(e.target.value) })}
          hint="0 = send before the first call. Requires a connected WhatsApp number."
          className="sm:max-w-xs"
        />
      </Section>

      <Section title="VoIP provider" description="Connect a provider to click-to-call from the workstation and record calls.">
        <Field label="Provider" className="sm:max-w-xs">
          {({ id }) => (
            <Select id={id} value={form.voipProvider} onChange={(e) => patch({ voipProvider: e.target.value as Provider })}>
              {(Object.keys(PROVIDER_LABEL) as Provider[]).map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABEL[p]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {providerFields.length > 0 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {providerFields.map((f) => (
              <TextField
                key={`${form.voipProvider}-${f.key}`}
                label={f.label}
                type={f.secret ? "password" : "text"}
                autoComplete="off"
                value={creds[`${form.voipProvider}.${f.key}`] ?? ""}
                onChange={(e) => setCreds((c) => ({ ...c, [`${form.voipProvider}.${f.key}`]: e.target.value }))}
                className="font-mono"
              />
            ))}
            <p className="text-xs text-ink-soft sm:col-span-2">Prototype: credentials are kept in this browser session only and are not sent anywhere.</p>
          </div>
        )}
        <Toggle
          checked={form.recordCalls}
          onChange={(v) => patch({ recordCalls: v })}
          label="Record calls"
          description="Recordings appear in Call logs. Requires a VoIP provider."
          disabled={form.voipProvider === "none"}
          className="mt-4"
        />
      </Section>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => setForm(initial)}>
          Reset
        </Button>
        <Button type="submit" disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-5">
      <h2 className="font-display text-base font-medium text-ink">{title}</h2>
      {description && <p className="mb-4 mt-0.5 text-xs text-ink-soft">{description}</p>}
      {children}
    </section>
  );
}
