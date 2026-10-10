import { Link, useSearchParams } from "react-router-dom";
import { Inbox } from "lucide-react";
import { buttonVariants } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { FilterTabs } from "@/components/FilterTabs";
import { ContactsAllTab } from "./ContactsAllTab";
import { SegmentsTab } from "./SegmentsTab";
import { EmailSuppressionsTab, useSuppressedContactTab } from "./suppressions/EmailSuppressionsTab";
import { EMAIL_SUPPRESSIONS_ENABLED, STORE_REPORTS_ENABLED } from "@/lib/features";
import { isRfmLabel } from "@store-builder/api-client";
import { RfmGroupList } from "./crm/RfmGroupList";
import { RfmGroupsTab } from "./crm/RfmGroupsTab";

const STRINGS = {
  en: {
    title: "Contacts",
    description: "Everyone your store knows: customers who ordered and leads who left their details.",
    tabs: "Contacts view",
    all: "All",
    segments: "Segments",
    groups: "Customer groups",
    forms: "Form submissions",
  },
  ar: {
    title: "جهات الاتصال",
    description: "كل من يعرفه متجرك: العملاء الذين طلبوا والمحتملون الذين تركوا بياناتهم.",
    tabs: "طريقة عرض جهات الاتصال",
    all: "الكل",
    segments: "الشرائح",
    groups: "مجموعات العملاء",
    forms: "رسائل النماذج",
  },
} satisfies Messages;

type Tab = "all" | "segments" | "suppressed" | "groups";

/**
 * Contacts (SPEC §18.4): the customers list grown into leads + customers with
 * tags, and saved segments beside it. The tab and the chosen segment live in
 * the URL so a filtered list can be linked to.
 */
export function ContactsPage() {
  const t = useT(STRINGS);
  const [searchParams, setSearchParams] = useSearchParams();
  // The addresses no email goes to: a tab only while the feature is on (lib/features); off, its address opens All.
  const suppressed = useSuppressedContactTab();
  const asked = searchParams.get("tab");
  // The RFM groups: a tab, and a group's own list on "All" (`?group=champions`), only while the feature is on.
  const askedGroup = searchParams.get("group");
  const group = STORE_REPORTS_ENABLED && isRfmLabel(askedGroup) ? askedGroup : null;
  const tab: Tab =
    asked === "segments"
      ? "segments"
      : EMAIL_SUPPRESSIONS_ENABLED && asked === "suppressed"
        ? "suppressed"
        : STORE_REPORTS_ENABLED && asked === "groups"
          ? "groups"
          : "all";
  const segmentId = searchParams.get("segment") ?? "";

  const go = (next: { tab?: Tab; segment?: string }) => {
    const params = new URLSearchParams();
    if (next.tab === "segments" || next.tab === "suppressed" || next.tab === "groups") params.set("tab", next.tab);
    if (next.segment) params.set("segment", next.segment);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Link to="/form-submissions" className={buttonVariants({ variant: "outline" })}>
            <Inbox className="size-4" aria-hidden />
            {t.forms}
          </Link>
        }
      />
      <FilterTabs
        className="mb-4"
        label={t.tabs}
        value={tab}
        onChange={(value) => go({ tab: value })}
        tabs={[
          { value: "all", label: t.all },
          { value: "segments", label: t.segments },
          ...(EMAIL_SUPPRESSIONS_ENABLED ? [{ value: "suppressed" as const, label: suppressed.label }] : []),
          ...(STORE_REPORTS_ENABLED ? [{ value: "groups" as const, label: t.groups }] : []),
        ]}
      />
      {tab === "groups" ? (
        <RfmGroupsTab />
      ) : tab === "all" && group ? (
        <RfmGroupList label={group} />
      ) : tab === "all" ? (
        <ContactsAllTab segmentId={segmentId} onSegmentChange={(id) => go({ segment: id })} />
      ) : tab === "segments" ? (
        <SegmentsTab onView={(id) => go({ segment: id })} />
      ) : (
        <EmailSuppressionsTab />
      )}
    </div>
  );
}
