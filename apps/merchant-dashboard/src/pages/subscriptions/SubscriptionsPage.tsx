import { useSearchParams } from "react-router-dom";
import { IconSliders, IconSubscriptions } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Segmented } from "@/components/Segmented";
import { useT } from "@/i18n/LocaleContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { PlansView } from "./PlansView";
import { SubscriptionsView } from "./SubscriptionsView";
import { SUBSCRIPTION_STRINGS } from "./subscriptionText";

type View = "list" | "plans";

/**
 * /subscriptions (SPEC §18.1): what renews, what failed, and how each product
 * is sold. Two views behind one switch — the subscriptions themselves, and
 * the plan of each product; the chosen one lives in `?tab=` (absent = the
 * subscriptions), so a link or a refresh lands on the same view.
 */
export function SubscriptionsPage() {
  const t = useT(SUBSCRIPTION_STRINGS);
  const workspaceId = useWorkspaceId();
  const phone = useIsPhone();
  const [params, setParams] = useSearchParams();
  const view: View = params.get("tab") === "plans" ? "plans" : "list";

  function selectView(next: View) {
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next === "list") out.delete("tab");
        else out.set("tab", next);
        return out;
      },
      { replace: true }
    );
  }

  return (
    <div className="max-w-6xl">
      {/* A phone keeps the first screen for the list: the sentence is for wider screens. */}
      <PageHeader title={t.title} description={phone ? undefined : t.description} />
      <Segmented<View>
        className="mb-4 max-sm:w-full"
        label={t.views}
        value={view}
        onChange={selectView}
        options={[
          { value: "list", label: t.tabList, icon: IconSubscriptions },
          { value: "plans", label: t.tabPlans, icon: IconSliders },
        ]}
      />
      {/* Keyed on the workspace so switching stores resets each view's local state. */}
      {view === "list" ? <SubscriptionsView key={workspaceId} onGoToPlans={() => selectView("plans")} /> : <PlansView key={workspaceId} />}
    </div>
  );
}
