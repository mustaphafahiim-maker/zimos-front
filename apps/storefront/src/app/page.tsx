import { ZimosLogo } from "@/components/ZimosLogo";

/**
 * Dev landing for the storefront app itself. Shoppers never see this: each
 * store is served on its own subdomain, and in production every request whose
 * host names no store is sent to the marketing site before it gets here (see
 * `proxy.ts`). It is reachable in development, and through a deploy's own
 * hostname.
 */
export default function RootPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-paper px-6 py-16 font-sans">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-paper-raised p-8 text-center sm:p-10">
        <div className="flex justify-center">
          <ZimosLogo height={40} />
        </div>
        <h1 className="mt-8 font-display text-2xl font-semibold text-ink">Storefront</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Every store is served on its own subdomain,{" "}
          <code dir="ltr" className="text-primary">
            &lt;slug&gt;.zimos.co
          </code>
          . Browsers resolve <code dir="ltr" className="text-primary">&lt;slug&gt;.localhost</code> on
          their own, so the same routing works here — or open a store directly by its workspace id:
        </p>
        <code
          dir="ltr"
          className="mt-5 block rounded-xl border border-line bg-paper px-4 py-3 font-mono text-sm text-primary"
        >
          /store/&lt;workspaceId&gt;
        </code>
        <ul className="mt-6 space-y-1.5 text-start text-sm text-ink-soft">
          <li>
            <code dir="ltr" className="text-ink">/store/&lt;id&gt;/products/&lt;slug&gt;</code> —
            product landing with COD form
          </li>
          <li>
            <code dir="ltr" className="text-ink">/store/&lt;id&gt;/cart</code>,{" "}
            <code dir="ltr" className="text-ink">/checkout</code>,{" "}
            <code dir="ltr" className="text-ink">/track</code>
          </li>
        </ul>
        <p lang="ar" dir="rtl" className="mt-6 border-t border-line pt-5 text-sm text-ink-soft">
          افتح أي متجر مباشرةً عن طريق{" "}
          <code dir="ltr" className="text-primary">
            /store/&lt;workspaceId&gt;
          </code>
        </p>
      </div>
    </main>
  );
}
