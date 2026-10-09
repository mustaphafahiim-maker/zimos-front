import { useSearchParams } from "react-router-dom";
import { IconCode, IconSections } from "@/components/icons";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { Segmented } from "@/components/Segmented";
import { useUnsavedGuard } from "@/lib/useUnsavedGuard";
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
 * Switching between the two unmounts the other: with code typed and not saved
 * it asks first, like a switch of section.
 */
export function CustomCodeSection() {
  const t = useT(STRINGS);
  const [params, setParams] = useSearchParams();
  const { confirmLeave } = useUnsavedGuard();
  const view: View = params.get("view") === "scripts" ? "scripts" : "slots";

  async function change(next: View) {
    if (next === view || !(await confirmLeave())) return;
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next === "scripts") out.set("view", "scripts");
        else out.delete("view");
        return out;
      },
      { replace: true }
    );
  }

  return (
    <>
      <Segmented
        label={t.label}
        value={view}
        onChange={(next) => void change(next)}
        className="w-full sm:w-auto sm:self-start"
        options={[
          { value: "slots", label: t.slots, icon: IconSections },
          { value: "scripts", label: t.scripts, icon: IconCode },
        ]}
      />
      {view === "scripts" ? <StoreScriptsTab /> : <CustomCodeTab />}
    </>
  );
}
