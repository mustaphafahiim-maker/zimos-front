import { Link } from "react-router-dom";
import { IconText } from "@/components/icons";
import { Button } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { storeTexts: "Store texts" },
  ar: { storeTexts: "نصوص المتجر" },
} satisfies Messages;

/** The Website page's way to Store texts (StoreTextsPage, /website/texts). */
export function StoreTextsLink() {
  const t = useT(STRINGS);
  return (
    <Button asChild variant="outline">
      <Link to="/website/texts">
        <IconText className="size-4" aria-hidden />
        {t.storeTexts}
      </Link>
    </Button>
  );
}
