import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { Panel, Td, Th } from "@/components/Panel";
import { Toggle } from "@/components/Toggle";
import { SettingRow, useAction } from "@/components/controls";
import { useAsync } from "@/lib/useAsync";
import { formatRelative } from "@/lib/format";
import { ADMIN_ROLES } from "@/mock/constants";
import { PERMISSIONS } from "@/mock/controlSeed";
import { controlApi } from "@/mock/controlApi";
import type { AdminRole } from "@/mock/types";
import type { PermissionKey } from "@/mock/controlTypes";

export function RoleMatrixPanel() {
  const { data, loading, error, refresh, setData } = useAsync(() => controlApi.getRoleMatrix(), []);
  const [confirm2fa, setConfirm2fa] = useState<boolean | null>(null);
  const { busy, run } = useAction();

  const toggle = (role: AdminRole, perm: PermissionKey, granted: boolean) =>
    void run(`${role}:${perm}`, () => controlApi.setRolePermission(role, perm, granted)).then((m) => m && setData(m));

  return (
    <DataState loading={loading} error={error} onRetry={() => void refresh()}>
      {data && (
        <div className="space-y-4">
          <Panel title="Security">
            <SettingRow label="Require two-factor authentication" description="Admins without 2FA are forced to enrol on next sign-in.">
              <ShieldCheck className="size-4 text-ink-soft" aria-hidden />
              <Toggle label="Require 2FA" hideLabel checked={data.require2fa} onChange={(v) => setConfirm2fa(v)} />
            </SettingRow>
          </Panel>
          <Panel flush title="Role permissions" description={`Updated ${formatRelative(data.updatedAt)} · Super admin always has every permission.`}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <Th className="min-w-60">Permission</Th>
                    {ADMIN_ROLES.map((r) => <Th key={r.value} className="text-center">{r.label}</Th>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PERMISSIONS.map((p) => (
                    <TableRow key={p.key}>
                      <Td>
                        <span className="block text-sm">{p.label}</span>
                        <span className="text-xs text-ink-soft">{p.group} · {p.key}</span>
                      </Td>
                      {ADMIN_ROLES.map((r) => {
                        const granted = data.permissions[r.value].includes(p.key);
                        return (
                          <Td key={r.value} className="text-center">
                            <input
                              type="checkbox"
                              aria-label={`${r.label}: ${p.label}`}
                              className="size-4 cursor-pointer accent-[var(--color-primary)] disabled:cursor-not-allowed"
                              checked={r.value === "super_admin" || granted}
                              disabled={r.value === "super_admin" || busy === `${r.value}:${p.key}`}
                              onChange={() => toggle(r.value, p.key, !granted)}
                            />
                          </Td>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
          <ConfirmDialog
            open={confirm2fa !== null}
            title={confirm2fa ? "Require 2FA for all admins?" : "Stop requiring 2FA?"}
            description={confirm2fa ? "Admins without 2FA must enrol before they can continue." : "Admin accounts become protected by password only. Not recommended."}
            confirmLabel={confirm2fa ? "Require 2FA" : "Turn off"}
            destructive={!confirm2fa}
            onCancel={() => setConfirm2fa(null)}
            onConfirm={async () => {
              if (confirm2fa === null) return;
              setData(await controlApi.setRequire2fa(confirm2fa));
              setConfirm2fa(null);
            }}
          />
        </div>
      )}
    </DataState>
  );
}
