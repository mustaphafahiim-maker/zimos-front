import { Link, useSearchParams } from "react-router-dom";
import { Inbox } from "lucide-react";
import { buttonVariants } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { FilterTabs } from "@/components/FilterTabs";
import { ContactsAllTab } from "./ContactsAllTab";
import { SegmentsTab } from "./SegmentsTab";
import { EmailSuppressionsTab, useSuppressedContactTab } from "./suppressions/EmailSuppressionsTab";
import { EMAIL_SUPPRESSIONS_ENABLED } from "@/lib/features";

const STRINGS = {
  en: {
    title: "Contacts",
    description: "Everyone your store knows: customers who ordered and leads who left their details.",
    tabs: "Contacts view",
    all: "All",
    segments: "Segments",
    forms: "Form submissions",
  },
  ar: {
    title: "جهات الاتصال",
    description: "كل من يعرفه متجرك: العملاء الذين طلبوا والمحتملون الذين تركوا بياناتهم.",
    tabs: "طريقة عرض جهات الاتصال",
    all: "الكل",
    segments: "الشرائح",
    forms: "رسائل النماذج",
  },
} satisfies Messages;

type Tab = "all" | "segments" | "suppressed";

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
  const tab: Tab = asked === "segments" ? "segments" : EMAIL_SUPPRESSIONS_ENABLED && asked === "suppressed" ? "suppressed" : "all";
  const segmentId = searchParams.get("segment") ?? "";

  const go = (next: { tab?: Tab; segment?: string }) => {
    const params = new URLSearchParams();
    if (next.tab === "segments" || next.tab === "suppressed") params.set("tab", next.tab);
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
        ]}
      />
      {tab === "all" ? (
        <ContactsAllTab segmentId={segmentId} onSegmentChange={(id) => go({ segment: id })} />
      ) : tab === "segments" ? (
        <SegmentsTab onView={(id) => go({ segment: id })} />
      ) : (
        <EmailSuppressionsTab />
      )}
    </div>
  );
}
