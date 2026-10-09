import { Button, cn } from "@store-builder/ui";
import { IconSpinner } from "@/components/icons";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { loadMore: "Load more", loading: "Loading…" },
  ar: { loadMore: "اعرض كمان", loading: "بنحمّل…" },
} satisfies Messages;

interface LoadMoreProps {
  /** Truthy when there's another page (the cursor). */
  hasMore: boolean;
  loading: boolean;
  onClick: () => void;
}

/**
 * Cursor pagination control — matches the backend's cursor pattern, no page numbers.
 *
 * A pill. While the next page loads the words stay in place, hidden, and the
 * spinner sits over them: the pill keeps its width, so nothing under a thumb
 * moves between two taps.
 */
export function LoadMore({ hasMore, loading, onClick }: LoadMoreProps) {
  const t = useT(STRINGS);
  if (!hasMore) return null;
  return (
    <div className="flex justify-center pt-4">
      <Button
        variant="outline"
        onClick={onClick}
        disabled={loading}
        aria-busy={loading}
        className="relative min-h-11 rounded-full px-6"
      >
        <span className={cn(loading && "invisible")}>{t.loadMore}</span>
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <IconSpinner weight="bold" className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            <span className="sr-only">{t.loading}</span>
          </span>
        )}
      </Button>
    </div>
  );
}
