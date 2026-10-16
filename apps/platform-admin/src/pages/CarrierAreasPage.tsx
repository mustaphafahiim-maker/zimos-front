import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import {
  adminCarrierAreaReset,
  adminCarrierAreaSet,
  adminCarrierAreas,
  type AdminCarrierArea,
  type AdminCarrierPathNode,
} from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { FilterChips, SearchInput } from "@/components/forms";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { P } from "@/lib/permissions";
import { useAsync } from "@/lib/useAsync";

type Show = "all" | "missing" | "overridden" | "platform";
const SHOWN = 200;

const pathText = (path: AdminCarrierPathNode[]) => path.map((n) => n.name).join(" › ");
const samePath = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * A courier's areas map for every store (SPEC §17.5 "shipping carriers and
 * city mapping"): where each place of the platform's list sits on the
 * courier's own list. Name matching fills it; where stores keep picking
 * something else, the console can make their pick the default for everyone.
 */
export function CarrierAreasPage() {
  const { code = "" } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const [country, setCountry] = useState("EG");
  const [show, setShow] = useState<Show>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const { data, loading, error, refresh, setData } = useAsync(() => adminCarrierAreas(apiClient, code, country), [code, country]);
  const canManage = can(P.PROVIDERS_MANAGE);

  const names = useMemo(() => new Map((data?.regions ?? []).map((r) => [r.code, r.nameEn])), [data]);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.regions ?? []).filter((r) => {
      if (r.level !== "city") return false;
      if (show === "missing" && r.shared) return false;
      if (show === "overridden" && r.overriddenBy === 0) return false;
      if (show === "platform" && r.shared?.source !== "manual") return false;
      return !needle || r.nameEn.toLowerCase().includes(needle) || r.nameAr.includes(needle) || r.code.includes(needle);
    });
  }, [data, show, query]);

  function replace(next: AdminCarrierArea) {
    if (data) setData({ ...data, regions: data.regions.map((r) => (r.code === next.code ? next : r)) });
    void refresh({ silent: true });
  }

  async function choose(area: AdminCarrierArea, carrierPath: string[]) {
    setBusy(area.code);
    try {
      const { shared } = await adminCarrierAreaSet(apiClient, code, area.code, carrierPath);
      replace({ ...area, shared });
      toast.success(`${area.nameEn} now uses this area for every store.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function reset(area: AdminCarrierArea) {
    setBusy(area.code);
    try {
      await adminCarrierAreaReset(apiClient, code, area.code);
      replace({ ...area, shared: null });
      toast.success(`${area.nameEn} is back to name matching.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const counts = data?.counts;
  return (
    <div>
      <PageHeader
        title={data ? `Areas map — ${data.carrier.name}` : "Areas map"}
        description="Where each city of the platform's list sits on this courier's own list, for every store. A store's own choice still wins for that store."
        back={{ to: "/carriers", label: "Carriers" }}
      />
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && counts && (
          <div className="space-y-4">
            {data.carrier.countries.length > 1 && (
              <FilterChips options={data.carrier.countries.map((c) => ({ value: c, label: c }))} value={country} onChange={setCountry} />
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ["Cities", counts.cities],
                ["Matched by name", counts.auto],
                ["Platform's choice", counts.platform],
                ["Not on the map", counts.missing],
                ["Stores picked otherwise", counts.overridden],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-3">
                  <p className="text-xs text-ink-soft">{label}</p>
                  <p className="tabular text-xl font-semibold text-ink">{formatNumber(Number(value))}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FilterChips<Show>
                options={[
                  { value: "all", label: "All", count: counts.cities },
                  { value: "missing", label: "Not on the map", count: counts.missing },
                  { value: "overridden", label: "Stores picked otherwise", count: counts.overridden },
                  { value: "platform", label: "Platform's choice", count: counts.platform },
                ]}
                value={show}
                onChange={setShow}
              />
              <SearchInput value={query} onChange={setQuery} placeholder="Search cities" />
            </div>
            <Panel flush>
              {rows.length === 0 ? (
                <EmptyBlock message="No city matches." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <Th>City</Th>
                      <Th>On the courier's list</Th>
                      <Th>What stores picked</Th>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, SHOWN).map((r) => (
                      <TableRow key={r.code} className="align-top">
                        <Td>
                          <span className="font-medium">{r.nameEn}</span> <span dir="rtl" className="text-ink-soft">{r.nameAr}</span>
                          <p className="text-xs text-ink-soft">{r.parentCode ? names.get(r.parentCode) : ""}</p>
                          <Mono className="mt-1 block w-fit">{r.code}</Mono>
                        </Td>
                        <Td>
                          {r.shared ? (
                            <>
                              <p>{pathText(r.shared.path)}</p>
                              <StatusBadge tone={r.shared.source === "manual" ? "primary" : "neutral"} className="mt-1">
                                {r.shared.source === "manual" ? "Platform's choice" : "Matched by name"}
                              </StatusBadge>
                              {canManage && r.shared.source === "manual" && (
                                <Button size="sm" variant="ghost" className="ms-2" disabled={busy === r.code} onClick={() => void reset(r)}>
                                  Back to name matching
                                </Button>
                              )}
                            </>
                          ) : (
                            <StatusBadge tone="warning">Not on the map</StatusBadge>
                          )}
                        </Td>
                        <Td>
                          {r.storeChoices.length === 0 ? (
                            <span className="text-xs text-ink-soft">—</span>
                          ) : (
                            <ul className="space-y-1.5">
                              {r.storeChoices.map((c) => (
                                <li key={c.carrierPath.join("/")} className="flex flex-wrap items-center gap-2">
                                  <span>{pathText(c.path)}</span>
                                  <span className="text-xs text-ink-soft">
                                    {c.stores} {c.stores === 1 ? "store" : "stores"}
                                  </span>
                                  {canManage && !(r.shared && samePath(r.shared.carrierPath, c.carrierPath)) && (
                                    <Button size="sm" variant="outline" disabled={busy === r.code} onClick={() => void choose(r, c.carrierPath)}>
                                      Use for every store
                                    </Button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </Td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {rows.length > SHOWN && (
                <p className="border-t border-line px-4 py-2 text-xs text-ink-soft">
                  Showing {SHOWN} of {formatNumber(rows.length)}. Search or filter to narrow it down.
                </p>
              )}
            </Panel>
          </div>
        )}
      </DataState>
    </div>
  );
}
