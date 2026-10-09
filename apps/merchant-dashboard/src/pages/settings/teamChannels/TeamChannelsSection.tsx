import { useState } from "react";
import { Button } from "@store-builder/ui";
import {
  ApiError,
  teamChannelsDelete,
  teamChannelsDeliveries,
  teamChannelsList,
  teamChannelsTest,
  teamChannelsUpdate,
  type TeamChannel,
  type TeamChannelList,
  type TeamChannelProvider,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { canManageStoreSettings } from "@/lib/fulfilmentAccess";
import { formatDateTime } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { NOTIFICATION_STRINGS } from "@/lib/notificationText";
import { fmt, useT } from "@/i18n/LocaleContext";
import { IconChat, IconDelete, IconEdit, IconMessage, IconPlus, IconSend, type IconComponent } from "@/components/icons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { SettingsIconTile, SettingsSwitch, type SettingsTone } from "@/components/settings";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { PaneSkeleton, SettingsCard } from "../sections/SettingsCard";
import { TeamChannelDialog } from "./TeamChannelDialog";
import { TEAM_CHANNEL_STRINGS, alertTypeLabel, providerLabel, type TeamChannelStrings } from "./teamChannelStrings";

/* Generic glyphs, not the brands' marks: the provider's name beside the tile says which it is. */
const PROVIDER_LOOK: Record<TeamChannelProvider, { icon: IconComponent; tone: SettingsTone }> = {
  telegram: { icon: IconSend, tone: "blue" },
  slack: { icon: IconMessage, tone: "purple" },
  discord: { icon: IconChat, tone: "teal" },
};

const MAX_CHANNELS = 10;

/** Working / problem / paused / nothing sent yet — in words, with the tone only helping. */
function statusOf(t: TeamChannelStrings, channel: TeamChannel): { text: string; tone: "success" | "danger" | "neutral" } {
  if (!channel.isActive) return { text: t.paused, tone: "neutral" };
  if (channel.lastStatus === "failed") return { text: channel.lastError ? fmt(t.problem, { error: channel.lastError }) : t.problemPlain, tone: "danger" };
  if (channel.lastStatus === "sent") return { text: t.working, tone: "success" };
  return { text: t.notTried, tone: "neutral" };
}

/**
 * Settings → Notifications → «قنوات الفريق» (handoff 378): the store's
 * Telegram, Slack and Discord channels and the alerts each one gets. A card
 * per channel — what it is, how its last message went, its on/off switch,
 * and «إرسال رسالة تجريبية», «آخر الرسائل», «تعديل», «حذف».
 *
 * The list needs workspace.manage: a system role without it gets no section
 * at all (the pane above is that person's own notifications); a custom role
 * the server refuses reads DataState's no-permission message.
 */
export function TeamChannelsSection() {
  const t = useT(TEAM_CHANNEL_STRINGS);
  const nt = useT(NOTIFICATION_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const allowed = canManageStoreSettings(currentWorkspace?.role);

  const list = useAsync<TeamChannelList | null>(() => (allowed ? teamChannelsList(apiClient, workspaceId) : Promise.resolve(null)), [workspaceId, allowed]);
  // null = closed, "new" = adding, a channel = editing it.
  const [editing, setEditing] = useState<TeamChannel | "new" | null>(null);
  const [deleting, setDeleting] = useState<TeamChannel | null>(null);
  const [showing, setShowing] = useState<TeamChannel | null>(null);
  // "<id>:test" or "<id>:switch" while that call runs.
  const [busy, setBusy] = useState<string | null>(null);

  if (!allowed) return null;

  const data = list.data;
  const channels = data?.channels ?? [];
  const full = channels.length >= MAX_CHANNELS;

  const replace = (channel: TeamChannel) =>
    list.setData((current) => (current ? { ...current, channels: current.channels.map((existing) => (existing.id === channel.id ? channel : existing)) } : current));

  async function test(channel: TeamChannel) {
    if (busy) return;
    setBusy(`${channel.id}:test`);
    try {
      const { result, channel: fresh } = await teamChannelsTest(apiClient, workspaceId, channel.id);
      replace(fresh);
      if (result.status === "sent") toast.success(data?.adapter.sandbox ? t.testSentSandbox : fmt(t.testSent, { name: channel.name }));
      else toast.error(result.error ? fmt(t.testFailed, { error: result.error }) : t.testFailedPlain);
    } catch (err) {
      toast.error(err instanceof ApiError && err.code === "TEAM_CHANNEL_UNAVAILABLE" ? t.err_unavailable : errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function setActive(channel: TeamChannel, isActive: boolean) {
    if (busy) return;
    setBusy(`${channel.id}:switch`);
    replace({ ...channel, isActive });
    try {
      replace(await teamChannelsUpdate(apiClient, workspaceId, channel.id, { isActive }));
      toast.success(isActive ? t.switchedOn : t.switchedOff);
    } catch (err) {
      replace(channel);
      toast.error(err instanceof ApiError && err.code === "TEAM_CHANNEL_TYPE_FORBIDDEN" ? t.err_forbidden : errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const addButton = (
    <Button type="button" className="min-h-11 rounded-full px-5 md:min-h-9" disabled={full} onClick={() => setEditing("new")}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.add}
    </Button>
  );

  return (
    <>
      <SettingsCard
        id="team-channels"
        title={t.title}
        description={t.description}
        actions={data?.adapter.available ? addButton : undefined}
      >
        <DataState loading={list.loading && !data} error={list.error} onRetry={() => void list.refresh()} skeleton={<PaneSkeleton rows={2} />}>
          {data && (
            <div className="space-y-3">
              {(data.adapter.sandbox || !data.adapter.available) && (
                <p>
                  {!data.adapter.available ? (
                    <StatusBadge value="unavailable" tone="neutral" text={t.unavailable} />
                  ) : (
                    <StatusBadge value="sandbox" tone="warning" text={t.sandbox} className="whitespace-normal" />
                  )}
                </p>
              )}

              {channels.length === 0 ? (
                data.adapter.available && (
                  <div className="rounded-[var(--radius)] bg-paper-sunken/60 px-4 py-5 text-center ring-1 ring-line">
                    <p className="text-sm font-semibold text-ink">{t.empty}</p>
                    <p className="mx-auto mt-1 max-w-md text-[13px] leading-5 text-ink-soft">{t.emptyBody}</p>
                  </div>
                )
              ) : (
                <ul className="space-y-3">
                  {channels.map((channel) => {
                    const look = PROVIDER_LOOK[channel.provider] ?? PROVIDER_LOOK.telegram;
                    const status = statusOf(t, channel);
                    const pausedByServer = !channel.isActive && channel.failureCount >= 10;
                    return (
                      <li key={channel.id} data-team-channel={channel.id} className="rounded-[var(--radius)] ring-1 ring-line">
                        <div className="flex flex-wrap items-start gap-3 px-4 pt-4">
                          <SettingsIconTile icon={look.icon} tone={look.tone} size="md" />
                          <div className="min-w-0 flex-[1_1_12rem]">
                            <p className="text-sm leading-5 font-semibold text-ink">
                              <bdi>{channel.name}</bdi>
                            </p>
                            <p className="mt-0.5 text-[13px] leading-5 text-ink-soft">
                              {providerLabel(t, channel.provider)}
                              {channel.hint && (
                                <>
                                  {" · "}
                                  <bdi dir="ltr" className="break-all">
                                    {channel.hint}
                                  </bdi>
                                </>
                              )}
                            </p>
                          </div>
                          <StatusBadge value={status.tone} tone={status.tone} text={status.text} className="max-w-full whitespace-normal text-start" />
                        </div>

                        <div className="px-4 pt-3">
                          {channel.types.length === 0 ? (
                            <p className="text-[13px] text-ink-soft">{t.noTypes}</p>
                          ) : (
                            <ul className="flex flex-wrap gap-1.5" aria-label={t.types}>
                              {channel.types.map((type) => (
                                <li key={type} className="rounded-full bg-paper-sunken px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                                  {alertTypeLabel(t, nt, type)}
                                </li>
                              ))}
                            </ul>
                          )}
                          {channel.lastSentAt && (
                            <p className="mt-2 text-xs text-ink-soft">
                              <time dateTime={channel.lastSentAt} title={formatDateTime(channel.lastSentAt)}>
                                {fmt(t.lastSent, { when: formatRelativeTime(channel.lastSentAt) })}
                              </time>
                            </p>
                          )}
                          {pausedByServer && <p className="mt-2 text-[13px] leading-5 font-medium text-danger">{t.pausedByServer}</p>}
                        </div>

                        <div className="mt-3 border-t border-line">
                          <SettingsSwitch
                            label={t.active}
                            hint={t.activeHint}
                            checked={channel.isActive}
                            busy={busy === `${channel.id}:switch`}
                            className="before:hidden first:rounded-t-none"
                            onChange={(next) => void setActive(channel, next)}
                          />
                        </div>

                        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
                          <Button type="button" variant="outline" size="sm" className="min-h-11 md:min-h-9" disabled={busy !== null} onClick={() => void test(channel)}>
                            <IconSend className="size-4 rtl:-scale-x-100" aria-hidden />
                            {busy === `${channel.id}:test` ? t.testing : t.test}
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => setShowing(channel)}>
                            {t.recent}
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => setEditing(channel)}>
                            <IconEdit className="size-4" aria-hidden />
                            {t.edit}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="min-h-11 text-danger hover:text-danger md:min-h-9" onClick={() => setDeleting(channel)}>
                            <IconDelete className="size-4" aria-hidden />
                            {t.delete}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {full && <p className="text-[13px] leading-5 text-ink-soft">{t.limitReached}</p>}
            </div>
          )}
        </DataState>
      </SettingsCard>

      {editing !== null && data && (
        <TeamChannelDialog
          channel={editing === "new" ? null : editing}
          providers={data.providers}
          types={data.types}
          onClose={() => setEditing(null)}
          onSaved={(channel, created) => {
            setEditing(null);
            if (created) list.setData((current) => (current ? { ...current, channels: [...current.channels, channel] } : current));
            else replace(channel);
            toast.success(created ? t.created : t.saved);
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? fmt(t.deleteTitle, { name: deleting.name }) : ""}
        description={t.deleteBody}
        confirmLabel={t.delete}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await teamChannelsDelete(apiClient, workspaceId, deleting.id);
          list.setData((current) => (current ? { ...current, channels: current.channels.filter((existing) => existing.id !== deleting.id) } : current));
          setDeleting(null);
          toast.success(t.deleted);
        }}
      />

      {showing && <RecentMessages channel={showing} onClose={() => setShowing(null)} />}
    </>
  );
}

/** «آخر الرسائل»: the last 50 messages this channel was sent, newest first, and why a failed one failed. */
function RecentMessages({ channel, onClose }: { channel: TeamChannel; onClose: () => void }) {
  const t = useT(TEAM_CHANNEL_STRINGS);
  const nt = useT(NOTIFICATION_STRINGS);
  const workspaceId = useWorkspaceId();
  const deliveries = useAsync(() => teamChannelsDeliveries(apiClient, workspaceId, channel.id), [workspaceId, channel.id]);
  const rows = deliveries.data ?? [];

  const typeLabel = (type: string) => (type === "test" ? t.delivery_test : type === "automation_step" ? t.delivery_automation_step : alertTypeLabel(t, nt, type));

  return (
    <Modal
      open
      onClose={onClose}
      title={fmt(t.recentTitle, { name: channel.name })}
      description={t.recentHint}
      className="sm:max-w-lg"
      footer={
        <Button type="button" variant="outline" onClick={onClose}>
          {t.close}
        </Button>
      }
    >
      <DataState
        loading={deliveries.loading}
        error={deliveries.error}
        onRetry={() => void deliveries.refresh()}
        empty={rows.length === 0}
        emptyMessage={t.recentEmpty}
        skeleton={<PaneSkeleton rows={3} />}
      >
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id} className="py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="min-w-0 text-sm font-medium text-ink">{typeLabel(row.type)}</p>
                <StatusBadge value={row.status} tone={row.status === "sent" ? "success" : "danger"} text={row.status === "sent" ? t.delivery_sent : t.delivery_failed} />
              </div>
              <p className="mt-0.5 text-xs text-ink-soft">
                <time dateTime={row.createdAt}>{formatDateTime(row.createdAt)}</time>
              </p>
              {row.error && (
                <p className="mt-1 text-[13px] leading-5 text-danger">
                  <bdi dir="auto">{row.error}</bdi>
                </p>
              )}
            </li>
          ))}
        </ul>
      </DataState>
    </Modal>
  );
}
