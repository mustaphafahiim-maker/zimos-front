import { Link } from "react-router-dom";
import { IconChart } from "@/components/icons";
import { Button, cn } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { storeReportPath } from "./storeReportStrings";

const STRINGS = {
  en: { seeResults: "See results" },
  ar: { seeResults: "شوف النتايج" },
} satisfies Messages;

/**
 * «شوف النتايج»: the way from the Free gifts and Cart offers screens to the
 * «عروض السلة والهدايا» report (handoff 256). Kept apart from the report
 * itself so those screens don't load it until the link is followed.
 */
export function OfferResultsLink({ className }: { className?: string }) {
  const t = useT(STRINGS);
  return (
    <Button asChild variant="outline" className={cn("min-h-11 md:min-h-9", className)}>
      <Link to={storeReportPath("cart-offers")}>
        <IconChart className="size-4" aria-hidden />
        {t.seeResults}
      </Link>
    </Button>
  );
}
