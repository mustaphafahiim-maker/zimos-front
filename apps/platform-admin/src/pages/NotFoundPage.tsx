import { Link } from "react-router-dom";
import { buttonVariants } from "@store-builder/ui";
import { EmptyBlock } from "@/components/DataState";
import { PageHeader } from "@/components/PageHeader";
import { useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { title: "Page not found", body: "There's nothing at this address in the admin console.", home: "Go to overview" },
  ar: { title: "الصفحة مش موجودة", body: "مفيش حاجة على العنوان ده في لوحة الأدمن.", home: "روح للنظرة العامة" },
};

export function NotFoundPage() {
  const t = useT(STRINGS);
  return (
    <div>
      <PageHeader title={t.title} />
      <EmptyBlock
        message={t.body}
        action={
          <Link to="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t.home}
          </Link>
        }
      />
    </div>
  );
}
