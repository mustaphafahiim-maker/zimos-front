import { usageGet } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";

/**
 * "This month" under the plan (SPEC §17.4): what the store used, and how much
 * of a limit is taken where the plan sets one. Read-only — no upgrade or
 * payment button lives here. Renders nothing if the numbers cannot be read
 * (the section above already explains a missing permission).
 */

const STRINGS = {
  en: {
    title: "This month",
    orders: "Orders",
    messages: "Messages sent",
    ai: "AI requests",
    storage: "Storage",
    members: "Team",
    domains: "Domains",
    of: "{used} of {limit}",
    updated: "Updated {when}",
  },
  ar: {
    title: "الشهر ده",
    orders: "الطلبات",
    messages: "الرسائل المرسلة",
    ai: "طلبات الذكاء الاصطناعي",
    storage: "التخزين",
    members: "الفريق",
    domains: "الدومينات",
    of: "{used} من {limit}",
    updated: "آخر تحديث {when}",
  },
} satisfies Messages;

function bytes(value: number): string {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function UsageBlock() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const usage = useAsync(() => usageGet(apiClient, workspaceId), [workspaceId]);
  const data = usage.data;
  if (!data) return null;

  const number = (value: number) => value.toLocaleString(locale === "ar" ? "ar-EG" : "en-US");
  const withLimit = (used: number | null, limit: number | null, show: (v: number) => string = number) =>
    used === null ? "—" : limit === null ? show(used) : fmt(t.of, { used: show(used), limit: show(limit) });

  const tiles: Array<{ label: string; value: string; ratio: number | null }> = [
    { label: t.orders, value: number(data.current.orders), ratio: null },
    { label: t.messages, value: number(data.current.messages), ratio: null },
    { label: t.ai, value: number(data.current.aiRequests), ratio: null },
    {
      label: t.storage,
      value: withLimit(data.current.storageBytes, data.limits.storage_bytes, bytes),
      ratio: data.limits.storage_bytes ? data.current.storageBytes / data.limits.storage_bytes : null,
    },
    {
      label: t.members,
      value: withLimit(data.seats.members, data.limits.members),
      ratio: data.limits.members && data.seats.members !== null ? data.seats.members / data.limits.members : null,
    },
    {
      label: t.domains,
      value: withLimit(data.seats.domains, data.limits.domains),
      ratio: data.limits.domains && data.seats.domains !== null ? data.seats.domains / data.limits.domains : null,
    },
  ];

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-ink">{t.title}</h3>
        {data.current.updatedAt && (
          <span className="text-xs text-ink-soft">{fmt(t.updated, { when: new Date(data.current.updatedAt).toLocaleTimeString() })}</span>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-[10px] border border-line bg-paper px-3 py-2">
            <dt className="text-xs text-ink-soft">{tile.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">{tile.value}</dd>
            {tile.ratio !== null && (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
                <div
                  className={tile.ratio >= 1 ? "h-full bg-danger" : "h-full bg-primary"}
                  style={{ width: `${Math.min(100, Math.round(tile.ratio * 100))}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}
