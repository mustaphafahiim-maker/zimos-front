import { useMemo, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import { Bot, ExternalLink, MessageCircle, Pencil, Plus, Send, Trash2 } from "lucide-react";
import type { WaBotRule, WaBotSettings } from "@/mock/types2";
import { mockApi } from "@/mock/api";
import { uid } from "@/mock/store";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Toggle } from "@/components/Toggle";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

const MATCH_LABEL: Record<WaBotRule["match"], string> = {
  reply_1: "Reply 1",
  reply_2: "Reply 2",
  keyword: "Keyword",
  any: "Any message",
};

const MATCH_TONE: Record<WaBotRule["match"], string> = {
  reply_1: "bg-success-soft text-success",
  reply_2: "bg-danger-soft text-danger",
  keyword: "bg-primary-soft text-primary-dark",
  any: "bg-paper text-ink-soft border border-line",
};

const ACTION_LABEL: Record<WaBotRule["action"], string> = {
  confirm_order: "Confirm order",
  cancel_order: "Cancel order",
  send_tracking: "Send tracking",
  handoff_agent: "Hand off to agent",
  send_text: "Send text",
};

const ACTION_TONE: Record<WaBotRule["action"], string> = {
  confirm_order: "bg-success-soft text-success",
  cancel_order: "bg-danger-soft text-danger",
  send_tracking: "bg-primary-soft text-primary-dark",
  handoff_agent: "bg-accent-soft text-accent-dark",
  send_text: "bg-paper text-ink-soft border border-line",
};

const VARIABLES = ["{{customer.firstName}}", "{{order.number}}", "{{order.total}}", "{{shipment.carrier}}", "{{shipment.tracking}}"];

const SAMPLE: Record<string, string> = {
  "customer.firstName": "أحمد",
  "order.number": "#10482",
  "order.total": formatMoney(129900),
  "shipment.carrier": "Bosta",
  "shipment.tracking": "zg8F2K1",
};

function substitute(body: string): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => SAMPLE[key] ?? `{{${key}}}`);
}

/** The same matching order the backend would use: exact replies, then keywords, then the catch-all. */
export function matchRule(rules: WaBotRule[], text: string): WaBotRule | null {
  const t = text.trim();
  const enabled = rules.filter((r) => r.enabled);
  if (t === "1") {
    const r = enabled.find((x) => x.match === "reply_1");
    if (r) return r;
  }
  if (t === "2") {
    const r = enabled.find((x) => x.match === "reply_2");
    if (r) return r;
  }
  const kw = enabled.find((x) => x.match === "keyword" && x.keyword && t.toLowerCase().includes(x.keyword.toLowerCase()));
  if (kw) return kw;
  return enabled.find((x) => x.match === "any") ?? null;
}

export function WaBotPage() {
  const workspaceId = useWorkspaceId();
  const settings = useAsync(() => mockApi.getWaBot(workspaceId), [workspaceId]);

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="WhatsApp bot"
        description="Auto-confirm COD orders, answer tracking questions and hand off to a human when needed."
        back={{ to: "/inbox", label: "Inbox" }}
      />
      <DataState loading={settings.loading} error={settings.error} onRetry={() => settings.refresh()}>
        {settings.data && <BotEditor key={workspaceId} initial={settings.data} onSaved={(s) => settings.setData(s)} />}
      </DataState>
    </div>
  );
}

function BotEditor({ initial, onSaved }: { initial: WaBotSettings; onSaved: (s: WaBotSettings) => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [draft, setDraft] = useState<WaBotSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [editing, setEditing] = useState<{ rule: WaBotRule | null } | null>(null);
  const [deleting, setDeleting] = useState<WaBotRule | null>(null);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initial), [draft, initial]);

  function set<K extends keyof WaBotSettings>(key: K, value: WaBotSettings[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function upsertRule(rule: WaBotRule) {
    setDraft((d) => ({ ...d, rules: d.rules.some((r) => r.id === rule.id) ? d.rules.map((r) => (r.id === rule.id ? rule : r)) : [...d.rules, rule] }));
  }

  async function save() {
    setSaving(true);
    try {
      await mockApi.saveWaBot(workspaceId, draft);
      onSaved(draft);
      toast.success("Bot settings saved.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    const next = { ...draft, connected: false };
    setDraft(next);
    await mockApi.saveWaBot(workspaceId, next);
    onSaved(next);
    toast.success("WhatsApp number disconnected.");
  }

  async function connect() {
    const next = { ...draft, connected: true };
    setDraft(next);
    await mockApi.saveWaBot(workspaceId, next);
    onSaved(next);
    setConnectOpen(false);
    toast.success("WhatsApp Business connected.");
  }

  return (
    <div className="space-y-6">
      {/* Connection */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-[#25D366]/15 text-[#128C7E]">
            <MessageCircle className="size-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-ink">{draft.businessName}</p>
              {draft.connected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                  <span className="size-1.5 rounded-full bg-success" /> Connected
                </span>
              ) : (
                <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">Not connected</span>
              )}
            </div>
            <p className="font-mono text-xs text-ink-soft">{draft.connected ? draft.phoneNumber : "No number linked · Meta Cloud API"}</p>
          </div>
        </div>
        {draft.connected ? (
          <Button variant="outline" size="sm" onClick={disconnect}>
            Disconnect
          </Button>
        ) : (
          <Button size="sm" onClick={() => setConnectOpen(true)}>
            Connect WhatsApp Business
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Master toggles */}
          <div className="rounded-[var(--radius-card)] border border-line bg-paper-raised">
            <div className="border-b border-line px-4 py-3">
              <p className="text-sm font-medium text-ink">Behaviour</p>
            </div>
            <div className="space-y-4 p-4">
              <Toggle
                label="Auto confirmation"
                description="After every new order, send the “reply 1 to confirm / 2 to cancel” message and act on the reply."
                checked={draft.confirmationEnabled}
                onChange={(v) => set("confirmationEnabled", v)}
              />
              <Toggle label="Tracking replies" description="Answer “where is my order?” with the carrier and tracking number." checked={draft.trackingRepliesEnabled} onChange={(v) => set("trackingRepliesEnabled", v)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Handoff keyword" hint="When the customer writes this word, the bot stops and the chat goes to an agent." value={draft.handoffKeyword} onChange={(e) => set("handoffKeyword", e.target.value)} dir="auto" />
              </div>
              <Field label="Outside-hours reply" hint="Sent once when a customer writes outside 10:00–22:00.">
                {({ id }) => <Textarea id={id} rows={2} dir="auto" value={draft.outsideHoursReply} onChange={(e) => set("outsideHoursReply", e.target.value)} />}
              </Field>
            </div>
          </div>

          {/* Rules */}
          <div className="rounded-[var(--radius-card)] border border-line bg-paper-raised">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink">Rules</p>
                <p className="text-xs text-ink-soft">Checked top to bottom: exact replies first, then keywords, then the catch-all.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditing({ rule: null })}>
                <Plus /> Add rule
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                    <th className="px-4 py-2.5 font-medium">Rule</th>
                    <th className="px-4 py-2.5 font-medium">Match</th>
                    <th className="px-4 py-2.5 font-medium">Action</th>
                    <th className="px-4 py-2.5 font-medium">Response</th>
                    <th className="px-4 py-2.5 font-medium">Hits</th>
                    <th className="px-4 py-2.5 font-medium">On</th>
                    <th className="px-4 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {draft.rules.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0 hover:bg-paper">
                      <td className="px-4 py-2.5 font-medium text-ink" dir="auto">
                        {r.name}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", MATCH_TONE[r.match])}>{MATCH_LABEL[r.match]}</span>
                        {r.match === "keyword" && r.keyword && (
                          <span className="ml-1 font-mono text-xs text-ink" dir="auto">
                            “{r.keyword}”
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", ACTION_TONE[r.action])}>{ACTION_LABEL[r.action]}</span>
                      </td>
                      <td className="max-w-[260px] truncate px-4 py-2.5 text-ink-soft" dir="auto" title={r.responseText}>
                        {r.responseText}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-ink-soft">{r.hits.toLocaleString()}</td>
                      <td className="px-4 py-2.5">
                        <Toggle checked={r.enabled} onChange={(v) => upsertRule({ ...r, enabled: v })} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <Button size="icon-sm" variant="ghost" aria-label="Edit rule" onClick={() => setEditing({ rule: r })}>
                          <Pencil />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label="Delete rule" className="text-danger hover:bg-danger-soft" onClick={() => setDeleting(r)}>
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {draft.rules.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-soft">
                        No rules yet — the bot will stay silent.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>

        <Simulator rules={draft.rules} handoffKeyword={draft.handoffKeyword} />
      </div>

      {/* Connect modal */}
      <Modal open={connectOpen} onClose={() => setConnectOpen(false)} title="Connect WhatsApp Business" description="Zimos uses the official Meta Cloud API — no phone plugged into a laptop, no bans.">
        <ol className="space-y-3">
          {[
            ["Create a Meta Business account", "Or pick an existing one. Your store's Facebook page must belong to it."],
            ["Add a WhatsApp number", "A number not currently registered on the WhatsApp app. A new SIM works; landlines with SMS work too."],
            ["Approve the message templates", "Zimos submits the confirmation, tracking and review templates for you. Approval usually takes under an hour."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-medium text-primary-dark">{i + 1}</span>
              <div>
                <p className="text-sm font-medium text-ink">{t}</p>
                <p className="text-xs text-ink-soft">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        <Alert variant="info" className="mt-4 text-xs">
          Conversation pricing is billed by Meta directly (~0.5 EGP per confirmation conversation in Egypt). Zimos adds no markup.
        </Alert>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setConnectOpen(false)}>
            Cancel
          </Button>
          <Button onClick={connect} className="bg-[#1877F2] text-white hover:bg-[#1877F2]/85">
            <ExternalLink /> Continue with Facebook
          </Button>
        </div>
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.rule ? "Edit rule" : "Add rule"} className="max-w-2xl">
        {editing && (
          <RuleForm
            key={editing.rule?.id ?? "new"}
            existing={editing.rule}
            onCancel={() => setEditing(null)}
            onSave={(rule) => {
              upsertRule(rule);
              setEditing(null);
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Delete "${deleting.name}"?` : "Delete rule?"}
        description="The bot will stop responding to messages this rule matched. Remember to save afterwards."
        confirmLabel="Delete rule"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) setDraft((d) => ({ ...d, rules: d.rules.filter((r) => r.id !== deleting.id) }));
          setDeleting(null);
        }}
      />
    </div>
  );
}

// --------------------------------------------------------------- Rule form --

function RuleForm({ existing, onSave, onCancel }: { existing: WaBotRule | null; onSave: (r: WaBotRule) => void; onCancel: () => void }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [match, setMatch] = useState<WaBotRule["match"]>(existing?.match ?? "keyword");
  const [keyword, setKeyword] = useState(existing?.keyword ?? "");
  const [action, setAction] = useState<WaBotRule["action"]>(existing?.action ?? "send_text");
  const [responseText, setResponseText] = useState(existing?.responseText ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  function insertVariable(v: string) {
    const el = bodyRef.current;
    const start = el?.selectionStart ?? responseText.length;
    const end = el?.selectionEnd ?? responseText.length;
    const next = responseText.slice(0, start) + v + responseText.slice(end);
    setResponseText(next);
    if (el) {
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + v.length, start + v.length);
      });
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Give the rule a name.";
    if (match === "keyword" && !keyword.trim()) errs.keyword = "Enter the keyword to look for.";
    if (!responseText.trim()) errs.response = "Write the bot's reply.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({
      id: existing?.id ?? uid(),
      name: name.trim(),
      match,
      keyword: match === "keyword" ? keyword.trim() : null,
      action,
      responseText,
      enabled: existing?.enabled ?? true,
      hits: existing?.hits ?? 0,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="فين طلبي" dir="auto" autoFocus />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="When the customer sends" required>
          {({ id }) => (
            <Select id={id} value={match} onChange={(e) => setMatch(e.target.value as WaBotRule["match"])}>
              <option value="reply_1">Exactly “1”</option>
              <option value="reply_2">Exactly “2”</option>
              <option value="keyword">A message containing a keyword</option>
              <option value="any">Anything else</option>
            </Select>
          )}
        </Field>
        {match === "keyword" && <TextField label="Keyword" required value={keyword} onChange={(e) => setKeyword(e.target.value)} error={errors.keyword} placeholder="فين" dir="auto" />}
      </div>
      <Field label="Then">
        {({ id }) => (
          <Select id={id} value={action} onChange={(e) => setAction(e.target.value as WaBotRule["action"])}>
            {(Object.keys(ACTION_LABEL) as WaBotRule["action"][]).map((a) => (
              <option key={a} value={a}>
                {ACTION_LABEL[a]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="space-y-1.5">
        <Label>
          Reply <span className="text-danger">*</span>
        </Label>
        <div className="flex flex-wrap gap-1">
          {VARIABLES.map((v) => (
            <button key={v} type="button" onClick={() => insertVariable(v)} className="rounded-full border border-line bg-paper-raised px-2 py-0.5 font-mono text-[11px] text-ink-soft transition-colors hover:border-primary/40 hover:text-primary">
              {v}
            </button>
          ))}
        </div>
        <Textarea ref={bodyRef} rows={3} dir="auto" value={responseText} onChange={(e) => setResponseText(e.target.value)} className={cn(errors.response && "border-danger")} placeholder="طلبك مع {{shipment.carrier}} 🚚" />
        {errors.response && <p className="text-xs font-medium text-danger">{errors.response}</p>}
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{existing ? "Save rule" : "Add rule"}</Button>
      </div>
    </form>
  );
}

// --------------------------------------------------------------- Simulator --

interface SimMessage {
  id: string;
  direction: "in" | "out";
  body: string;
  ruleName: string | null;
}

function Simulator({ rules, handoffKeyword }: { rules: WaBotRule[]; handoffKeyword: string }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<SimMessage[]>([{ id: "welcome", direction: "out", body: substitute("أهلاً {{customer.firstName}} 👋 وصلنا طلبك رقم {{order.number}}. رد بـ 1 لتأكيد الطلب أو 2 للإلغاء."), ruleName: null }]);

  function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const next: SimMessage[] = [{ id: uid(), direction: "in", body: text, ruleName: null }];
    const handoff = handoffKeyword.trim() && text.toLowerCase().includes(handoffKeyword.trim().toLowerCase());
    const rule = matchRule(rules, text);
    if (rule) next.push({ id: uid(), direction: "out", body: substitute(rule.responseText), ruleName: rule.name });
    else if (handoff) next.push({ id: uid(), direction: "out", body: "ثواني وهيرد عليك حد من الفريق 🙏", ruleName: "Handoff keyword" });
    else next.push({ id: uid(), direction: "out", body: "(no rule matched — the bot stays silent and the chat opens for an agent)", ruleName: null });
    setMessages((m) => [...m, ...next]);
    setInput("");
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Simulator</p>
      <div className="mx-auto w-full max-w-[300px] rounded-[2rem] border-[6px] border-ink/80 bg-ink/80 p-1 shadow-xl">
        <div className="flex h-[460px] flex-col overflow-hidden rounded-[1.6rem] bg-[#ECE5DD]">
          <div className="flex items-center gap-2 bg-[#075E54] px-3 py-2 text-white">
            <div className="flex size-7 items-center justify-center rounded-full bg-white/30">
              <Bot className="size-4" />
            </div>
            <div className="leading-tight">
              <p className="text-xs font-semibold">EgyStore</p>
              <p className="text-[10px] opacity-80">Bot · test mode</p>
            </div>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.direction === "out" ? "justify-start" : "justify-end")}>
                <div className={cn("max-w-[88%] rounded-lg px-2.5 py-1.5 text-[12px] leading-snug text-black shadow-sm", m.direction === "out" ? "bg-white" : "bg-[#DCF8C6]")} dir="auto">
                  {m.ruleName && <p className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-black/50">rule: {m.ruleName}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={send} className="flex items-center gap-2 border-t border-black/5 bg-white/70 px-2 py-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Customer sends…" dir="auto" className="h-8 flex-1 rounded-full bg-white text-xs" />
            <button type="submit" aria-label="Send" className="flex size-8 items-center justify-center rounded-full bg-[#25D366] text-white">
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </div>
      <p className="text-xs text-ink-soft">Try “1”, “2”, “فين طلبي” or “{handoffKeyword || "موظف"}”. Uses your unsaved rules.</p>
    </div>
  );
}
