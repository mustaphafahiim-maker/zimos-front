import { useState } from "react";
import { dashboardSetupGuide, type SetupGuide } from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { apiClient } from "@/lib/apiClient";
import { canViewAnalytics } from "@/lib/analyticsAccess";
import { HelpCards } from "@/components/Education";
import { SetupGuideCard } from "@/pages/home/SetupGuideCard";
import type { HomeRange, HomeSectionProps } from "@/pages/home/today/homeTime";
import { TodayHeader } from "@/pages/home/today/TodayHeader";
import { WorkQueue } from "@/pages/home/today/WorkQueue";
import { TodayStats } from "@/pages/home/today/TodayStats";
import { MoneyRow } from "@/pages/home/today/MoneyRow";
import { OrderJourney } from "@/pages/home/today/OrderJourney";
import { AdsCard } from "@/pages/home/today/AdsCard";
import { ProductsCards } from "@/pages/home/today/ProductsCards";
import { LatestOrders } from "@/pages/home/today/LatestOrders";
import { SetupRow } from "@/pages/home/today/SetupRow";
import { HomeDetails } from "@/pages/home/today/HomeDetails";

/**
 * «اليوم» — the home. It answers, in this order and without being asked:
 * what is waiting for me now → what did today bring → where is my money →
 * are the ads paying → what is moving and what is stuck. Each section below
 * is one of those answers; it fetches its own numbers, holds its own room
 * while they load, hides itself on a 403 and offers a retry on any other
 * failure — so the page itself never shows a spinner or an error.
 *
 * Roles without analytics.view see the header, the setup guide, the work
 * queue and the latest orders; the analytics sections are not rendered (and
 * not requested) for them.
 *
 * The setup guide: the full card right under the header while the store has
 * no first order; after that one slim row near the end; nothing once every
 * required step is done or the merchant hid it.
 */
export function DashboardHomePage() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const workspaceId = useWorkspaceId();
  const role = currentWorkspace?.role;
  const analytics = canViewAnalytics(role);
  // The page opens on today, every time: it is «اليوم». The period is for looking back, then coming home.
  const [range, setRange] = useState<HomeRange>("today");

  // Any member may read the guide. It is an extra: it shows once it has something to say, and a
  // failed request simply shows no guide (the sections below carry their own states).
  const guide = useCachedAsync<SetupGuide | null>(
    `home:setup:${workspaceId}`,
    () => dashboardSetupGuide(apiClient, workspaceId).catch(() => null),
    [workspaceId]
  );
  // While another store's guide is on its way the last answer is not this store's: show none.
  const setup = !guide.loading && guide.data && !guide.data.done ? guide.data : null;
  const hasFirstOrder = Boolean(setup?.steps?.some((step) => step.key === "order" && step.done));

  const section: HomeSectionProps = { workspaceId, range, role };

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-6">
      <TodayHeader
        workspaceId={workspaceId}
        range={range}
        onRangeChange={setRange}
        role={role}
        storeName={currentWorkspace?.name}
        userName={user?.fullName}
      />

      {/* A new store: getting ready comes first, as the whole checklist (it reads and hides itself). */}
      {setup && !hasFirstOrder && <SetupGuideCard className="" />}

      <WorkQueue {...section} />

      {analytics && (
        <>
          <TodayStats {...section} />
          <MoneyRow {...section} />
          <OrderJourney {...section} />
          <AdsCard {...section} />
          <ProductsCards {...section} />
        </>
      )}

      <LatestOrders {...section} />

      {/* A store that is already selling: what is left of the checklist, as one slim row. */}
      {setup && hasFirstOrder && <SetupRow key={workspaceId} guide={setup} workspaceId={workspaceId} />}

      {analytics && <HomeDetails {...section} />}

      {/* Help center, Telegram and support chat, when ZIMOS has set them (components/Education.tsx). */}
      <HelpCards />
    </div>
  );
}
