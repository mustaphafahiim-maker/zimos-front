import { useEffect, useState } from "react";
import { Banknote, CreditCard, Lock, ShieldCheck, Timer, Truck } from "lucide-react";
import { Button, Input, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { CheckoutSettings } from "@/mock/types";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { DataState } from "@/components/DataState";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";

type Visibility = CheckoutSettings["fields"]["email"];
type FieldKey = keyof CheckoutSettings["fields"];

const FIELD_LABEL: Record<FieldKey, string> = {
  email: "Email",
  alternatePhone: "Alternate phone",
  address2: "Address line 2",
  notes: "Order notes",
};

const VISIBILITY: Visibility[] = ["hidden", "optional", "required"];

export function CheckoutSettingsTab() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const settings = useAsync(() => mockApi.getCheckoutSettings(workspaceId), [workspaceId]);
  const [draft, setDraft] = useState<CheckoutSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  function patch(p: Partial<CheckoutSettings>) {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }
  function setField(k: FieldKey, v: Visibility) {
    setDraft((d) => (d ? { ...d, fields: { ...d.fields, [k]: v } } : d));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await mockApi.saveCheckoutSettings(workspaceId, draft);
      settings.setData(draft);
      toast.success("Checkout settings saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DataState loading={settings.loading || !draft} error={settings.error} onRetry={() => settings.refresh()}>
      {draft && (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-ink">Layout</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["one_page", "One page", "Contact, address and payment on a single screen. Best for COD."],
                    ["two_step", "Two step", "Contact first, then address and payment. Captures leads for recovery."],
                  ] as const
                ).map(([v, t, d]) => (
                  <label
                    key={v}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-[0.6rem] border p-3",
                      draft.layout === v ? "border-primary bg-primary-soft" : "border-line hover:bg-paper-raised"
                    )}
                  >
                    <input type="radio" name="layout" className="mt-1" checked={draft.layout === v} onChange={() => patch({ layout: v })} />
                    <span>
                      <span className="block text-sm font-medium text-ink">{t}</span>
                      <span className="block text-xs text-ink-soft">{d}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-medium text-ink">Fields</h3>
              <p className="text-xs text-ink-soft">Name, phone, governorate and address line 1 are always required.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {(Object.keys(FIELD_LABEL) as FieldKey[]).map((k) => (
                  <Field key={k} label={FIELD_LABEL[k]}>
                    {({ id }) => (
                      <Select id={id} value={draft.fields[k]} onChange={(e) => setField(k, e.target.value as Visibility)}>
                        {VISIBILITY.map((v) => (
                          <option key={v} value={v}>
                            {v.charAt(0).toUpperCase() + v.slice(1)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                ))}
              </div>
            </section>

            <section className="space-y-4 rounded-[0.6rem] border border-line p-4">
              <Toggle label="Phone OTP verification" description="Customer confirms an SMS code before the order is placed. Cuts fake COD orders." checked={draft.phoneOtpVerification} onChange={(v) => patch({ phoneOtpVerification: v })} />
              <Toggle label="Trust badges" description="Secure checkout, cash on delivery and free returns icons under the button." checked={draft.showTrustBadges} onChange={(v) => patch({ showTrustBadges: v })} />
              <Toggle label="Countdown timer" description="Reservation timer at the top of the checkout." checked={draft.showCountdown} onChange={(v) => patch({ showCountdown: v })} />
              {draft.showCountdown && (
                <Field label="Countdown minutes" className="max-w-[160px]">
                  {({ id }) => <Input id={id} type="number" min={1} max={120} value={draft.countdownMinutes} onChange={(e) => patch({ countdownMinutes: Math.max(1, Number(e.target.value) || 1) })} />}
                </Field>
              )}
              <Toggle label="Allow discount codes" description="Show the coupon field at checkout." checked={draft.allowDiscountCodes} onChange={(v) => patch({ allowDiscountCodes: v })} />
            </section>

            <Field label="Default payment method">
              {({ id }) => (
                <Select id={id} value={draft.defaultPaymentMethod} onChange={(e) => patch({ defaultPaymentMethod: e.target.value as CheckoutSettings["defaultPaymentMethod"] })} className="max-w-xs">
                  <option value="cod">Cash on delivery</option>
                  <option value="card">Card / wallet</option>
                </Select>
              )}
            </Field>

            <Field label="Thank-you message" hint="Shown on the confirmation page and in the confirmation message.">
              {({ id }) => <Textarea id={id} value={draft.thankYouMessage} onChange={(e) => patch({ thankYouMessage: e.target.value })} dir="auto" />}
            </Field>

            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save checkout settings"}
              </Button>
            </div>
          </div>

          <CheckoutPreview s={draft} />
        </div>
      )}
    </DataState>
  );
}

function PreviewInput({ label, required, hidden }: { label: string; required?: boolean; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-ink-soft">
        {label}
        {required && <span className="text-danger"> *</span>}
      </p>
      <div className="h-6 rounded border border-line bg-paper" />
    </div>
  );
}

function CheckoutPreview({ s }: { s: CheckoutSettings }) {
  const [step, setStep] = useState<1 | 2>(1);
  const showContact = s.layout === "one_page" || step === 1;
  const showRest = s.layout === "one_page" || step === 2;
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">Checkout preview</p>
      <div className="mx-auto w-[300px] rounded-[2rem] border-[6px] border-ink/80 bg-paper-raised p-3 shadow-xl">
        <div className="mx-auto mb-2 h-1 w-16 rounded-full bg-ink/30" />
        <div className="space-y-3 rounded-[1.2rem] bg-paper p-3 text-xs">
          {s.showCountdown && (
            <div className="flex items-center justify-center gap-1 rounded bg-accent-soft py-1 text-[10px] font-medium text-accent-dark">
              <Timer className="size-3" /> Order reserved for {s.countdownMinutes}:00
            </div>
          )}
          {s.layout === "two_step" && (
            <div className="flex gap-1">
              {[1, 2].map((n) => (
                <button key={n} type="button" onClick={() => setStep(n as 1 | 2)} className={cn("h-1 flex-1 rounded-full", step === n ? "bg-primary" : "bg-line")} aria-label={`Step ${n}`} />
              ))}
            </div>
          )}

          {showContact && (
            <div className="space-y-2">
              <p className="font-medium text-ink">Contact</p>
              <PreviewInput label="Full name" required />
              <PreviewInput label="Phone" required />
              <PreviewInput label="Email" required={s.fields.email === "required"} hidden={s.fields.email === "hidden"} />
              <PreviewInput label="Alternate phone" required={s.fields.alternatePhone === "required"} hidden={s.fields.alternatePhone === "hidden"} />
              {s.phoneOtpVerification && (
                <p className="flex items-center gap-1 text-[10px] text-primary-dark">
                  <Lock className="size-3" /> SMS code sent to verify phone
                </p>
              )}
            </div>
          )}

          {showRest && (
            <>
              <div className="space-y-2">
                <p className="font-medium text-ink">Shipping</p>
                <PreviewInput label="Governorate" required />
                <PreviewInput label="Address" required />
                <PreviewInput label="Address line 2" required={s.fields.address2 === "required"} hidden={s.fields.address2 === "hidden"} />
                <PreviewInput label="Notes" required={s.fields.notes === "required"} hidden={s.fields.notes === "hidden"} />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-ink">Payment</p>
                {(
                  [
                    ["cod", "Cash on delivery", <Banknote key="c" className="size-3" />],
                    ["card", "Card / wallet", <CreditCard key="k" className="size-3" />],
                  ] as const
                ).map(([v, l, icon]) => (
                  <div key={v} className={cn("flex items-center gap-2 rounded border px-2 py-1", s.defaultPaymentMethod === v ? "border-primary bg-primary-soft text-primary-dark" : "border-line text-ink-soft")}>
                    <span className={cn("size-2.5 rounded-full border", s.defaultPaymentMethod === v ? "border-primary bg-primary" : "border-line")} />
                    {icon} {l}
                  </div>
                ))}
              </div>
              {s.allowDiscountCodes && (
                <div className="flex gap-1">
                  <div className="h-6 flex-1 rounded border border-dashed border-line" />
                  <div className="rounded bg-paper-raised px-2 py-1 text-[10px] text-ink-soft">Apply</div>
                </div>
              )}
            </>
          )}

          <div className="rounded bg-primary py-2 text-center text-[11px] font-medium text-white">
            {s.layout === "two_step" && step === 1 ? "Continue" : "Place order"}
          </div>
          {s.showTrustBadges && (
            <div className="flex justify-around text-[9px] text-ink-soft">
              <span className="flex items-center gap-0.5"><ShieldCheck className="size-3" /> Secure</span>
              <span className="flex items-center gap-0.5"><Banknote className="size-3" /> COD</span>
              <span className="flex items-center gap-0.5"><Truck className="size-3" /> Free returns</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
