import { Link, useSearchParams } from "react-router-dom";
import { Inbox, Upload } from "lucide-react";
import { buttonVariants } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { FilterTabs } from "@/components/FilterTabs";
import { ContactsAllTab } from "./ContactsAllTab";
import { SegmentsTab } from "./SegmentsTab";

const STRINGS = {
  en: {
    title: "Contacts",
    description: "Everyone your store knows: customers who ordered and leads who left their details.",
    tabs: "Contacts view",
    all: "All",
    segments: "Segments",
    forms: "Form submissions",
    import: "Import contacts",
  },
  ar: {
    title: "جهات الاتصال",
    description: "كل من يعرفه متجرك: العملاء الذين طلبوا والمحتملون الذين تركوا بياناتهم.",
    tabs: "طريقة عرض جهات الاتصال",
    all: "الكل",
    segments: "الشرائح",
    forms: "رسائل النماذج",
    import: "استيراد العملاء",
  },
} satisfies Messages;

type Tab = "all" | "segments";

/**
 * Contacts (SPEC §18.4): the customers list grown into leads + customers with
 * tags, and saved segments beside it. The tab and the chosen segment live in
 * the URL so a filtered list can be linked to.
 */
export function ContactsPage() {
  const t = useT(STRINGS);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get("tab") === "segments" ? "segments" : "all";
  const segmentId = searchParams.get("segment") ?? "";

  const go = (next: { tab?: Tab; segment?: string }) => {
    const params = new URLSearchParams();
    if (next.tab === "segments") params.set("tab", "segments");
    if (next.segment) params.set("segment", next.segment);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <>
            <Link to="/customers/import" className={buttonVariants({ variant: "outline" })}>
              <Upload className="size-4" aria-hidden />
              {t.import}
            </Link>
            <Link to="/form-submissions" className={buttonVariants({ variant: "outline" })}>
              <Inbox className="size-4" aria-hidden />
              {t.forms}
            </Link>
          </>
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
        ]}
      />
      {tab === "all" ? (
        <ContactsAllTab segmentId={segmentId} onSegmentChange={(id) => go({ segment: id })} />
      ) : (
        <SegmentsTab onView={(id) => go({ segment: id })} />
      )}
    </div>
  );
}
