import { ZimosLogo } from "@store-builder/ui";

/** Navy brand panel beside the admin sign-in form. */
export function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-zimos-navy px-12 py-14 text-white lg:flex lg:w-[44%] lg:flex-col lg:justify-between">
      <div
        className="zimos-ribbons -bottom-10 -end-24 h-[58%] w-[125%] opacity-90"
        aria-hidden="true"
      />

      <div className="relative z-10 flex items-center gap-3">
        <ZimosLogo surface="dark" height={40} />
      </div>

      <div className="relative z-10 max-w-sm">
        <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/80">
          Platform Admin
        </span>
        <h1 className="mt-4 text-3xl leading-tight font-semibold">Internal operations console</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/75">
          For the ZIMOS team to manage workspaces, billing, marketplace, providers and platform health.
          Not a merchant-facing surface.
        </p>
      </div>

      <div className="relative z-10 h-8" aria-hidden="true" />
    </div>
  );
}
