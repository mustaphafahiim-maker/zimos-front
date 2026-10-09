import { useSearchParams } from "react-router-dom";
import { IconFolder, IconSend } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Segmented } from "@/components/Segmented";
import { useT } from "@/i18n/LocaleContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { DeliveriesView } from "./DeliveriesView";
import { DIGITAL_STRINGS } from "./digitalText";
import { FilesView } from "./FilesView";

type View = "products" | "files";

/**
 * /digital (SPEC §18.2): what each digital product delivers, and the private
 * file library behind it. Two views behind one switch; the chosen one lives
 * in `?tab=` (absent = delivery), so a link or a refresh lands on the same
 * view. `?product=<id>` — the code alert's link — always shows the delivery
 * view, with that product's sheet open.
 */
export function DigitalProductsPage() {
  const t = useT(DIGITAL_STRINGS);
  const workspaceId = useWorkspaceId();
  const phone = useIsPhone();
  const [params, setParams] = useSearchParams();
  const view: View = params.get("tab") === "files" && !params.get("product") ? "files" : "products";

  function selectView(next: View) {
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next === "products") out.delete("tab");
        else {
          out.set("tab", next);
          out.delete("product");
        }
        return out;
      },
      { replace: true }
    );
  }

  return (
    <div className="max-w-5xl">
      {/* A phone keeps the first screen for the products: the sentence is for wider screens. */}
      <PageHeader title={t.title} description={phone ? undefined : t.description} />
      <Segmented<View>
        className="mb-4 max-sm:w-full"
        label={t.views}
        value={view}
        onChange={selectView}
        options={[
          { value: "products", label: t.tabProducts, icon: IconSend },
          { value: "files", label: t.tabFiles, icon: IconFolder },
        ]}
      />
      {/* Keyed on the workspace so switching stores resets each view's local state. */}
      {view === "products" ? <DeliveriesView key={workspaceId} /> : <FilesView key={workspaceId} />}
    </div>
  );
}
