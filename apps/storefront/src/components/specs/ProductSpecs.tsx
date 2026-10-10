import { storefrontProductSpecs, type StorefrontSpec } from "@store-builder/api-client";
import { pickText, type Locale } from "@/lib/i18n";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { SPEC_TEXT, specName, specValue } from "./specText";

/**
 * The product page's «المواصفات»: the product's value
 * for each specification the store defined, in the store's order, with the
 * unit beside the value — and «قارن», which puts the product in the shopper's
 * compare list. Read on the server, so the table is part of the page as it
 * arrives. A product with no specification shows nothing (and no compare
 * button: there would be nothing to compare it by).
 */
export async function ProductSpecs({
  workspaceId,
  product,
  locale,
}: {
  workspaceId: string;
  product: { id: string; name: string; slug: string };
  locale: Locale;
}) {
  const client = await createServerStorefrontApiClient();
  const specs: StorefrontSpec[] = await storefrontProductSpecs(client, workspaceId, product.id).catch(() => []);
  if (specs.length === 0) return null;
  const text = pickText(SPEC_TEXT, locale);

  return (
    <section aria-labelledby="product-specs-title" className="mt-12">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-80">
          <h2 id="product-specs-title" className="text-xl font-semibold text-ink">
            {text.title}
          </h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-paper-raised">
            <table className="w-full text-sm">
              <tbody>
                {specs.map((spec) => (
                  <tr key={spec.id} className="border-t border-line first:border-t-0">
                    <th scope="row" className="w-2/5 px-4 py-3 text-start align-top font-medium text-ink-soft sm:px-5">
                      <bdi>{specName(spec.name, locale)}</bdi>
                    </th>
                    <td className="px-4 py-3 align-top font-medium text-ink sm:px-5">
                      <bdi>{specValue(spec.value, spec.unit)}</bdi>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
