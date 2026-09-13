import { Input, cn } from "@store-builder/ui";
import { Field } from "./Field";

interface MoneyInputProps {
  label: string;
  /** Major-unit text as typed, e.g. "199.00". Parent converts with majorToMinor() at submit. */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  currency?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** Text input for a money amount in major units, with a currency adornment at the start edge. */
export function MoneyInput({
  label,
  value,
  onChange,
  error,
  hint,
  required,
  currency = "EGP",
  placeholder = "0.00",
  disabled,
  className,
}: MoneyInputProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, ...aria }) => (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-xs font-medium text-ink-muted">
            {currency}
          </span>
          <Input
            id={id}
            {...aria}
            inputMode="decimal"
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={cn("tabular ps-12", error && "border-danger focus-visible:ring-danger/30")}
          />
        </div>
      )}
    </Field>
  );
}
