import { Link, useParams } from "react-router-dom";
import { IconRotate, IconUnplug } from "@/components/icons";
import { Button } from "@store-builder/ui";
import { ApiError, partnerAppEmbed } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";

/**
 * Apps → an installed partner app → «افتح» (frontend-handoff 265): the app's
 * own page, in a frame as wide as the dashboard's content.
 *
 * The address is signed by the server for this store and this person and is
 * good for five minutes, so it is asked for each time the page opens (and by
 * «حمّل تاني»), never kept. Any member of the store may open it. An install
 * without a page answers 404: the page says so and points back to Apps.
 */

const STRINGS = {
  en: {
    title: "App",
    back: "Apps",
    reload: "Reload",
    frameTitle: "{name} — the app's page",
    noPageTitle: "This app has no page here",
    noPageBody: "It works in the background, or it was removed from this store.",
    toApps: "Back to Apps",
  },
  ar: {
    title: "تطبيق",
    back: "التطبيقات",
    reload: "حمّل تاني",
    frameTitle: "{name} — صفحة التطبيق",
    noPageTitle: "التطبيق ده مالوش صفحة هنا",
    noPageBody: "بيشتغل في الخلفية، أو اتشال من المتجر ده.",
    toApps: "ارجع للتطبيقات",
  },
} satisfies Messages;

export function PartnerAppFramePage() {
  const t = useT(STRINGS);
  const { installId = "" } = useParams<{ installId: string }>();
  const workspaceId = useWorkspaceId();
  const embed = useAsync(() => partnerAppEmbed(apiClient, workspaceId, installId), [workspaceId, installId]);
  const noPage = embed.error instanceof ApiError && embed.error.status === 404;
  const name = embed.data?.name ?? t.title;

  return (
    <div>
      <PageHeader
        title={name}
        back={{ to: "/apps", label: t.back }}
        actions={
          embed.data ? (
            <Button variant="outline" className="min-h-11" disabled={embed.loading} onClick={() => void embed.refresh()}>
              <IconRotate className="size-4" aria-hidden />
              {t.reload}
            </Button>
          ) : undefined
        }
      />
      {noPage ? (
        <EmptyState
          icon={<IconUnplug />}
          title={t.noPageTitle}
          description={t.noPageBody}
          action={
            <Button className="min-h-11" variant="outline" asChild>
              <Link to="/apps">{t.toApps}</Link>
            </Button>
          }
        />
      ) : (
        <DataState loading={embed.loading} error={embed.error} onRetry={() => void embed.refresh()}>
          {embed.data && (
            <iframe
              // A fresh address is a fresh document: the frame starts over on it.
              key={embed.data.url}
              src={embed.data.url}
              title={fmt(t.frameTitle, { name })}
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
              referrerPolicy="no-referrer"
              className="block h-[calc(100dvh-15rem)] min-h-[28rem] w-full rounded-[var(--radius-card)] border border-line bg-paper-raised"
            />
          )}
        </DataState>
      )}
    </div>
  );
}
