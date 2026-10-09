import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { ApiError, teamAccessOptions, teamInvite } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { DataState } from "@/components/DataState";
import { TextField } from "@/components/Field";
import { roleAboveYoursMessage, useTeamLimitTexts, type TeamLimits } from "./teamAccessLimits";

/**
 * The invite dialog (SPEC §17.1): an email, then "Admin" or "Partial" with a
 * tick per section of the dashboard. "Advanced" shows the permissions the
 * ticks stand for, to add or check them one by one.
 */

const STRINGS = {
  en: {
    email: "Email",
    seats: "{used} of {limit} team seats used",
    seatsFull: "Your plan's team is full. Upgrade the plan to invite more people.",
    access: "Access",
    admin: "Admin",
    adminHint: "Everything in the store, except billing and ownership.",
    partial: "Partial",
    partialHint: "Only the sections you tick.",
    sections: "Sections",
    advanced: "Advanced: single permissions",
    hideAdvanced: "Hide single permissions",
    included: "included",
    cancel: "Cancel",
    send: "Send invite",
    sending: "Sending…",
    sent: "Invitation sent to {email}. They join the team once they accept it",
    alreadyMember: "That person is already on the team.",
    alreadyInvited: "That email already has an invitation waiting.",
    pick: "Tick at least one section.",
    "s.orders": "Orders",
    "s.orders.hint": "See, confirm, edit, cancel and refund orders",
    "s.shipping": "Shipping",
    "s.shipping.hint": "Book couriers, print waybills, shipping prices",
    "s.products": "Products",
    "s.products.hint": "Products, categories and stock",
    "s.customers": "Customers",
    "s.customers.hint": "Customers, contacts and form data",
    "s.discounts": "Discounts",
    "s.discounts.hint": "Discount codes and offers; change prices on orders (a line's price, a custom line, or a staff discount)",
    "s.store": "Store design",
    "s.store.hint": "Pages, theme, templates and domains",
    "s.funnels": "Funnels",
    "s.funnels.hint": "Build and publish funnels",
    "s.analytics": "Analytics",
    "s.analytics.hint": "Dashboards and reports",
    "s.finance": "Finance",
    "s.finance.hint": "Profit, settlements and tax",
    "s.messaging": "Messages",
    "s.messaging.hint": "WhatsApp, automations and notifications",
    "s.apps": "Apps",
    "s.apps.hint": "Apps, API keys and webhooks",
    "s.settings": "Settings",
    "s.settings.hint": "Store settings, team and activity log",
  },
  ar: {
    email: "الإيميل",
    seats: "{used} من {limit} مقاعد الفريق مستخدمة",
    seatsFull: "فريق باقتك اكتمل. رقّي الباقة عشان تدعو ناس أكتر.",
    access: "الصلاحية",
    admin: "أدمن",
    adminHint: "كل حاجة في المتجر، ما عدا الفواتير والملكية.",
    partial: "جزئية",
    partialHint: "الأقسام اللي تعلّم عليها بس.",
    sections: "الأقسام",
    advanced: "متقدم: صلاحيات مفردة",
    hideAdvanced: "إخفاء الصلاحيات المفردة",
    included: "ضمن قسم",
    cancel: "إلغاء",
    send: "إرسال الدعوة",
    sending: "بنبعت…",
    sent: "اتبعتت الدعوة لـ {email}. هتظهر في الفريق لما يقبلها",
    alreadyMember: "الشخص ده في الفريق بالفعل.",
    alreadyInvited: "الإيميل ده عنده دعوة مستنية بالفعل.",
    pick: "علّم على قسم واحد على الأقل.",
    "s.orders": "الطلبات",
    "s.orders.hint": "عرض وتأكيد وتعديل وإلغاء واسترجاع الطلبات",
    "s.shipping": "الشحن",
    "s.shipping.hint": "حجز شركات الشحن وطباعة البوالص وأسعار الشحن",
    "s.products": "المنتجات",
    "s.products.hint": "المنتجات والتصنيفات والمخزون",
    "s.customers": "العملاء",
    "s.customers.hint": "العملاء وجهات الاتصال وبيانات النماذج",
    "s.discounts": "الخصومات",
    "s.discounts.hint": "أكواد الخصم والعروض، وتعديل الأسعار في الطلبات (سعر سطر، سطر مخصص، أو خصم يدوي على الطلب)",
    "s.store": "تصميم المتجر",
    "s.store.hint": "الصفحات والثيم والقوالب والدومينات",
    "s.funnels": "مسارات البيع",
    "s.funnels.hint": "بناء ونشر مسارات البيع",
    "s.analytics": "التحليلات",
    "s.analytics.hint": "لوحات المتابعة والتقارير",
    "s.finance": "المالية",
    "s.finance.hint": "الأرباح والتسويات والضرائب",
    "s.messaging": "الرسائل",
    "s.messaging.hint": "واتساب والأتمتة والإشعارات",
    "s.apps": "التطبيقات",
    "s.apps.hint": "التطبيقات ومفاتيح الـ API والـ webhooks",
    "s.settings": "الإعدادات",
    "s.settings.hint": "إعدادات المتجر والفريق وسجل النشاط",
  },
} satisfies Messages;

export function TeamInviteForm({ onCancel, onDone, limits }: { onCancel: () => void; onDone: () => void; /** What the inviter may not give (handoff 346). */ limits?: TeamLimits }) {
  const limitText = useTeamLimitTexts();
  // Without a known role nothing is held back; the server still decides.
  const holds = (permission: string) => limits?.holds(permission) !== false;
  const t = useT(STRINGS);
  const labels = t as Record<string, string>;
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const options = useAsync(() => teamAccessOptions(apiClient, workspaceId), [workspaceId]);

  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<"admin" | "partial">("partial");
  const [sections, setSections] = useState<string[]>([]);
  const [extra, setExtra] = useState<string[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const data = options.data;
  // "Admin" gives everything but the owner-only permissions: offered only to someone who holds all of that.
  const canGiveAdmin = !data || data.permissions.filter((p) => !data.ownerOnly.includes(p)).every(holds);
  const seats = data?.seats;
  const full = Boolean(seats && seats.limit !== null && seats.used >= seats.limit);
  const fromSections = new Set((data?.sections ?? []).filter((s) => sections.includes(s.key)).flatMap((s) => s.permissions));
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    if (access === "partial" && sections.length === 0 && extra.length === 0) {
      setFormError(t.pick);
      return;
    }
    setSaving(true);
    try {
      const address = email.trim();
      await teamInvite(apiClient, workspaceId, access === "admin" ? { email: address, access } : { email: address, access, sections, permissions: extra });
      toast.success(fmt(t.sent, { email: address }));
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      const above = roleAboveYoursMessage(err, limitText);
      if (above) {
        toast.error(above);
        setFormError(above);
      } else if (err instanceof ApiError && (err.code as string | undefined) === "ALREADY_MEMBER") setFormError(t.alreadyMember);
      else if (err instanceof ApiError && (err.code as string | undefined) === "ALREADY_INVITED") setFormError(t.alreadyInvited);
      else if (err instanceof ApiError && err.code === "PLAN_LIMIT_REACHED") setFormError(t.seatsFull);
      else if (!fields.email) setFormError(fields.permissions ?? fields.sections ?? errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DataState loading={options.loading} error={options.error} onRetry={() => void options.refresh()}>
      <form onSubmit={submit} className="space-y-4">
        {seats && seats.limit !== null && (
          <p className="text-xs text-ink-soft">{fmt(t.seats, { used: seats.used, limit: seats.limit })}</p>
        )}
        {full && <Alert variant="info">{t.seatsFull}</Alert>}
        {formError && <Alert variant="danger">{formError}</Alert>}

        <TextField
          label={t.email}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          placeholder="teammate@example.com"
        />

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-ink">{t.access}</legend>
          {(
            [
              { value: "admin", label: t.admin, hint: t.adminHint },
              { value: "partial", label: t.partial, hint: t.partialHint },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              title={option.value === "admin" && !canGiveAdmin ? limitText.roleBeyond : undefined}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[0.875rem] border border-line p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
            >
              <input
                type="radio"
                name="team-access"
                className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary"
                checked={access === option.value}
                disabled={option.value === "admin" && !canGiveAdmin}
                onChange={() => setAccess(option.value)}
              />
              <span>
                <span className="block text-sm font-medium text-ink">{option.label}</span>
                <span className="block text-xs text-ink-soft">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {access === "partial" && data && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">{t.sections}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.sections.map((section) => {
                // A section holding a permission the inviter lacks is not theirs to give.
                const beyond = !section.permissions.every(holds);
                return (
                <label
                  key={section.key}
                  title={beyond ? limitText.roleBeyond : undefined}
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[0.875rem] border border-line p-2.5 has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary"
                    checked={!beyond && sections.includes(section.key)}
                    disabled={beyond}
                    onChange={() => setSections((prev) => toggle(prev, section.key))}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">{labels[`s.${section.key}`] ?? section.key}</span>
                    <span className="block text-xs text-ink-soft">{labels[`s.${section.key}.hint`] ?? ""}</span>
                  </span>
                </label>
                );
              })}
            </div>

            <button type="button" aria-expanded={advanced} className="mt-2 inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => setAdvanced((v) => !v)}>
              {advanced ? t.hideAdvanced : t.advanced}
            </button>
            {advanced && (
              <div className="mt-2 grid max-h-56 gap-1 overflow-y-auto rounded-md border border-line p-3 sm:grid-cols-2">
                {data.permissions
                  .filter((permission) => !data.ownerOnly.includes(permission))
                  .map((permission) => {
                    const implied = fromSections.has(permission);
                    const beyond = !holds(permission);
                    return (
                      <label key={permission} title={beyond ? limitText.permissionBeyond : undefined} className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-ink has-[:disabled]:cursor-default sm:min-h-8">
                        <input
                          type="checkbox"
                          checked={!beyond && (implied || extra.includes(permission))}
                          disabled={implied || beyond}
                          onChange={() => setExtra((prev) => toggle(prev, permission))}
                        />
                        <code dir="ltr" className="font-mono">
                          {permission}
                        </code>
                        {implied && <span className="text-ink-soft">({t.included})</span>}
                      </label>
                    );
                  })}
              </div>
            )}
          </fieldset>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={onCancel} disabled={saving}>
            {t.cancel}
          </Button>
          <Button type="submit" className="min-h-11" disabled={saving || full || email.trim() === ""}>
            {saving ? t.sending : t.send}
          </Button>
        </div>
      </form>
    </DataState>
  );
}
