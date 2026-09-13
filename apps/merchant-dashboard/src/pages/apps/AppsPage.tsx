import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button, Card, Input, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { AppCategory, AppIntegration } from "@/mock/types";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";

type CategoryFilter = "all" | AppCategory;

const CATEGORIES: Array<{ value: CategoryFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "marketing", label: "Marketing" },
  { value: "shipping", label: "Shipping" },
  { value: "payments", label: "Payments" },
  { value: "messaging", label: "Messaging" },
  { value: "analytics", label: "Analytics" },
  { value: "ai", label: "AI & import" },
];

const CATEGORY_COLOR: Record<AppCategory, string> = {
  marketing: "bg-primary-soft text-primary-dark",
  shipping: "bg-accent-soft text-accent-dark",
  payments: "bg-success-soft text-success",
  messaging: "bg-primary text-white",
  analytics: "bg-accent text-white",
  ai: "bg-ink text-paper",
};

function LogoChip({ app }: { app: AppIntegration }) {
  return (
    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-[0.6rem] font-display text-sm font-semibold", CATEGORY_COLOR[app.category])}>
      {app.logoText}
    </span>
  );
}

export function AppsPage() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const apps = useAsync(() => mockApi.listApps(workspaceId), [workspaceId]);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [uninstalling, setUninstalling] = useState<AppIntegration | null>(null);

  const list = apps.data ?? [];
  const installed = list.filter((a) => a.installed);
  const discover = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((a) => {
      if (a.installed) return false;
      if (category !== "all" && a.category !== category) return false;
      if (q && !a.name.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [list, category, search]);

  async function install(app: AppIntegration) {
    await mockApi.setAppInstalled(workspaceId, app.key, true);
    toast.success(`${app.name} installed. Finish setup to connect it.`);
    apps.refresh({ silent: true });
  }

  async function confirmUninstall() {
    if (!uninstalling) return;
    await mockApi.setAppInstalled(workspaceId, uninstalling.key, false);
    toast.success(`${uninstalling.name} uninstalled.`);
    setUninstalling(null);
    apps.refresh({ silent: true });
  }

  return (
    <div className="max-w-6xl space-y-10">
      <PageHeader title="Apps" description="Connect messaging, ads, shipping and payment tools to your store." />

      <DataState loading={apps.loading} error={apps.error} onRetry={() => apps.refresh()}>
        <section>
          <h2 className="mb-3 font-display text-lg font-medium text-ink">
            Installed <span className="text-sm font-normal text-ink-soft">({installed.length})</span>
          </h2>
          {installed.length === 0 ? (
            <EmptyState title="No apps installed" description="Browse the catalogue below to add your first integration." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {installed.map((app) => (
                <Card key={app.key} className="p-4">
                  <div className="flex items-start gap-3">
                    <LogoChip app={app} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-ink">{app.name}</p>
                        <StatusBadge value={app.status} tone={app.status === "connected" ? "success" : "warning"} />
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{app.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1 border-t border-line pt-3">
                    <Button size="sm" variant="outline" onClick={() => toast.success(`Opening ${app.name}…`)}>
                      {app.status === "connected" ? "Open" : "Configure"}
                    </Button>
                    <Button size="sm" variant="ghost" className="ml-auto text-danger hover:bg-danger-soft" onClick={() => setUninstalling(app)}>
                      Uninstall
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-medium text-ink">Discover</h2>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
              <Input placeholder="Search apps…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64 pl-8" />
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  category === c.value ? "border-primary bg-primary-soft text-primary-dark" : "border-line text-ink-soft hover:bg-paper-raised"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          {discover.length === 0 ? (
            <EmptyState title="Nothing to show" description="Try another category or search term." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {discover.map((app) => (
                <Card key={app.key} className="p-4">
                  <div className="flex items-start gap-3">
                    <LogoChip app={app} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{app.name}</p>
                      <p className="text-[11px] uppercase tracking-wide text-ink-soft">{app.category}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{app.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-line pt-3">
                    <Button size="sm" onClick={() => install(app)}>
                      Install
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </DataState>

      <ConfirmDialog
        open={uninstalling !== null}
        title={`Uninstall ${uninstalling?.name ?? ""}?`}
        description="Its automations and syncs stop immediately. You can install it again later."
        confirmLabel="Uninstall"
        destructive
        onCancel={() => setUninstalling(null)}
        onConfirm={confirmUninstall}
      />
    </div>
  );
}
