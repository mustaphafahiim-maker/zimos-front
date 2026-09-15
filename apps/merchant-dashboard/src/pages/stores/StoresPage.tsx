import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Store } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, cn } from "@store-builder/ui";
import { useWorkspace } from "@/context/WorkspaceContext";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "All stores",
    description: "The stores (workspaces) you have access to.",
    createStore: "Create store",
    nameLabel: "Store name",
    namePlaceholder: "e.g. My new brand",
    creating: "Creating…",
    created: "Store created",
    createFailed: "Could not create the store",
    current: "Current",
    switch: "Switch",
    role: "Role",
    emptyTitle: "No stores yet",
    emptyHint: "Create your first store using the form below.",
  },
  ar: {
    title: "كل المتاجر",
    description: "المتاجر اللي عندك صلاحية عليها.",
    createStore: "اعمل متجر",
    nameLabel: "اسم المتجر",
    namePlaceholder: "مثلاً: البراند الجديد",
    creating: "بنعمل المتجر…",
    created: "المتجر اتعمل",
    createFailed: "معرفناش نعمل المتجر",
    current: "الحالي",
    switch: "افتح",
    role: "الدور",
    emptyTitle: "مفيش متاجر لسه",
    emptyHint: "اعمل أول متجر من الفورم اللي تحت.",
  },
} satisfies Messages;

export function StoresPage() {
  const { workspaces, currentWorkspace, selectWorkspace, createWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  const t = useT(STRINGS);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  function switchTo(id: string) {
    selectWorkspace(id);
    navigate("/");
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await createWorkspace(trimmed);
      setName("");
      toast.success(t.created);
    } catch {
      toast.error(t.createFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={t.title} description={t.description} />

      {workspaces.length === 0 ? (
        <EmptyState icon={<Store />} title={t.emptyTitle} description={t.emptyHint} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-raised">
          {workspaces.map((w) => {
            const current = w.id === currentWorkspace?.id;
            return (
              <li
                key={w.id}
                className={cn("flex flex-wrap items-center gap-3 px-4 py-3", current && "bg-primary-soft/40")}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink" dir="auto">
                      {w.name}
                    </span>
                    {current && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-white">
                        {t.current}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-soft">
                    <bdi dir="ltr">{w.slug}</bdi>
                    {w.role && (
                      <span className="ms-2">
                        {t.role}: <bdi dir="ltr">{w.role}</bdi>
                      </span>
                    )}
                  </p>
                </div>
                {!current && (
                  <Button size="sm" variant="outline" onClick={() => switchTo(w.id)}>
                    {t.switch}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="font-semibold">{t.createStore}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1 space-y-1 text-sm">
              <span className="block text-ink-soft">{t.nameLabel}</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} />
            </label>
            <Button type="submit" disabled={saving || !name.trim()}>
              <Plus /> {saving ? t.creating : t.createStore}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
