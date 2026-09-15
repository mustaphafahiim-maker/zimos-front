import { ZimosLogo } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    badge: "Platform Admin",
    title: "Internal operations console",
    body: "For the ZIMOS team to manage workspaces, subscriptions, plans, templates and platform health. Not a merchant-facing surface.",
  },
  ar: {
    badge: "أدمن المنصة",
    title: "لوحة التشغيل الداخلية",
    body: "لفريق ZIMOS عشان يدير مساحات العمل والاشتراكات والباقات والقوالب وصحة المنصة. مش للتجار.",
  },
};

/** Navy brand panel beside the admin sign-in form. */
export function BrandPanel() {
  const t = useT(STRINGS);
  return (
    <div className="relative hidden overflow-hidden bg-zimos-navy px-12 py-14 text-white lg:flex lg:w-[44%] lg:flex-col lg:justify-between">
      <div className="zimos-ribbons -bottom-10 -end-24 h-[58%] w-[125%] opacity-90" aria-hidden="true" />
      <div className="relative z-10 flex items-center gap-3">
        <ZimosLogo surface="dark" height={40} />
      </div>
      <div className="relative z-10 max-w-sm">
        <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/80">{t.badge}</span>
        <h1 className="mt-4 text-3xl leading-tight font-semibold">{t.title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/75">{t.body}</p>
      </div>
      <div className="relative z-10 h-8" aria-hidden="true" />
    </div>
  );
}
