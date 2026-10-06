import { Link } from "react-router-dom";
import { Columns3, RefreshCw } from "lucide-react";
import { Button } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { refresh: "Refresh", board: "Board" },
  ar: { refresh: "تحديث", board: "اللوحة" },
} satisfies Messages;

/** The orders list's Refresh button and its link to the board (OrderBoardPage). */
export function OrdersHeaderTools({ onRefresh }: { onRefresh: () => void }) {
  const t = useT(STRINGS);
  return (
    <>
      <Button variant="outline" className="min-h-11" onClick={onRefresh}>
        <RefreshCw className="size-4" aria-hidden />
        {t.refresh}
      </Button>
      <Link
        to="/orders/board"
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-sm font-medium text-ink hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Columns3 className="size-4" aria-hidden />
        {t.board}
      </Link>
    </>
  );
}
