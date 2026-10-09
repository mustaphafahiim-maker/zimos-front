import { Link } from "react-router-dom";
import { Button, Card } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";
import { DEVELOPERS_PATH, PARTNER_APP_STRINGS } from "./partnerAppStrings";

/**
 * Settings → My account: the way in to Account → Developers (frontend-handoff
 * 265). One quiet line — most merchants never build an app, so the screen
 * itself stays on its own page. Drawn like a Section's heading row, without a
 * body under it.
 */
export function DevelopersEntryCard() {
  const t = useT(PARTNER_APP_STRINGS);
  return (
    <Card className="min-w-0 flex-row flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{t.cardTitle}</h2>
        <p className="mt-0.5 text-xs text-ink-soft">{t.cardBody}</p>
      </div>
      <Button variant="outline" className="min-h-11 shrink-0" asChild>
        <Link to={DEVELOPERS_PATH}>{t.cardOpen}</Link>
      </Button>
    </Card>
  );
}
