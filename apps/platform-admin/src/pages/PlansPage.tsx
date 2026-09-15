import { useState } from "react";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import { Alert, Button, Modal, Table, TableBody, TableHeader, TableRow, Toggle, useAsync } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Panel, Td, Th, Mono } from "@/components/Panel";
import { TextField } from "@/components/forms";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { adminApi, type AdminPlan } from "@/lib/adminApi";
import { getErrorMessage } from "@/lib/errors";
import { formatMinor, formatNumber, toMajor, toMinor } from "@/lib/format";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Plans",
    description: "Pricing plans merchants subscribe to. Prices are stored in minor units.",
    newPlan: "New plan",
    name: "Name",
    key: "Key",
    keyHint: "Lowercase letters, numbers, - or _. Can't be changed later.",
    monthly: "Monthly price",
    yearly: "Yearly price",
    currency: "Currency",
    trialDays: "Trial days",
    quota: "Soft order quota",
    quotaHint: "Leave empty for unlimited.",
    subscribers: "Subscribers",
    active: "Active",
    inactive: "Inactive",
    activeLabel: "Available for new subscriptions",
    unlimited: "Unlimited",
    empty: "No plans yet.",
    editTitle: "Edit {name}",
    createTitle: "Create plan",
    created: "Plan created.",
    updated: "Plan updated.",
    deactivateTitle: "Deactivate {name}?",
    deactivateDesc: "Existing subscribers keep it; it just stops being offered to new ones.",
    deactivate: "Deactivate",
    activated: "{name} is active.",
    deactivated: "{name} is inactive.",
    invalid: "Fill name, key and valid non-negative prices.",
  },
  ar: {
    title: "الباقات",
    description: "باقات الأسعار اللي التجار بيشتركوا فيها. الأسعار بتتخزن بأصغر وحدة للعملة.",
    newPlan: "باقة جديدة",
    name: "الاسم",
    key: "المفتاح",
    keyHint: "حروف إنجليزي صغيرة وأرقام و - أو _. مينفعش يتغير بعدين.",
    monthly: "السعر الشهري",
    yearly: "السعر السنوي",
    currency: "العملة",
    trialDays: "أيام التجربة",
    quota: "حد الطلبات التقريبي",
    quotaHint: "سيبه فاضي لو مفيش حد.",
    subscribers: "المشتركين",
    active: "نشطة",
    inactive: "متوقفة",
    activeLabel: "متاحة لاشتراكات جديدة",
    unlimited: "مفتوح",
    empty: "مفيش باقات لسه.",
    editTitle: "تعديل {name}",
    createTitle: "إنشاء باقة",
    created: "الباقة اتعملت.",
    updated: "الباقة اتعدّلت.",
    deactivateTitle: "توقف {name}؟",
    deactivateDesc: "المشتركين الحاليين هيفضلوا عليها، بس مش هتتعرض على مشتركين جداد.",
    deactivate: "إيقاف",
    activated: "{name} بقت نشطة.",
    deactivated: "{name} اتوقفت.",
    invalid: "اكتب الاسم والمفتاح وأسعار صحيحة مش سالبة.",
  },
};

interface FormState {
  key: string;
  name: string;
  currency: string;
  monthly: string;
  yearly: string;
  trialDays: string;
  quota: string;
  isActive: boolean;
}

const emptyForm: FormState = { key: "", name: "", currency: "EGP", monthly: "0", yearly: "0", trialDays: "14", quota: "", isActive: true };

export function PlansPage() {
  const t = useT(STRINGS);
  const c = useCommon();
  const toast = useToast();
  const { data, loading, error, refresh } = useAsync(() => adminApi.listPlans(), []);
  const [editing, setEditing] = useState<AdminPlan | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState<AdminPlan | null>(null);

  const openEdit = (p: AdminPlan | "new") => {
    setFormError(null);
    setForm(
      p === "new"
        ? emptyForm
        : {
            key: p.key,
            name: p.name,
            currency: p.currency,
            monthly: String(toMajor(p.monthlyPriceAmount, p.currency)),
            yearly: String(toMajor(p.yearlyPriceAmount, p.currency)),
            trialDays: String(p.trialDays),
            quota: p.softOrderQuota === null ? "" : String(p.softOrderQuota),
            isActive: p.isActive,
          }
    );
    setEditing(p);
  };

  const save = async () => {
    const monthly = Number(form.monthly);
    const yearly = Number(form.yearly);
    const trialDays = Number(form.trialDays);
    const cur = form.currency.trim().toUpperCase();
    if (!form.name.trim() || (editing === "new" && !/^[a-z0-9_-]{2,50}$/.test(form.key)) || !(monthly >= 0) || !(yearly >= 0) || !Number.isInteger(trialDays) || trialDays < 0 || cur.length !== 3) {
      setFormError(t.invalid);
      return;
    }
    const body = {
      name: form.name.trim(),
      currency: cur,
      monthlyPriceAmount: toMinor(monthly, cur),
      yearlyPriceAmount: toMinor(yearly, cur),
      trialDays,
      softOrderQuota: form.quota.trim() === "" ? null : Math.max(0, Math.floor(Number(form.quota))),
      isActive: form.isActive,
    };
    setSaving(true);
    setFormError(null);
    try {
      if (editing === "new") {
        await adminApi.createPlan({ key: form.key, ...body });
        toast.success(t.created);
      } else if (editing) {
        await adminApi.updatePlan(editing.id, body);
        toast.success(t.updated);
      }
      setEditing(null);
      void refresh({ silent: true });
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (p: AdminPlan, isActive: boolean) => {
    try {
      await adminApi.updatePlan(p.id, { isActive });
      toast.success(fmt(isActive ? t.activated : t.deactivated, { name: p.name }));
      void refresh({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw /> {c.refresh}
            </Button>
            <Button size="sm" onClick={() => openEdit("new")}>
              <Plus /> {t.newPlan}
            </Button>
          </>
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()} empty={!!data && data.length === 0} emptyMessage={t.empty}>
        <Panel flush>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>{t.name}</Th>
                  <Th>{t.monthly}</Th>
                  <Th>{t.yearly}</Th>
                  <Th>{t.trialDays}</Th>
                  <Th>{t.quota}</Th>
                  <Th className="text-end">{t.subscribers}</Th>
                  <Th>{c.status}</Th>
                  <Th className="text-end">{c.actions}</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <Td>
                      <span className="block font-medium">{p.name}</span>
                      <Mono>{p.key}</Mono>
                    </Td>
                    <Td className="tabular">{formatMinor(p.monthlyPriceAmount, p.currency)}</Td>
                    <Td className="tabular">{formatMinor(p.yearlyPriceAmount, p.currency)}</Td>
                    <Td className="tabular">{formatNumber(p.trialDays)}</Td>
                    <Td className="tabular">{p.softOrderQuota === null ? t.unlimited : formatNumber(p.softOrderQuota)}</Td>
                    <Td className="tabular text-end">{formatNumber(p.subscribers ?? 0)}</Td>
                    <Td>
                      <Toggle
                        checked={p.isActive}
                        onChange={(next) => (next ? void setActive(p, true) : setDeactivating(p))}
                        label={p.isActive ? t.active : t.inactive}
                      />
                    </Td>
                    <Td className="text-end">
                      <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                        <Pencil /> {c.edit}
                      </Button>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </DataState>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t.createTitle : fmt(t.editTitle, { name: editing?.name ?? "" })}
        closeLabel={c.close}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              {c.cancel}
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? c.working : editing === "new" ? c.create : c.save}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <Alert variant="danger">{formError}</Alert>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label={t.name} value={form.name} onChange={set("name")} required />
            <TextField label={t.key} value={form.key} onChange={set("key")} disabled={editing !== "new"} hint={editing === "new" ? t.keyHint : undefined} dir="ltr" required />
            <TextField label={t.currency} value={form.currency} onChange={set("currency")} maxLength={3} dir="ltr" />
            <TextField label={t.trialDays} type="number" min={0} max={365} value={form.trialDays} onChange={set("trialDays")} />
            <TextField label={t.monthly} type="number" min={0} step="0.01" value={form.monthly} onChange={set("monthly")} />
            <TextField label={t.yearly} type="number" min={0} step="0.01" value={form.yearly} onChange={set("yearly")} />
            <TextField label={t.quota} type="number" min={0} value={form.quota} onChange={set("quota")} hint={t.quotaHint} />
          </div>
          <Toggle checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label={t.activeLabel} />
          {editing && editing !== "new" && !form.isActive && editing.isActive && (
            <StatusBadge tone="warning" dot>
              {t.deactivateDesc}
            </StatusBadge>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={deactivating !== null}
        title={fmt(t.deactivateTitle, { name: deactivating?.name ?? "" })}
        description={t.deactivateDesc}
        confirmLabel={t.deactivate}
        destructive
        onCancel={() => setDeactivating(null)}
        onConfirm={async () => {
          if (!deactivating) return;
          await adminApi.updatePlan(deactivating.id, { isActive: false });
          toast.success(fmt(t.deactivated, { name: deactivating.name }));
          setDeactivating(null);
          void refresh({ silent: true });
        }}
      />
    </div>
  );
}
