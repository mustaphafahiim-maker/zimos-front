import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { EmptyState } from "@/components/EmptyState";

const STRINGS = {
  en: {
    title: "Page not found",
    description: "There's nothing at this address. The link may be old or mistyped.",
    home: "Go to the dashboard",
  },
  ar: {
    title: "الصفحة غير موجودة",
    description: "مفيش شيء على هذا العنوان. قد يكون الرابط قديمًا أو مكتوبًا بشكل خاطئ.",
    home: "الذهاب إلى الرئيسية",
  },
} satisfies Messages;

/** Any address no route matches, shown inside the dashboard layout. */
export function NotFoundPage() {
  const t = useT(STRINGS);
  return (
    <EmptyState
      icon={<Compass />}
      title={t.title}
      description={t.description}
      action={
        <Button asChild>
          <Link to="/">{t.home}</Link>
        </Button>
      }
    />
  );
}
