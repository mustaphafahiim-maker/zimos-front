import { ZimosLogo, ZIMOS_PHRASES } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    headline: "Your store, your orders and your cash-on-delivery operations in one workspace.",
    subcopy: "Launch a storefront or funnel, confirm orders, ship with your carriers and see your real profit.",
  },
  ar: {
    headline: "متجرك وطلباتك وعمليات الدفع عند الاستلام في مساحة عمل واحدة.",
    subcopy: "أطلق متجرك أو مسار بيعك، وأكّد الطلبات، واشحن مع شركات الشحن التي تتعامل معها، وتابع أرباحك الحقيقية.",
  },
};

/** Navy brand panel shown beside the auth forms on large screens. */
export function BrandPanel() {
  const t = useT(STRINGS);
  return (
    <div className="relative hidden overflow-hidden bg-zimos-navy px-12 py-12 text-white lg:flex lg:w-[44%] lg:max-w-[640px] lg:flex-col lg:justify-between xl:px-16">
      <div className="relative z-10">
        <ZimosLogo surface="dark" height={40} />
      </div>

      <div className="relative z-10 max-w-md">
        <h1 className="text-[34px] leading-[1.2] font-semibold tracking-tight text-white">{t.headline}</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-white/70">{t.subcopy}</p>
      </div>

      <p className="relative z-10 text-sm font-medium text-white/50" dir="ltr" lang="en">
        {ZIMOS_PHRASES.limits}
      </p>

      {/* Signature layered diagonal ribbons — decorative only. */}
      <div aria-hidden className="zimos-ribbons -end-40 top-[46%] h-[420px] w-[620px] opacity-90" />
      <div
        aria-hidden
        className="pointer-events-none absolute -end-24 top-[10%] h-24 w-[420px] rotate-[-24deg] rounded-full bg-gradient-to-r from-zimos-blue/35 to-zimos-sky/10"
      />
    </div>
  );
}
