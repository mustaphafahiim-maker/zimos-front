import { useMemo } from "react";
import { IconCopy } from "@/components/icons";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import {
  FEED_CHANNELS,
  feedChannelFollowsStore,
  feedChannelSettingsOf,
  type FeedChannel,
  type FeedChannelSettings,
  type FeedChannelsSettings,
  type FeedSettings,
  type FeedState,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { AdPlatformMark } from "@/components/AdPlatformMark";
import { DataState } from "@/components/DataState";
import { AccordionGroup, AccordionSection } from "@/components/Accordion";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { OfferSwitch, TOUCH_FIELD } from "./OfferKit";

const STRINGS = {
  en: {
    title: "Channels",
    hint: "Each channel has its own link. Paste it into the platform's catalog as a scheduled feed — XML unless the platform asks for CSV.",
    storeOff: "The feed is switched off for the whole store above, so no channel's link answers yet.",
    channel_meta: "Meta (Facebook and Instagram)",
    channel_google: "Google Merchant Center",
    channel_tiktok: "TikTok",
    channel_snapchat: "Snapchat",
    summary: "{state} · {count}",
    live: "Live",
    off: "Off",
    waitsForStore: "Waits for the store's feed",
    switchLabel: "Publish the {name} feed",
    held: "Waiting for the checklist",
    count: "{items} items from {products} products are in this channel's feed.",
    countEmpty: "No products are in this channel's feed.",
    linkLabel: "{name} feed link",
    copyXml: "Copy XML link",
    copyCsv: "CSV",
    copied: "Link copied.",
    useStore: "Use the store settings",
    useStoreHint: "The same collections and stock rule as the store-wide settings above.",
    collections: "Collections in this channel",
    collectionsHint: "Tick none to send the whole catalog.",
    collectionsEmpty: "The store has no collections yet, so this channel gets the whole catalog.",
    excludeOut: "Leave out sold-out items",
    requireChecklist: "Don't publish until the Google checklist is complete",
    heldBack: "Google isn't getting this feed yet: the checklist below isn't complete.",
    seeChecklist: "See the checklist",
  },
  ar: {
    title: "القنوات",
    hint: "كل قناة ليها لينك خاص بيها. الصقه في كتالوج المنصة كملف مجدول — XML إلا لو المنصة طلبت CSV.",
    storeOff: "الملف مقفول للمتجر كله من فوق، فمفيش لينك قناة شغّال لسه.",
    channel_meta: "Meta (فيسبوك وإنستجرام)",
    channel_google: "Google Merchant Center",
    channel_tiktok: "TikTok",
    channel_snapchat: "Snapchat",
    summary: "{state} · {count}",
    live: "شغّال",
    off: "مقفول",
    waitsForStore: "مستني ملف المتجر",
    switchLabel: "انشر ملف {name}",
    held: "مستني القايمة",
    count: "{items} عنصر من {products} منتج في ملف القناة دي.",
    countEmpty: "مفيش منتجات في ملف القناة دي.",
    linkLabel: "لينك ملف {name}",
    copyXml: "انسخ لينك XML",
    copyCsv: "CSV",
    copied: "اتنسخ اللينك.",
    useStore: "استخدم إعدادات المتجر",
    useStoreHint: "نفس المجموعات وقاعدة المخزون اللي في إعدادات المتجر فوق.",
    collections: "المجموعات في القناة دي",
    collectionsHint: "لو مختارتش حاجة، بيتبعت الكتالوج كله.",
    collectionsEmpty: "المتجر مفيهوش مجموعات لسه، فالقناة دي بتاخد الكتالوج كله.",
    excludeOut: "استبعد المنتجات الخلصانة",
    requireChecklist: "متنشرش غير لما قايمة جوجل تكمل",
    heldBack: "جوجل مش واخد الملف ده لسه: القايمة اللي تحت لسه مكملتش.",
    seeChecklist: "شوف القايمة",
  },
} satisfies Messages;

/** The id ProductFeedPage gives its Google Merchant checklist card, so a held-back Google feed can point at it. */
export const FEED_CHECKLIST_ID = "google-merchant-checklist";

/** Every channel's own settings, whatever the API sent: one left out would fall back to the defaults. */
export function feedChannelsOf(source: FeedSettings): FeedChannelsSettings {
  return Object.fromEntries(FEED_CHANNELS.map((channel) => [channel, feedChannelSettingsOf(source.channels, channel)])) as FeedChannelsSettings;
}

/**
 * Product feeds per channel (handoff 264): under the store-wide settings, one
 * section for Meta, Google, TikTok and Snapchat — closed to one row that says
 * where it stands and what it holds, with its Live / Off switch at the end;
 * opened, its link, and either "Use the store settings" or its own collections
 * and sold-out rule. Google can also wait for the Merchant checklist. The
 * sections edit the same draft the page saves, with the page's own save bar.
 */
export function FeedChannelCards({
  state,
  draft,
  busy,
  linkBase,
  onChange,
  onSeeChecklist,
}: {
  /** What the server holds: each channel's state and counts. */
  state: FeedState;
  /** What is being edited (the page's whole feed draft). */
  draft: FeedSettings;
  busy: boolean;
  /** The API base as an absolute URL: the links are paths under it. */
  linkBase: string;
  onChange: (channels: FeedChannelsSettings) => void;
  /** Opens the Google Merchant checklist further down the page and goes to it. */
  onSeeChecklist: () => void;
}) {
  const t = useT(STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const collections = useAsync(() => apiClient.listCollections(workspaceId), [workspaceId]);

  // Every channel, always: one left out of a save would fall back to the defaults.
  const edited = useMemo(() => feedChannelsOf(draft), [draft.channels]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (channel: FeedChannel, next: Partial<FeedChannelSettings>) => onChange({ ...edited, [channel]: { ...edited[channel], ...next } });

  async function copy(path: string) {
    try {
      await navigator.clipboard.writeText(`${linkBase}${path}`);
      toast.success(t.copied);
    } catch {
      /* the link is on screen to select */
    }
  }

  const check = "size-5 shrink-0 cursor-pointer accent-primary";

  return (
    <section className="space-y-2" aria-labelledby="feed-channels-title">
      <div className="px-4">
        <h2 id="feed-channels-title" className="text-[13px] leading-5 font-semibold text-ink-soft">
          {t.title}
        </h2>
        <p className="mt-0.5 text-[13px] leading-5 text-ink-soft">{state.feed.enabled ? t.hint : t.storeOff}</p>
      </div>

      <AccordionGroup>
        {FEED_CHANNELS.map((channel) => {
          const name = t[`channel_${channel}`];
          const own = edited[channel];
          const status = state.channels?.[channel];
          const follows = feedChannelFollowsStore(own);
          const ownCollections = own.collectionIds ?? [];
          // The link answers only for a channel the server has live (the saved state, not the draft).
          const linkOff = status ? !status.live : !state.feed.enabled;
          const countLine = status ? (status.itemCount > 0 ? fmt(t.count, { items: status.itemCount, products: status.productCount }) : t.countEmpty) : undefined;
          const held = Boolean(status?.heldBackByChecklist);
          // Switched on, but nothing is live while the store-wide feed above is off.
          const waits = own.enabled && !draft.enabled;
          const stateWord = held ? t.held : waits ? t.waitsForStore : own.enabled ? t.live : t.off;
          return (
            <AccordionSection
              key={channel}
              title={name}
              summary={countLine ? fmt(t.summary, { state: stateWord, count: countLine }) : stateWord}
              keepMounted
              persistKey={`feed:${channel}`}
              badge={<AdPlatformMark platform={channel} decorative className="h-6 w-8 max-[24rem]:hidden" />}
              actions={<OfferSwitch checked={own.enabled} disabled={busy} label={fmt(t.switchLabel, { name })} onChange={(next) => patch(channel, { enabled: next })} />}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StatusBadge
                    value={held ? "held" : waits ? "waiting" : own.enabled ? "active" : "disabled"}
                    tone={held ? "warning" : own.enabled && !waits ? "success" : "neutral"}
                    text={stateWord}
                  />
                  {countLine && <p className="text-[13px] leading-5 text-ink-soft tabular-nums">{countLine}</p>}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Input
                    aria-label={fmt(t.linkLabel, { name })}
                    dir="ltr"
                    readOnly
                    value={`${linkBase}${state.links[channel].xml}`}
                    onFocus={(e) => e.target.select()}
                    className={cn("min-w-0 flex-1 basis-56", TOUCH_FIELD)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 shrink-0 rounded-full px-4 md:min-h-10"
                    disabled={linkOff}
                    onClick={() => void copy(state.links[channel].xml)}
                  >
                    <IconCopy className="size-4" aria-hidden />
                    {t.copyXml}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 shrink-0 rounded-full px-4 md:min-h-10"
                    disabled={linkOff}
                    onClick={() => void copy(state.links[channel].csv)}
                  >
                    {t.copyCsv}
                  </Button>
                </div>

                <div>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
                    <input
                      type="checkbox"
                      className={check}
                      checked={follows}
                      disabled={busy}
                      onChange={(e) =>
                        patch(
                          channel,
                          e.target.checked
                            ? { collectionIds: null, excludeOutOfStock: null }
                            : // Its own choices start from the store's, so unticking changes nothing until something is edited.
                              { collectionIds: [...draft.collectionIds], excludeOutOfStock: draft.excludeOutOfStock }
                        )
                      }
                    />
                    {t.useStore}
                  </label>
                  {follows && <p className="ms-8 text-xs text-ink-soft">{t.useStoreHint}</p>}
                </div>

                {!follows && (
                  <div data-slot="offer-tier" className="space-y-3 rounded-[1rem] bg-paper-raised p-3 ring-1 ring-line">
                    <fieldset disabled={busy} className="min-w-0">
                      <legend className="text-sm font-medium text-ink">{t.collections}</legend>
                      <DataState loading={collections.loading} error={collections.error} onRetry={() => void collections.refresh()}>
                        {(collections.data ?? []).length === 0 ? (
                          <p className="mt-1 text-xs text-ink-soft">{t.collectionsEmpty}</p>
                        ) : (
                          <>
                            <p className="mt-0.5 text-xs text-ink-soft">{t.collectionsHint}</p>
                            <ul className="zimos-offer-checklist mt-2 max-h-52 divide-y divide-line overflow-y-auto overscroll-contain rounded-[0.875rem] bg-paper-raised ring-1 ring-line">
                              {(collections.data ?? []).map((collection) => (
                                <li key={collection.id}>
                                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1.5 text-sm text-ink hover:bg-ink/4">
                                    <input
                                      type="checkbox"
                                      className={check}
                                      checked={ownCollections.includes(collection.id)}
                                      onChange={(e) =>
                                        patch(channel, {
                                          collectionIds: e.target.checked ? [...ownCollections, collection.id] : ownCollections.filter((id) => id !== collection.id),
                                        })
                                      }
                                    />
                                    <span className="min-w-0 truncate">
                                      <bdi>{collection.name}</bdi>
                                    </span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </DataState>
                    </fieldset>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
                      <input
                        type="checkbox"
                        className={check}
                        checked={own.excludeOutOfStock ?? draft.excludeOutOfStock}
                        disabled={busy}
                        onChange={(e) => patch(channel, { excludeOutOfStock: e.target.checked, collectionIds: ownCollections })}
                      />
                      {t.excludeOut}
                    </label>
                  </div>
                )}

                {channel === "google" && (
                  <>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
                      <input
                        type="checkbox"
                        className={check}
                        checked={own.requireChecklist}
                        disabled={busy}
                        onChange={(e) => patch(channel, { requireChecklist: e.target.checked })}
                      />
                      {t.requireChecklist}
                    </label>
                    {status?.heldBackByChecklist && (
                      <Alert variant="info">
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                          <span className="min-w-0 flex-1 basis-56">{t.heldBack}</span>
                          <button
                            type="button"
                            className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-2 font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                            onClick={onSeeChecklist}
                          >
                            {t.seeChecklist}
                          </button>
                        </div>
                      </Alert>
                    )}
                  </>
                )}
              </div>
            </AccordionSection>
          );
        })}
      </AccordionGroup>
    </section>
  );
}
