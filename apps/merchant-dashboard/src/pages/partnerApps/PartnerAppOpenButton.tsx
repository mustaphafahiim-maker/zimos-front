import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { partnerAppEmbed, type ExternalAppDto } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { open: "Open" },
  ar: { open: "افتح" },
} satisfies Messages;

/** How long one store's answer about an install having a page is reused (the Apps page redraws after every install). */
const PAGE_CHECK_TTL_MS = 60_000;
const pageChecks = new Map<string, { at: number; has: Promise<boolean> }>();

/**
 * Whether an install has a page to open. The Apps list says it when it can
 * (`embedded`); when it does not, the embed call itself is the answer — it is
 * 404 for an install without a page, or one that is not a partner app. Only
 * the yes or no is kept: the signed address is asked for again on open.
 */
function hasPage(workspaceId: string, app: ExternalAppDto): Promise<boolean> {
  const told = (app as ExternalAppDto & { embedded?: boolean }).embedded;
  if (typeof told === "boolean") return Promise.resolve(told);
  const key = `${workspaceId}:${app.id}`;
  const cached = pageChecks.get(key);
  if (cached && Date.now() - cached.at < PAGE_CHECK_TTL_MS) return cached.has;
  const has = partnerAppEmbed(apiClient, workspaceId, app.id).then(
    () => true,
    () => false
  );
  pageChecks.set(key, { at: Date.now(), has });
  return has;
}

/**
 * «افتح» on an installed outside app's row of the Apps page (frontend-handoff
 * 265) — drawn only for an app that has a page inside the dashboard.
 */
export function PartnerAppOpenButton({ app }: { app: ExternalAppDto }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    setShow(false);
    void hasPage(workspaceId, app).then((has) => {
      if (alive) setShow(has);
    });
    return () => {
      alive = false;
    };
    // The install's id names it; the row object is new on every list read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, app.id]);

  if (!show) return null;
  return (
    <Button size="sm" asChild className="h-9 rounded-full px-4 pointer-coarse:h-11">
      <Link to={`/apps/partner/${app.id}`}>{t.open}</Link>
    </Button>
  );
}
