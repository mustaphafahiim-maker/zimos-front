import { ZimosLogo } from "@store-builder/ui";

/**
 * Dev landing for the storefront app itself. Shoppers never see this: in
 * production each store is served on its own subdomain or custom domain.
 */
export default function RootPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-paper px-6 py-16 font-sans">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-paper-raised p-8 text-center shadow-card sm:p-10">
        <div className="flex justify-center">
          <ZimosLogo height={40} />
        </div>
        <h1 className="mt-8 text-2xl font-semibold text-ink">Storefront</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          In production every store is served on its own subdomain or custom domain. For local
          development, open a store directly by its workspace id:
        </p>
        <code
          dir="ltr"
          className="mt-5 block rounded-xl border border-line bg-zimos-cloud px-4 py-3 font-mono text-sm text-primary dark:bg-primary-soft"
        >
          /store/&lt;workspaceId&gt;
        </code>
        <ul className="mt-6 space-y-1.5 text-start text-sm text-ink-soft">
          <li>
            <code dir="ltr" className="text-ink">/store/&lt;id&gt;/products/&lt;slug&gt;</code> — product landing with COD form
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
