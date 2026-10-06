import { useSearchParams } from "react-router-dom";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { FilterTabs } from "@/components/FilterTabs";
import { CustomCodeTab } from "./CustomCodeTab";
import { StoreScriptsTab } from "./StoreScriptsTab";

const STRINGS = {
  en: { label: "Custom code sections", slots: "Code spots", scripts: "Scripts" },
  ar: { label: "أقسام أكواد التخصيص", slots: "أماكن الكود", scripts: "السكريبتات" },
} satisfies Messages;

type View = "slots" | "scripts";

/**
 * Store settings → Custom code: the fixed code spots (CustomCodeTab) and the
 * named scripts placed by position and page type (StoreScriptsTab). The open
 * one is kept in the address (`?view=scripts`) so it can be linked to.
 */
export function CustomCodeSection() {
  const t = useT(STRINGS);
  const [params, setParams] = useSearchParams();
  const view: View = params.get("view") === "scripts" ? "scripts" : "slots";

  return (
    <div className="space-y-5">
      <FilterTabs
        label={t.label}
        value={view}
        onChange={(next) =>
          setParams(
            (prev) => {
              const out = new URLSearchParams(prev);
              if (next === "scripts") out.set("view", "scripts");
              else out.delete("view");
              return out;
            },
            { replace: true }
          )
        }
        tabs={[
          { value: "slots", label: t.slots },
          { value: "scripts", label: t.scripts },
        ]}
      />
      {view === "scripts" ? <StoreScriptsTab /> : <CustomCodeTab />}
    </div>
  );
}
