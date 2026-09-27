import { Alert, Input, cn } from "@store-builder/ui";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { TYPED_NAME_MAX } from "@/pages/shipping/carriers";
import { useLevelLabel } from "./useLevelLabel";

const STRINGS = {
  en: {
    title: "Type the delivery address as {carrier} writes it",
    intro:
      "{carrier} hasn't enabled its location list for your account, so the {levels} are typed by hand. Use {carrier}'s own spelling: {carrier} checks them when you book.",
    required: "Enter the {level}.",
    rejectedLevel: "{carrier} doesn't recognise this {level}. Use {carrier}'s own spelling.",
    rejectedWhole: "{carrier} doesn't recognise this {levels} together. Check each one against {carrier}'s spelling.",
    pickupHint:
      "If it's right, check the pickup address in the {carrier} settings: it was saved without being checked against {carrier}'s names.",
    sep: ", ",
    and: " and ",
  },
  ar: {
    title: "اكتب عنوان التوصيل كما تكتبه {carrier}",
    intro:
      "لم تفعّل {carrier} قائمة المواقع لحسابك، لذلك تُكتب {levels} يدويًا. اكتبها كما تكتبها {carrier}: ستراجعها {carrier} عند الحجز.",
    required: "اكتب {level}.",
    rejectedLevel: "لم تتعرّف {carrier} على ما كتبته في خانة {level}. اكتبه كما تكتبه {carrier}.",
    rejectedWhole: "لم تتعرّف {carrier} على {levels} معًا. راجع كل خانة حسب طريقة كتابة {carrier}.",
    pickupHint:
      "إذا كان صحيحًا، راجع عنوان الاستلام في إعدادات {carrier}: فقد حُفظ دون مراجعته على أسماء {carrier}.",
    sep: " و",
    and: " و",
  },
} satisfies Messages;

/** What went wrong with the typed names: one level (`index`) or the address as a whole (null). */
export interface TypedNamesProblem {
  index: number | null;
  /** "rejected": the courier refused it. "required": left empty here. "server": the server's own sentence. */
  kind: "rejected" | "required" | "server";
  message?: string;
}

/**
 * One text input per courier address level, for a connection whose courier
 * refuses it the location list (`verification.locationList: "unavailable"`).
 * Booked with `carrierAddress: { names }`, sent as typed.
 */
export function TypedAddressNames({
  carrierName,
  levels,
  names,
  onChange,
  problems,
  pickupUnchecked,
  disabled,
}: {
  carrierName: string;
  levels: string[];
  names: string[];
  onChange: (index: number, value: string) => void;
  problems: TypedNamesProblem[];
  /** The pickup address was saved unchecked, so a rejection may be about it. */
  pickupUnchecked: boolean;
  disabled?: boolean;
}) {
  const t = useT(STRINGS);
  const levelLabel = useLevelLabel();
  const labels = levels.map(levelLabel);
  // Mid-sentence ("the governorate, city and area"); a no-op in Arabic.
  const inText = labels.map((l) => l.toLowerCase());
  const levelList =
    inText.length > 1 ? `${inText.slice(0, -1).join(t.sep)}${t.and}${inText[inText.length - 1]}` : (inText[0] ?? "");
  const pickup = pickupUnchecked ? ` ${fmt(t.pickupHint, { carrier: carrierName })}` : "";

  function messageFor(problem: TypedNamesProblem): string {
    if (problem.kind === "server" && problem.message) return problem.message;
    if (problem.index === null) return fmt(t.rejectedWhole, { carrier: carrierName, levels: levelList }) + pickup;
    const level = inText[problem.index] ?? "";
    if (problem.kind === "required") return fmt(t.required, { level });
    return fmt(t.rejectedLevel, { carrier: carrierName, level }) + pickup;
  }

  const whole = problems.find((p) => p.index === null);
  const fieldError = (i: number) => {
    const problem = problems.find((p) => p.index === i);
    return problem ? messageFor(problem) : undefined;
  };

  return (
    <fieldset className="space-y-3 rounded-[0.5rem] border border-line p-3">
      <legend className="px-1 text-sm font-medium text-ink">{fmt(t.title, { carrier: carrierName })}</legend>
      <p className="text-xs text-ink-soft">{fmt(t.intro, { carrier: carrierName, levels: levelList })}</p>
      {whole && (
        <Alert variant="danger">
          {messageFor(whole)}
        </Alert>
      )}
      <div className={cn("grid gap-3", levels.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {levels.map((level, i) => {
          const error = fieldError(i);
          return (
            <Field key={level} label={labels[i]} error={error}>
              {({ id, ...aria }) => (
                <Input
                  id={id}
                  {...aria}
                  value={names[i] ?? ""}
                  onChange={(e) => onChange(i, e.target.value)}
                  maxLength={TYPED_NAME_MAX}
                  dir="auto"
                  disabled={disabled}
                  className={cn("h-11", error && "border-danger focus-visible:ring-danger/30")}
                />
              )}
            </Field>
          );
        })}
      </div>
    </fieldset>
  );
}
