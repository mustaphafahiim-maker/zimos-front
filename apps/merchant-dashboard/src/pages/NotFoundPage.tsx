import { Link, useLocation } from "react-router-dom";
import { Compass } from "lucide-react";
import { buttonVariants, cn, ZimosLogo } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    code: "404",
    title: "We couldn't find that page",
    body: "The link may be broken, or the page may have moved.",
    home: "Go to dashboard",
    orders: "View orders",
  },
  ar: {
    code: "٤٠٤",
    title: "لم نعثر على هذه الصفحة",
    body: "ربما الرابط غير صحيح أو تم نقل الصفحة.",
    home: "الذهاب للوحة التحكم",
    orders: "عرض الطلبات",
  },
};

/** `inShell` renders inside DashboardLayout; otherwise a full-screen branded page. */
export function NotFoundPage({ inShell = false }: { inShell?: boolean }) {
  const t = useT(STRINGS);
  const { pathname } = useLocation();
  return (
    <div className={cn("flex flex-col items-center justify-center px-4 text-center", inShell ? "min-h-[60vh]" : "min-h-screen bg-paper")}>
      {!inShell && (
        <div className="mb-8">
          <ZimosLogo />
        </div>
      )}
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Compass className="size-7" aria-hidden />
      </div>
      <p className="text-5xl font-bold tracking-tight text-primary">{t.code}</p>
      <h1 className="mt-2 text-xl font-semibold text-ink">{t.title}</h1>
      <p className="mt-1 max-w-md text-sm text-ink-soft">{t.body}</p>
      <p dir="ltr" className="mt-2 max-w-full truncate text-xs text-ink-muted">{pathname}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link to="/" className={buttonVariants()}>
          {t.home}
        </Link>
        <Link to="/orders" className={buttonVariants({ variant: "outline" })}>
          {t.orders}
        </Link>
      </div>
    </div>
  );
}
