import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigationType, useSearchParams } from "react-router-dom";
import { cn } from "@store-builder/ui";
import { customerNotesGet, type Customer } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { pluralOf } from "@/lib/plural";
import { fmt, useT } from "@/i18n/LocaleContext";
import { AccordionSection } from "@/components/Accordion";
import { IconActivity, IconChartPie, IconCombine, IconShield, IconStickyNote } from "@/components/icons";
import { foldingFrame } from "../detail/CardFrame";
import {
  NOTES_SECTION_ID,
  SECTIONS_GRID,
  SECTIONS_REST,
  SECTIONS_SIDE,
  SECTIONS_TOP,
  TIMELINE_SECTION_ID,
  isWideScreen,
  readSectionOpen,
} from "../detail/sections";
import { SECTION_STRINGS, notesLineOf } from "../detail/sectionStrings";
import { CustomerDuplicates } from "./CustomerDuplicates";
import { CustomerNotesPanel } from "./CustomerNotesPanel";
import { CustomerPrivacyCard, isErasedCustomer } from "./CustomerPrivacyCard";
import { CustomerRfmCard } from "./CustomerRfmCard";
import { CustomerTimelinePanel } from "./CustomerTimelinePanel";

type Tab = "overview" | "notes" | "timeline";

const NOTES_KEY = "customer:notes";
const TIMELINE_KEY = "customer:timeline";

/**
 * Everything under the customer page's hero (handoffs 209, 250, 237, 248,
 * 235), as one list of folding sections instead of three tabs:
 *
 * - the customer's orders (passed in as `orders`), open, first;
 * - «ملاحظات ومتابعات»: the team's notes and reminders, with how many notes
 *   there are and the next follow-up on its folded row. Folded on a phone;
 *   from lg up it stands open in a column of its own beside the rest;
 * - what the page puts first (`lead`: the addresses, the contact details);
 * - «كل اللي حصل»: the timeline, read when it is opened;
 * - possible duplicates and the customer's RFM group;
 * - the page's other cards (passed as children, so cards other features mount
 *   there stay on this page);
 * - export / erase, last.
 *
 * The old tabs live on in the address: `?tab=notes` and `?tab=timeline` open
 * their section and bring it under the top bar, so every link that pointed at
 * a tab still lands on the same thing (absent = the top of the page).
 *
 * A section keeps what was typed in it while folded (the notes, once opened,
 * stay mounted), and what the merchant opened or folded is remembered for the
 * browser tab.
 */
export function CustomerCrmTabs({
  customer,
  onChanged,
  orders,
  lead,
  children,
}: {
  customer: Customer;
  /** Reads the customer again; the sections wait for it before they are redrawn. */
  onChanged: () => void | Promise<unknown>;
  /** The customer's orders: the first thing under the hero. Not redrawn by a merge or an erase. */
  orders?: ReactNode;
  /** The page's sections that come before the timeline (the addresses, the contact details). */
  lead?: ReactNode;
  children: ReactNode;
}) {
  const s = useT(SECTION_STRINGS);
  const workspaceId = useWorkspaceId();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [searchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const tab: Tab = raw === "notes" || raw === "timeline" ? raw : "overview";

  // Read with the page rather than with the section: its folded row says how many notes there are and what is due.
  const notes = useAsync(() => customerNotesGet(apiClient, workspaceId, customer.id), [workspaceId, customer.id]);
  const line = notesLineOf(notes.data, s);

  // Open when the address asks for it, otherwise as the merchant left it, otherwise: the notes open where they have a column of their own.
  const [notesOpen, setNotesOpen] = useState(() => tab === "notes" || (readSectionOpen(NOTES_KEY) ?? isWideScreen()));
  const [timelineOpen, setTimelineOpen] = useState(() => tab === "timeline" || (readSectionOpen(TIMELINE_KEY) ?? false));
  // Mounted on the first opening and kept, so a note being typed survives a fold.
  const [notesSeen, setNotesSeen] = useState(notesOpen);
  if (notesOpen && !notesSeen) setNotesSeen(true);

  // A link to ?tab=notes / ?tab=timeline: open that section and bring it under the top bar.
  const arriving = useRef(true);
  useEffect(() => {
    const first = arriving.current;
    arriving.current = false;
    if (tab === "overview") return;
    if (tab === "notes") setNotesOpen(true);
    else setTimelineOpen(true);
    // Back and Forward land where the merchant left the page: the scroll memory puts them there.
    if (first && navigationType === "POP" && location.key !== "default") return;
    const id = tab === "notes" ? NOTES_SECTION_ID : TIMELINE_SECTION_ID;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    // Two frames: the section has to be drawn open before it can be scrolled to.
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: calm ? "instant" : "smooth", block: "start" });
      });
    });
    return () => {
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
    };
    // Only a change of the tab in the address moves the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Raised after a merge or an erase: the page's sections are read again from the start. Only once
  // the page has the customer as it is now — the sections (the contact form above all) start from it.
  const [version, setVersion] = useState(0);
  const changed = async () => {
    void notes.refresh({ silent: true });
    await onChanged();
    setVersion((n) => n + 1);
  };

  const openFollowups = line.open > 0 ? pluralOf(s, "openFollowups", line.open) : "";

  return (
    <div role="region" aria-label={s.sections} className={SECTIONS_GRID}>
      <div className={SECTIONS_TOP}>{orders}</div>

      <div className={SECTIONS_SIDE}>
        <AccordionSection
          id={NOTES_SECTION_ID}
          title={s.notesTitle}
          icon={IconStickyNote}
          summary={line.summary || undefined}
          badge={
            line.open > 0 ? (
              // The follow-ups still open, as the old tab's label counted them; red once one is past its time.
              <span
                data-slot="customer-count"
                data-tone={line.overdue ? "danger" : "primary"}
                title={openFollowups}
                className={cn(
                  "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs leading-none font-semibold tabular-nums",
                  line.overdue ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary-dark"
                )}
              >
                <span className="sr-only">{openFollowups}</span>
                <span aria-hidden>{fmt("{n}", { n: line.open })}</span>
              </span>
            ) : undefined
          }
          open={notesOpen}
          onOpenChange={setNotesOpen}
          persistKey={NOTES_KEY}
          keepMounted={notesSeen}
        >
          <CustomerNotesPanel customerId={customer.id} state={notes} />
        </AccordionSection>
      </div>

      <div className={SECTIONS_REST}>
        <Fragment key={`lead-${version}`}>{lead}</Fragment>

        {/* Read only when opened, and again each time it is: everything that happened, newest first. */}
        <AccordionSection
          id={TIMELINE_SECTION_ID}
          title={s.timelineTitle}
          icon={IconActivity}
          summary={s.timelineHint}
          open={timelineOpen}
          onOpenChange={setTimelineOpen}
          persistKey={TIMELINE_KEY}
        >
          <CustomerTimelinePanel key={`timeline-${version}`} customerId={customer.id} />
        </AccordionSection>

        {!isErasedCustomer(customer) && (
          <CustomerDuplicates customer={customer} onMerged={changed} frame={foldingFrame({ key: "duplicates", icon: IconCombine })} />
        )}
        <CustomerRfmCard key={`rfm-${version}`} customerId={customer.id} frame={foldingFrame({ key: "group", icon: IconChartPie })} />

        <Fragment key={`rest-${version}`}>{children}</Fragment>

        <CustomerPrivacyCard customer={customer} onErased={changed} frame={foldingFrame({ key: "privacy", icon: IconShield, summary: s.privacyHint })} />
      </div>
    </div>
  );
}
