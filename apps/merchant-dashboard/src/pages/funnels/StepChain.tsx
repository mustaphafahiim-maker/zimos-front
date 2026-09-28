import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@store-builder/ui";
import { useLocale } from "@/i18n/LocaleContext";
import { STEP_TYPE_LABELS } from "./FunnelEditorPage.strings";
import type { UiStepType } from "./funnelAdapter";

/**
 * A starter's steps as a row of chips ("Landing page › Checkout › Thank you"),
 * so a template can be picked by its shape rather than its name. The chevrons
 * follow the reading direction.
 */
export function StepChain({ types, className }: { types: UiStepType[]; className?: string }) {
  const { locale } = useLocale();
  return (
    <ol className={cn("flex flex-wrap items-center gap-1", className)}>
      {types.map((type, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <li aria-hidden className="text-ink-soft">
              <ChevronRight className="size-3 rtl:rotate-180" />
            </li>
          )}
          <li className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-soft ring-1 ring-line">{STEP_TYPE_LABELS[locale][type]}</li>
        </Fragment>
      ))}
    </ol>
  );
}
