import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Copy, KeyRound, Lock, Plus, Send, Trash2, Webhook } from "lucide-react";
import { Alert, Button, Chip, SegmentedControl, Table, TableBody, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger, Textarea, ZimosLogo, ZimosMark, cn } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { SelectField, TextAreaField, TextField } from "@/components/forms";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { StatusBadge, humanize } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { Checklist, MarkdownPreview, SettingRow, renderTemplate, useAction } from "@/components/controls";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, formatRelative } from "@/lib/format";
import { adminApi } from "@/mock/adminApi";
import { controlApi } from "@/mock/controlApi";
import { API_SCOPES, EGYPT_GOVERNORATES, SAMPLE_VARIABLES, WEBHOOK_EVENTS } from "@/mock/controlSeed";
import { COUNTRIES } from "@/mock/constants";
import type { IntegrationKind, LegalDoc, MessageTemplate, PlatformSettings, WebhookEndpoint } from "@/mock/controlTypes";
import type { Plan } from "@/mock/types";

const TABS = [
  { key: "platform", label: "Platform" },
  { key: "branding", label: "Branding" },
  { key: "signup", label: "Signup & onboarding" },
  { key: "commerce", label: "Commerce defaults" },
  { key: "localization", label: "Localization" },
  { key: "legal", label: "Legal" },
  { key: "templates", label: "Email & SMS" },
  { key: "api", label: "Webhooks & API" },
  { key: "integrations", label: "Integrations" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const t = params.get("tab");
  const tab: TabKey = TABS.some((x) => x.key === t) ? (t as TabKey) : "platform";
  const settings = useAsync(async () => ({ settings: await controlApi.getSettings(), plans: await adminApi.listPlans() }), []);

  const sectionTabs: TabKey[] = ["platform", "branding", "signup", "commerce", "localization"];

  return (
    <div>
      <PageHeader title="Settings" description="Global platform configuration. Every change is recorded in the audit log." />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: String(v) }, { replace: true })}>
        <div className="scroll-thin overflow-x-auto border-b border-line">
          <TabsList variant="line" className="h-10">
            {TABS.map((x) => <TabsTrigger key={x.key} value={x.key} className="px-3">{x.label}</TabsTrigger>)}
          </TabsList>
        </div>
        {sectionTabs.includes(tab) && (
          <div className="pt-4">
            <DataState loading={settings.loading} error={settings.error} onRetry={() => void settings.refresh()}>
              {settings.data && (
                <>
                  <TabsContent value="platform"><PlatformSection s={settings.data.settings} onSaved={(s) => settings.setData({ ...settings.data!, settings: s })} /></TabsContent>
                  <TabsContent value="branding"><BrandingSection /></TabsContent>
                  <TabsContent value="signup"><SignupSection s={settings.data.settings} plans={settings.data.plans} onSaved={(s) => settings.setData({ ...settings.data!, settings: s })} /></TabsContent>
                  <TabsContent value="commerce"><CommerceSection s={settings.data.settings} onSaved={(s) => settings.setData({ ...settings.data!, settings: s })} /></TabsContent>
                  <TabsContent value="localization"><LocalizationSection s={settings.data.settings} onSaved={(s) => settings.setData({ ...settings.data!, settings: s })} /></TabsContent>
                </>
              )}
            </DataState>
          </div>
        )}
        <TabsContent value="legal" className="pt-4"><LegalSection /></TabsContent>
        <TabsContent value="templates" className="pt-4"><TemplatesSection /></TabsContent>
        <TabsContent value="api" className="pt-4"><ApiSection /></TabsContent>
        <TabsContent value="integrations" className="pt-4"><IntegrationsSection /></TabsContent>
      </Tabs>
    </div>
  );
}

/** Local draft of one settings section with save/discard. */
function useSection<K extends keyof Omit<PlatformSettings, "updatedAt">>(s: PlatformSettings, key: K, onSaved: (s: PlatformSettings) => void) {
  const [draft, setDraft] = useState<PlatformSettings[K]>(s[key]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  useEffect(() => setDraft(s[key]), [s, key]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(s[key]);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await controlApi.saveSettings(key, draft));
      toast.success("Settings saved.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const footer = (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
      {error && <p className="me-auto text-sm text-danger">{error}</p>}
      <Button variant="outline" disabled={!dirty || saving} onClick={() => setDraft(s[key])}>Discard</Button>
      <Button disabled={!dirty || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save changes"}</Button>
    </div>
  );
  return { draft, setDraft, footer, save, saving, dirty };
}

function PlatformSection({ s, onSaved }: { s: PlatformSettings; onSaved: (s: PlatformSettings) => void }) {
  const { draft, setDraft, footer } = useSection(s, "platform", onSaved);
  const [confirmMaint, setConfirmMaint] = useState(false);
  const [allow, setAllow] = useState("");
  return (
    <div className="space-y-4">
      {s.platform.maintenanceMode && <Alert variant="danger">Maintenance mode is ON — merchants and shoppers see the maintenance page.</Alert>}
      <Panel title="Platform">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextField label="Platform name" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <TextField label="Support email" type="email" required value={draft.supportEmail} onChange={(e) => setDraft({ ...draft, supportEmail: e.target.value })} />
          <TextField label="Support phone" value={draft.supportPhone} onChange={(e) => setDraft({ ...draft, supportPhone: e.target.value })} />
          <TextField label="Support WhatsApp" value={draft.supportWhatsapp} onChange={(e) => setDraft({ ...draft, supportWhatsapp: e.target.value })} />
          <SelectField label="Default currency" value={draft.defaultCurrency} onChange={(e) => setDraft({ ...draft, defaultCurrency: e.target.value })}>
            {["EGP", "SAR", "AED", "KWD", "JOD", "MAD", "USD"].map((c) => <option key={c}>{c}</option>)}
          </SelectField>
          <SelectField label="Default locale" value={draft.defaultLocale} onChange={(e) => setDraft({ ...draft, defaultLocale: e.target.value as "ar" | "en" })}>
            <option value="ar">Arabic (ar)</option><option value="en">English (en)</option>
          </SelectField>
          <SelectField label="Timezone" value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}>
            {["Africa/Cairo", "Asia/Riyadh", "Asia/Dubai", "Asia/Kuwait", "Asia/Amman", "Africa/Casablanca", "UTC"].map((z) => <option key={z}>{z}</option>)}
          </SelectField>
        </div>
      </Panel>
      <Panel title="Maintenance mode" description="Takes every merchant dashboard and storefront offline except allowlisted IPs.">
        <SettingRow label="Maintenance mode" description={draft.maintenanceMode ? "Will be ON after saving." : "Off"}>
          <Toggle label="Maintenance mode" hideLabel checked={draft.maintenanceMode} onChange={(v) => (v ? setConfirmMaint(true) : setDraft({ ...draft, maintenanceMode: false }))} />
        </SettingRow>
        <TextAreaField label="Message" value={draft.maintenanceMessage} onChange={(e) => setDraft({ ...draft, maintenanceMessage: e.target.value })} />
        <div className="mt-3">
          <p className="mb-1.5 text-sm font-medium text-ink">IP allowlist</p>
          <div className="flex flex-wrap gap-1.5">
            {draft.maintenanceAllowlist.map((ip) => (
              <Chip key={ip} onClick={() => setDraft({ ...draft, maintenanceAllowlist: draft.maintenanceAllowlist.filter((x) => x !== ip) })} aria-label={`Remove ${ip}`}>{ip} ×</Chip>
            ))}
          </div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = allow.trim(); if (v && !draft.maintenanceAllowlist.includes(v)) setDraft({ ...draft, maintenanceAllowlist: [...draft.maintenanceAllowlist, v] }); setAllow(""); }}>
            <TextField label="Add IP" className="flex-1" value={allow} onChange={(e) => setAllow(e.target.value)} placeholder="41.33.0.10" />
            <Button type="submit" variant="outline" className="self-end">Add</Button>
          </form>
        </div>
      </Panel>
      {footer}
      <ConfirmDialog open={confirmMaint} title="Enable maintenance mode?" description="After you save, every merchant and shopper outside the allowlist sees the maintenance page." confirmLabel="Enable (save to apply)" destructive onCancel={() => setConfirmMaint(false)}
        onConfirm={() => { setDraft({ ...draft, maintenanceMode: true }); setConfirmMaint(false); }} />
    </div>
  );
}

function BrandingSection() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Logo">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center rounded-[12px] border border-line bg-paper p-8"><ZimosLogo height={40} /></div>
          <div className="flex items-center justify-center gap-6 rounded-[12px] bg-zimos-navy p-8"><ZimosLogo height={40} surface="dark" /><ZimosMark size={40} /></div>
        </div>
        <p className="mt-3 text-xs text-ink-soft">The official ZIMOS logo is rendered from the shared brand kit (packages/ui) and can't be uploaded here.</p>
      </Panel>
      <Panel title="Colors" actions={<StatusBadge tone="neutral"><Lock className="size-3" /> Locked</StatusBadge>}>
        <div className="grid grid-cols-2 gap-3">
          {[["Primary", "var(--color-primary)"], ["Accent", "var(--color-accent)"], ["Navy", "var(--color-zimos-navy)"], ["Paper", "var(--color-paper)"]].map(([name, v]) => (
            <div key={name} className="flex items-center gap-3 rounded-[10px] border border-line p-2">
              <span className="size-9 rounded-md border border-line" style={{ background: v }} />
              <span className="text-sm"><span className="block font-medium text-ink">{name}</span><Mono>{v}</Mono></span>
            </div>
          ))}
        </div>
        <Alert className="mt-3">Brand colors come from the design tokens in packages/ui/src/brand/zimos.css. Change them there so all four apps stay consistent.</Alert>
      </Panel>
    </div>
  );
}

function SignupSection({ s, plans, onSaved }: { s: PlatformSettings; plans: Plan[]; onSaved: (s: PlatformSettings) => void }) {
  const { draft, setDraft, footer } = useSection(s, "signup", onSaved);
  return (
    <Panel title="Signup & onboarding">
      <SettingRow label="Allow new signups" description="When off, the signup page shows a waitlist form."><Toggle label="Allow new signups" hideLabel checked={draft.allowSignups} onChange={(v) => setDraft({ ...draft, allowSignups: v })} /></SettingRow>
      <SettingRow label="Require email verification" description="Merchants must verify email before publishing a store."><Toggle label="Require email verification" hideLabel checked={draft.requireEmailVerification} onChange={(v) => setDraft({ ...draft, requireEmailVerification: v })} /></SettingRow>
      <div className="grid grid-cols-1 gap-3 py-3 md:grid-cols-2">
        <TextField label="Default trial days" type="number" min={0} max={90} value={draft.defaultTrialDays} onChange={(e) => setDraft({ ...draft, defaultTrialDays: Number(e.target.value) })} />
        <SelectField label="Default plan" value={draft.defaultPlanId} onChange={(e) => setDraft({ ...draft, defaultPlanId: e.target.value })}>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </SelectField>
      </div>
      <p className="mb-1.5 text-sm font-medium text-ink">Allowed countries</p>
      <Checklist columns={3} value={draft.allowedCountries} onChange={(v) => setDraft({ ...draft, allowedCountries: v })} options={Object.entries(COUNTRIES).map(([code, name]) => ({ value: code, label: `${name} (${code})` }))} />
      {footer}
    </Panel>
  );
}

function CommerceSection({ s, onSaved }: { s: PlatformSettings; onSaved: (s: PlatformSettings) => void }) {
  const { draft, setDraft, footer } = useSection(s, "commerce", onSaved);
  return (
    <Panel title="Commerce defaults" description="Applied to new workspaces; merchants can override within limits.">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TextField label="Default COD fee (EGP)" type="number" min={0} value={draft.defaultCodFee} onChange={(e) => setDraft({ ...draft, defaultCodFee: Number(e.target.value) })} />
        <TextField label="Min order value" type="number" min={0} value={draft.minOrderValue} onChange={(e) => setDraft({ ...draft, minOrderValue: Number(e.target.value) })} />
        <TextField label="Max order value" type="number" min={0} value={draft.maxOrderValue} onChange={(e) => setDraft({ ...draft, maxOrderValue: Number(e.target.value) })} />
        <TextField label="Return window (days)" type="number" min={0} value={draft.returnWindowDays} onChange={(e) => setDraft({ ...draft, returnWindowDays: Number(e.target.value) })} />
      </div>
      <div className="mt-4 mb-1.5 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">Supported governorates ({draft.governorates.length}/{EGYPT_GOVERNORATES.length})</p>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, governorates: [...EGYPT_GOVERNORATES] })}>Select all</Button>
          <Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, governorates: [] })}>Clear</Button>
        </div>
      </div>
      <Checklist columns={4} value={draft.governorates} onChange={(v) => setDraft({ ...draft, governorates: v })} options={EGYPT_GOVERNORATES.map((g) => ({ value: g, label: g }))} />
      {footer}
    </Panel>
  );
}

function LocalizationSection({ s, onSaved }: { s: PlatformSettings; onSaved: (s: PlatformSettings) => void }) {
  const { draft, setDraft, footer } = useSection(s, "localization", onSaved);
  return (
    <Panel title="Localization">
      <p className="mb-1.5 text-sm font-medium text-ink">Enabled locales</p>
      <Checklist value={draft.enabledLocales} onChange={(v) => setDraft({ ...draft, enabledLocales: v })} options={[{ value: "ar", label: "Arabic — العربية", hint: "Right-to-left" }, { value: "en", label: "English", hint: "Left-to-right" }]} />
      <div className="mt-3">
        <p className="mb-1.5 text-sm font-medium text-ink">Default locale</p>
        <SegmentedControl ariaLabel="Default locale" value={draft.defaultLocale} onChange={(v) => setDraft({ ...draft, defaultLocale: v })} options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]} />
      </div>
      {footer}
    </Panel>
  );
}

function LegalSection() {
  const { data, loading, error, refresh, setData } = useAsync(() => controlApi.listLegal(), []);
  const [active, setActive] = useState<LegalDoc["id"]>("terms");
  const [body, setBody] = useState("");
  const [confirm, setConfirm] = useState(false);
  const doc = data?.find((d) => d.id === active) ?? null;
  useEffect(() => setBody(doc?.body ?? ""), [doc]);

  return (
    <DataState loading={loading} error={error} onRetry={() => void refresh()}>
      {doc && data && (
        <div className="space-y-4">
          <SegmentedControl ariaLabel="Document" value={active} onChange={setActive} options={data.map((d) => ({ value: d.id, label: d.title }))} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title={`${doc.title} · v${doc.version}`} description={`Updated ${formatRelative(doc.updatedAt)}`}>
              <Textarea aria-label={`${doc.title} markdown`} className="min-h-80 font-mono text-xs" value={body} onChange={(e) => setBody(e.target.value)} />
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" disabled={body === doc.body} onClick={() => setBody(doc.body)}>Discard</Button>
                <Button disabled={body === doc.body} onClick={() => setConfirm(true)}>Publish v{doc.version + 1}</Button>
              </div>
            </Panel>
            <Panel title="Preview"><MarkdownPreview source={body} /></Panel>
          </div>
          <Panel flush title="Version history">
            <ul className="divide-y divide-line">
              {[...doc.history].reverse().map((v) => (
                <li key={v.version} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                  <Mono>v{v.version}</Mono>
                  <span className="text-ink-soft">{v.publishedBy} · {formatDateTime(v.publishedAt)}</span>
                  {v.version === doc.version ? <StatusBadge tone="success" className="ms-auto">Current</StatusBadge> : <Button size="sm" variant="ghost" className="ms-auto" onClick={() => setBody(v.body)}>Load into editor</Button>}
                </li>
              ))}
            </ul>
          </Panel>
          <ConfirmDialog open={confirm} title={`Publish ${doc.title} v${doc.version + 1}?`} description="Merchants are asked to accept the new version on their next sign-in." confirmLabel="Publish" onCancel={() => setConfirm(false)}
            onConfirm={async () => { const next = await controlApi.publishLegal(doc.id, body); setData((p) => (p ?? []).map((d) => (d.id === next.id ? next : d))); setConfirm(false); }} />
        </div>
      )}
    </DataState>
  );
}

function TemplatesSection() {
  const { data, loading, error, refresh, setData } = useAsync(() => controlApi.listMessageTemplates(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MessageTemplate | null>(null);
  const [locale, setLocale] = useState<"en" | "ar">("en");
  const [testTo, setTestTo] = useState("");
  const { busy, run } = useAction();
  const selected = data?.find((t) => t.id === (selectedId ?? data[0]?.id)) ?? null;
  useEffect(() => setDraft(selected), [selected]);
  const dirty = !!draft && !!selected && JSON.stringify(draft) !== JSON.stringify(selected);

  const insertVar = (v: string) => {
    if (!draft) return;
    setDraft({ ...draft, [locale]: { ...draft[locale], body: `${draft[locale].body}{{${v}}}` } });
  };

  return (
    <DataState loading={loading} error={error} onRetry={() => void refresh()} empty={!!data && data.length === 0} emptyMessage="No templates.">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr]">
        <Panel flush title="Transactional templates">
          <ul className="divide-y divide-line">
            {(data ?? []).map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setSelectedId(t.id)} className={cn("flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-start text-sm hover:bg-primary-soft/60", selected?.id === t.id && "bg-primary-soft")}>
                  <span className="font-medium text-ink">{t.name}</span>
                  <StatusBadge tone={t.channel === "email" ? "info" : "neutral"}>{t.channel}</StatusBadge>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        {draft && (
          <div className="space-y-4">
            <Panel title={draft.name} description={draft.description} actions={<SegmentedControl size="sm" ariaLabel="Language" value={locale} onChange={setLocale} options={[{ value: "en", label: "English" }, { value: "ar", label: "العربية" }]} />}>
              <div className="space-y-3" dir={locale === "ar" ? "rtl" : "ltr"}>
                {draft.channel === "email" && <TextField label={locale === "ar" ? "الموضوع" : "Subject"} value={draft[locale].subject} onChange={(e) => setDraft({ ...draft, [locale]: { ...draft[locale], subject: e.target.value } })} />}
                <TextAreaField label={locale === "ar" ? "النص" : "Body"} rows={6} value={draft[locale].body} onChange={(e) => setDraft({ ...draft, [locale]: { ...draft[locale], body: e.target.value } })} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-ink-soft">Variables:</span>
                {draft.variables.map((v) => <Chip key={v} className="h-7 font-mono text-xs" onClick={() => insertVar(v)}>{`{{${v}}}`}</Chip>)}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" disabled={!dirty} onClick={() => setDraft(selected)}>Discard</Button>
                <Button disabled={!dirty || busy === "save"} onClick={() => void run("save", () => controlApi.saveMessageTemplate(draft), "Template saved.").then((t) => t && setData((p) => (p ?? []).map((x) => (x.id === t.id ? t : x))))}>Save</Button>
              </div>
            </Panel>
            <Panel title="Preview with sample data">
              <div dir={locale === "ar" ? "rtl" : "ltr"} className="rounded-[10px] border border-line bg-paper p-4 text-sm">
                {draft.channel === "email" && <p className="mb-2 font-semibold text-ink">{renderTemplate(draft[locale].subject, SAMPLE_VARIABLES)}</p>}
                <p className="whitespace-pre-line text-ink-soft">{renderTemplate(draft[locale].body, SAMPLE_VARIABLES)}</p>
              </div>
              <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void run("test", () => controlApi.sendTestMessage(draft.id, testTo, locale), `Test ${draft.channel} sent to ${testTo} (mock).`); }}>
                <TextField label={draft.channel === "email" ? "Send test to email" : "Send test to phone"} className="flex-1" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder={draft.channel === "email" ? "you@zimos.io" : "+20 100 000 0000"} />
                <Button type="submit" variant="outline" className="self-end" disabled={busy === "test"}><Send /> Send test</Button>
              </form>
              {dirty && <p className="mt-2 text-xs text-warning">Unsaved changes — the test uses the saved version on the backend.</p>}
            </Panel>
          </div>
        )}
      </div>
    </DataState>
  );
}

function ApiSection() {
  const keys = useAsync(() => controlApi.listApiKeys(), []);
  const hooks = useAsync(() => controlApi.listWebhooks(), []);
  const [creating, setCreating] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["workspaces:read"]);
  const [secret, setSecret] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [editingHook, setEditingHook] = useState<(Omit<WebhookEndpoint, "id" | "createdAt"> & { id?: string }) | null>(null);
  const [deletingHook, setDeletingHook] = useState<WebhookEndpoint | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { busy, run } = useAction();
  const toast = useToast();

  const deliveries = hooks.data?.deliveries ?? [];
  const endpointUrl = useMemo(() => Object.fromEntries((hooks.data?.endpoints ?? []).map((e) => [e.id, e.url])), [hooks.data]);

  return (
    <div className="space-y-4">
      <DataState loading={keys.loading} error={keys.error} onRetry={() => void keys.refresh()}>
        <Panel flush title="Platform API keys" actions={<Button size="sm" onClick={() => { setKeyName(""); setScopes(["workspaces:read"]); setFormError(null); setCreating(true); }}><KeyRound /> Create key</Button>}>
          {(keys.data ?? []).length === 0 ? <div className="p-4"><EmptyBlock message="No API keys." /></div> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="hover:bg-transparent"><Th>Name</Th><Th>Key</Th><Th>Scopes</Th><Th>Last used</Th><Th className="text-end">Actions</Th></TableRow></TableHeader>
                <TableBody>
                  {(keys.data ?? []).map((k) => (
                    <TableRow key={k.id} className={cn(k.revokedAt && "opacity-60")}>
                      <Td className="font-medium">{k.name}<span className="block text-xs text-ink-soft">by {k.createdBy} · {formatRelative(k.createdAt)}</span></Td>
                      <Td><Mono>{k.prefix}…</Mono></Td>
                      <Td><div className="flex flex-wrap gap-1">{k.scopes.map((s) => <StatusBadge key={s} tone="neutral">{s}</StatusBadge>)}</div></Td>
                      <Td className="text-ink-soft">{k.lastUsedAt ? formatRelative(k.lastUsedAt) : "Never"}</Td>
                      <Td className="text-end">{k.revokedAt ? <StatusBadge tone="neutral">Revoked</StatusBadge> : <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRevoking(k.id)}>Revoke</Button>}</Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </DataState>

      <DataState loading={hooks.loading} error={hooks.error} onRetry={() => void hooks.refresh()}>
        <Panel flush title="Outgoing webhooks" actions={<Button size="sm" onClick={() => { setFormError(null); setEditingHook({ url: "https://", description: "", events: [], enabled: true }); }}><Plus /> Add endpoint</Button>}>
          {(hooks.data?.endpoints ?? []).length === 0 ? <div className="p-4"><EmptyBlock message="No webhook endpoints." /></div> : (
            <ul className="divide-y divide-line">
              {(hooks.data?.endpoints ?? []).map((ep) => (
                <li key={ep.id} className="flex flex-col gap-2 px-5 py-3 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-ink"><Webhook className="size-4 text-ink-soft" />{ep.url}</p>
                    <p className="text-xs text-ink-soft">{ep.description} · {ep.events.join(", ")}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" disabled={busy === ep.id} onClick={() => void run(ep.id, () => controlApi.sendTestWebhook(ep.id), (d) => `Test delivered: HTTP ${d.statusCode}`).then(() => void hooks.refresh({ silent: true }))}><Send /> Test</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setFormError(null); setEditingHook(ep); }}>Edit</Button>
                    <Button size="icon-sm" variant="ghost" className="text-danger" aria-label="Delete endpoint" onClick={() => setDeletingHook(ep)}><Trash2 /></Button>
                    <Toggle label={`Enable ${ep.url}`} hideLabel checked={ep.enabled} onChange={(v) => void run(`t-${ep.id}`, () => controlApi.saveWebhook({ ...ep, enabled: v }), v ? "Endpoint enabled." : "Endpoint disabled.").then(() => void hooks.refresh({ silent: true }))} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel flush title="Delivery log" description="Most recent webhook attempts." className="mt-4">
          {deliveries.length === 0 ? <div className="p-4"><EmptyBlock message="No deliveries yet." /></div> : (
            <div className="scroll-thin max-h-80 overflow-auto">
              <Table>
                <TableHeader><TableRow className="hover:bg-transparent"><Th>Event</Th><Th>Endpoint</Th><Th>Status</Th><Th>Duration</Th><Th>When</Th></TableRow></TableHeader>
                <TableBody>
                  {deliveries.map((d) => (
                    <TableRow key={d.id}>
                      <Td><Mono>{d.event}</Mono></Td>
                      <Td className="max-w-56 truncate text-ink-soft">{endpointUrl[d.endpointId] ?? d.endpointId}</Td>
                      <Td><StatusBadge tone={d.statusCode < 300 ? "success" : "danger"}>{d.statusCode}</StatusBadge></Td>
                      <Td className="tabular text-ink-soft">{d.durationMs} ms</Td>
                      <Td className="text-ink-soft">{formatRelative(d.createdAt)}</Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </DataState>

      <Modal open={creating} onClose={() => setCreating(false)} title="Create API key"
        footer={<><Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button><Button onClick={async () => {
          setFormError(null);
          try { const r = await controlApi.createApiKey(keyName, scopes); setSecret(r.secret); setCreating(false); void keys.refresh({ silent: true }); } catch (err) { setFormError(getErrorMessage(err)); }
        }}>Create key</Button></>}>
        <div className="space-y-3">
          {formError && <Alert variant="danger">{formError}</Alert>}
          <TextField label="Name" required value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g. Finance BI export" />
          <p className="text-sm font-medium text-ink">Scopes</p>
          <Checklist value={scopes} onChange={setScopes} options={API_SCOPES.map((s) => ({ value: s, label: s }))} />
        </div>
      </Modal>
      <Modal open={!!secret} onClose={() => setSecret(null)} title="Copy your API key" description="This is the only time the full key is shown."
        footer={<Button onClick={() => setSecret(null)}>Done</Button>}>
        <div className="flex items-center gap-2">
          <Mono className="flex-1 break-all py-2">{secret}</Mono>
          <Button size="icon-sm" variant="outline" aria-label="Copy key" onClick={() => { void navigator.clipboard?.writeText(secret ?? ""); toast.success("Copied."); }}><Copy /></Button>
        </div>
      </Modal>
      <ConfirmDialog open={!!revoking} title="Revoke API key?" description="Integrations using this key stop working immediately." confirmLabel="Revoke" destructive onCancel={() => setRevoking(null)}
        onConfirm={async () => { if (!revoking) return; await controlApi.revokeApiKey(revoking); setRevoking(null); void keys.refresh({ silent: true }); }} />
      <Modal open={!!editingHook} onClose={() => setEditingHook(null)} title={editingHook?.id ? "Edit endpoint" : "Add endpoint"}
        footer={<><Button variant="outline" onClick={() => setEditingHook(null)}>Cancel</Button><Button onClick={async () => {
          if (!editingHook) return;
          setFormError(null);
          try { await controlApi.saveWebhook(editingHook); setEditingHook(null); void hooks.refresh({ silent: true }); } catch (err) { setFormError(getErrorMessage(err)); }
        }}>Save</Button></>}>
        {editingHook && (
          <div className="space-y-3">
            {formError && <Alert variant="danger">{formError}</Alert>}
            <TextField label="URL" required value={editingHook.url} onChange={(e) => setEditingHook({ ...editingHook, url: e.target.value })} />
            <TextField label="Description" value={editingHook.description} onChange={(e) => setEditingHook({ ...editingHook, description: e.target.value })} />
            <p className="text-sm font-medium text-ink">Events</p>
            <Checklist value={editingHook.events} onChange={(v) => setEditingHook({ ...editingHook, events: v })} options={WEBHOOK_EVENTS.map((e) => ({ value: e, label: e }))} />
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!deletingHook} title="Delete webhook endpoint?" description={deletingHook?.url} confirmLabel="Delete" destructive onCancel={() => setDeletingHook(null)}
        onConfirm={async () => { if (!deletingHook) return; await controlApi.deleteWebhook(deletingHook.id); setDeletingHook(null); void hooks.refresh({ silent: true }); }} />
    </div>
  );
}

const KIND_LABEL: Record<IntegrationKind, string> = { carrier: "Carriers", gateway: "Payment gateways", messaging: "Messaging providers" };

function IntegrationsSection() {
  const { data, loading, error, refresh, setData } = useAsync(() => controlApi.listIntegrations(), []);
  const { busy, run } = useAction();
  return (
    <DataState loading={loading} error={error} onRetry={() => void refresh()}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {(Object.keys(KIND_LABEL) as IntegrationKind[]).map((kind) => (
          <Panel key={kind} title={KIND_LABEL[kind]} description="Disabled integrations are hidden from every merchant.">
            {(data ?? []).filter((i) => i.kind === kind).map((i) => (
              <SettingRow key={i.id} label={i.name} description={`${i.description} · ${humanize(i.code)}`}>
                <Toggle label={`Enable ${i.name}`} hideLabel checked={i.enabled} disabled={busy === i.id}
                  onChange={(v) => void run(i.id, () => controlApi.setIntegrationEnabled(i.id, v), `${i.name} ${v ? "enabled" : "disabled"} platform-wide.`).then((r) => r && setData((p) => (p ?? []).map((x) => (x.id === r.id ? r : x))))} />
              </SettingRow>
            ))}
          </Panel>
        ))}
      </div>
    </DataState>
  );
}
