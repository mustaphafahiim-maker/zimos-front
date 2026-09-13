import { useEffect, useState, type FormEvent } from "react";
import { Banknote, Landmark } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { CheckoutSettings, CurrencySetting, PaymentGateway } from "@/mock/types";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { TextField, Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";

const GATEWAY_LOGO: Record<PaymentGateway["key"], string> = {
  cod: "COD",
  paymob: "PM",
  fawry: "F",
  stripe: "S",
  paypal: "PP",
  instapay: "IP",
};

const CURRENCY_OPTIONS = ["EGP", "SAR", "AED", "KWD", "USD", "EUR"] as const;
const ROUNDING_LABEL: Record<CurrencySetting["rounding"], string> = { none: "No rounding", "0.99": "End in .99", whole: "Whole number" };

export function PaymentsPage() {
  return (
    <div className="max-w-5xl">
      <PageHeader title="Payments" description="Payment gateways, the currencies you sell in, and how COD cash reaches your bank." />
      <Tabs defaultValue="gateways">
        <TabsList>
          <TabsTrigger value="gateways">Gateways</TabsTrigger>
          <TabsTrigger value="currencies">Currencies</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>
        <TabsContent value="gateways" className="pt-4">
          <GatewaysTab />
        </TabsContent>
        <TabsContent value="currencies" className="pt-4">
          <CurrenciesTab />
        </TabsContent>
        <TabsContent value="payouts" className="pt-4">
          <PayoutsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ------------------------------------------------------------ Gateways --

function GatewaysTab() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const gateways = useAsync(() => mockApi.listGateways(workspaceId), [workspaceId]);
  const checkout = useAsync(() => mockApi.getCheckoutSettings(workspaceId), [workspaceId]);
  const [configuring, setConfiguring] = useState<PaymentGateway | null>(null);
  const list = gateways.data ?? [];

  async function save(next: PaymentGateway[], message: string) {
    await mockApi.saveGateways(workspaceId, next);
    gateways.setData(next);
    toast.success(message);
  }

  function toggle(g: PaymentGateway, enabled: boolean) {
    void save(
      list.map((x) => (x.key === g.key ? { ...x, enabled } : x)),
      enabled ? `${g.name} enabled.` : `${g.name} disabled.`
    );
  }

  return (
    <DataState loading={gateways.loading} error={gateways.error} onRetry={() => gateways.refresh()}>
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((g) => (
          <Card key={g.key} className={cn("p-5", !g.configured && "opacity-90")}>
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[0.6rem] bg-accent-soft font-display text-xs font-semibold text-accent-dark">
                {GATEWAY_LOGO[g.key]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-ink">{g.name}</p>
                  <StatusBadge value={g.configured ? "configured" : "not_configured"} tone={g.configured ? "success" : "warning"} />
                </div>
                <p className="text-xs text-ink-soft">Fee {g.feePercent}% per transaction</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {g.currencies.map((c) => (
                    <span key={c} className="rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <span title={g.configured ? (g.enabled ? "Enabled" : "Disabled") : "Configure first"}>
                <Toggle checked={g.enabled} disabled={!g.configured} onChange={(v) => toggle(g, v)} />
              </span>
            </div>

            {g.key === "cod" && checkout.data && (
              <CodOptions
                settings={checkout.data}
                onSaved={(s) => {
                  checkout.setData(s);
                }}
              />
            )}

            <div className="mt-4 border-t border-line pt-3">
              <Button size="sm" variant="outline" onClick={() => setConfiguring(g)}>
                {g.configured ? "Reconfigure" : "Configure"}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={configuring !== null} onClose={() => setConfiguring(null)} title={`Configure ${configuring?.name ?? ""}`}>
        {configuring && (
          <GatewayConfigForm
            key={configuring.key}
            gateway={configuring}
            onCancel={() => setConfiguring(null)}
            onDone={async () => {
              const g = configuring;
              await save(
                list.map((x) => (x.key === g.key ? { ...x, configured: true } : x)),
                `${g.name} configured.`
              );
              setConfiguring(null);
            }}
          />
        )}
      </Modal>
    </DataState>
  );
}

function CodOptions({ settings, onSaved }: { settings: CheckoutSettings; onSaved: (s: CheckoutSettings) => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [fee, setFee] = useState(minorToMajorInput(settings.codFeeAmount ?? null));
  const [otp, setOtp] = useState(settings.phoneOtpVerification);
  const [saving, setSaving] = useState(false);

  async function saveFee() {
    const minor = fee.trim() === "" ? null : majorToMinor(fee);
    if (minor !== null && (!Number.isFinite(minor) || minor < 0)) {
      toast.error("Enter a valid COD fee.");
      return;
    }
    setSaving(true);
    try {
      const next = { ...settings, codFeeAmount: minor === null ? null : String(minor), phoneOtpVerification: otp };
      await mockApi.saveCheckoutSettings(workspaceId, next);
      onSaved(next);
      toast.success("COD options saved.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleOtp(v: boolean) {
    setOtp(v);
    const next = { ...settings, phoneOtpVerification: v };
    await mockApi.saveCheckoutSettings(workspaceId, next);
    onSaved(next);
    toast.success(v ? "Phone OTP required for COD." : "Phone OTP no longer required.");
  }

  return (
    <div className="mt-4 space-y-3 rounded-[0.6rem] border border-line bg-paper p-3">
      <Field label="COD fee" hint="Added to the order total for cash-on-delivery orders. Leave blank for none.">
        {({ id }) => (
          <div className="flex gap-2">
            <Input id={id} type="number" min={0} step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0.00" />
            <Button type="button" size="sm" variant="outline" className="h-10" onClick={saveFee} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </Field>
      <Toggle label="Require phone OTP for COD" description="Customer confirms an SMS code before a COD order is placed." checked={otp} onChange={toggleOtp} />
    </div>
  );
}

function GatewayConfigForm({ gateway, onCancel, onDone }: { gateway: PaymentGateway; onCancel: () => void; onDone: () => Promise<void> }) {
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [saving, setSaving] = useState(false);
  const isCod = gateway.key === "cod";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {isCod ? (
        <p className="text-sm text-ink-soft">Cash on delivery needs no credentials. Confirm to mark it configured.</p>
      ) : (
        <>
          <TextField label="API key" required type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          <TextField label="API secret" required type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} />
          <TextField label="Merchant ID" type="password" autoComplete="off" value={merchantId} onChange={(e) => setMerchantId(e.target.value)} hint="Optional." />
        </>
      )}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || (!isCod && (apiKey.trim() === "" || secret.trim() === ""))}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------- Currencies --

function CurrenciesTab() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const currencies = useAsync(() => mockApi.listCurrencies(workspaceId), [workspaceId]);
  const [draft, setDraft] = useState<CurrencySetting[]>([]);
  const [adding, setAdding] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currencies.data) setDraft(currencies.data);
  }, [currencies.data]);

  const available = CURRENCY_OPTIONS.filter((c) => !draft.some((d) => d.code === c));

  function update(code: string, patch: Partial<CurrencySetting>) {
    setDraft((prev) => prev.map((c) => (c.code === code ? { ...c, ...patch } : c)));
  }

  function setDefault(code: string) {
    setDraft((prev) => prev.map((c) => ({ ...c, isDefault: c.code === code, enabled: c.code === code ? true : c.enabled })));
  }

  function add() {
    if (!adding) return;
    setDraft((prev) => [...prev, { code: adding, enabled: true, isDefault: false, rateToDefault: 1, rounding: "none" }]);
    setAdding("");
  }

  async function save() {
    setSaving(true);
    try {
      await mockApi.saveCurrencies(workspaceId, draft);
      currencies.setData(draft);
      toast.success("Currencies saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DataState loading={currencies.loading} error={currencies.error} onRetry={() => currencies.refresh()}>
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Currency</th>
                <th className="px-4 py-3 font-medium">Enabled</th>
                <th className="px-4 py-3 font-medium">Default</th>
                <th className="px-4 py-3 font-medium">Rate to default</th>
                <th className="px-4 py-3 font-medium">Rounding</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {draft.map((c) => (
                <tr key={c.code} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{c.code}</td>
                  <td className="px-4 py-3">
                    <Toggle checked={c.enabled} disabled={c.isDefault} onChange={(v) => update(c.code, { enabled: v })} />
                  </td>
                  <td className="px-4 py-3">
                    <input type="radio" name="default-currency" checked={c.isDefault} onChange={() => setDefault(c.code)} aria-label={`Make ${c.code} default`} />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      step="0.0001"
                      min={0}
                      value={c.rateToDefault}
                      disabled={c.isDefault}
                      onChange={(e) => update(c.code, { rateToDefault: Number(e.target.value) })}
                      className="h-9 max-w-[140px]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Select value={c.rounding} onChange={(e) => update(c.code, { rounding: e.target.value as CurrencySetting["rounding"] })} className="h-9 max-w-[160px]">
                      {(Object.keys(ROUNDING_LABEL) as CurrencySetting["rounding"][]).map((r) => (
                        <option key={r} value={r}>
                          {ROUNDING_LABEL[r]}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!c.isDefault && (
                      <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setDraft((p) => p.filter((x) => x.code !== c.code))}>
                        Remove
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-end gap-2">
            <Field label="Add currency">
              {({ id }) => (
                <Select id={id} value={adding} onChange={(e) => setAdding(e.target.value)} className="w-40" disabled={available.length === 0}>
                  <option value="">Select…</option>
                  {available.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Button variant="outline" className="h-10" onClick={add} disabled={!adding}>
              Add
            </Button>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save currencies"}
          </Button>
        </div>
      </div>
    </DataState>
  );
}

// ------------------------------------------------------------- Payouts --

const SETTLEMENTS = [
  { id: "st-1041", period: "Sep 1 – Sep 7", carrier: "Bosta", orders: 212, amount: 18734000, status: "paid" },
  { id: "st-1040", period: "Aug 25 – Aug 31", carrier: "Bosta", orders: 198, amount: 17210000, status: "paid" },
  { id: "st-1039", period: "Aug 25 – Aug 31", carrier: "J&T Express", orders: 41, amount: 3928000, status: "paid" },
  { id: "st-1042", period: "Sep 8 – Sep 14", carrier: "Bosta", orders: 96, amount: 8412000, status: "pending" },
];

function PayoutsTab() {
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <CardHeader className="px-0">
          <CardTitle className="flex items-center gap-2 text-ink">
            <Landmark className="size-4 text-primary" /> How COD payouts work
          </CardTitle>
          <CardDescription className="text-ink-soft">
            Your carrier collects cash from the customer at the door, deducts its shipping and COD fees, and settles the balance to your
            bank account every week. Card and wallet payments are paid out by the gateway on its own schedule.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ol className="grid gap-3 text-sm sm:grid-cols-3">
            {[
              ["1. Delivered", "Courier collects the order total in cash."],
              ["2. Reconciled", "Carrier matches cash to delivered shipments."],
              ["3. Settled weekly", "Net amount is transferred to your bank."],
            ].map(([t, d]) => (
              <li key={t} className="rounded-[0.6rem] border border-line bg-paper p-3">
                <p className="font-medium text-ink">{t}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{d}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-medium text-ink">
          <Banknote className="size-4 text-ink-soft" /> Recent settlements
        </h2>
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Settlement</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Carrier</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Net amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {SETTLEMENTS.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{s.id}</td>
                  <td className="px-4 py-3 text-ink-soft">{s.period}</td>
                  <td className="px-4 py-3 text-ink-soft">{s.carrier}</td>
                  <td className="px-4 py-3 tabular-nums text-ink-soft">{s.orders}</td>
                  <td className="px-4 py-3 tabular-nums text-ink">{formatMoney(s.amount, "EGP")}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
