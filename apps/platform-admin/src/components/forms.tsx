import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Search } from "lucide-react";
import { Input, Label, Textarea, cn } from "@store-builder/ui";

/** Native select styled to match the shared <Input>. */
export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full cursor-pointer rounded-[10px] border border-input bg-paper-raised px-3 py-2 text-sm text-ink",
        "transition-shadow focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
NativeSelect.displayName = "NativeSelect";

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: boolean }) => ReactNode;
}

export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </Label>
      {children({ id, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p className="text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, required, className, ...inputProps }: TextFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, ...aria }) => <Input id={id} required={required} {...aria} {...inputProps} />}
    </Field>
  );
}

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextAreaField({ label, error, hint, required, className, ...props }: TextAreaFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, ...aria }) => <Textarea id={id} required={required} {...aria} {...props} />}
    </Field>
  );
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  error?: string;
  hint?: string;
}

export function SelectField({ label, error, hint, required, className, children, ...props }: SelectFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, ...aria }) => (
        <NativeSelect id={id} required={required} {...aria} {...props}>
          {children}
        </NativeSelect>
      )}
    </Field>
  );
}

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
}

export function SearchInput({ value, onChange, className, placeholder = "Search…", ...props }: SearchInputProps) {
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="ps-9"
        {...props}
      />
    </div>
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Segmented filter chips (status filters above tables). */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-line bg-paper-raised text-ink-soft hover:border-line-strong hover:text-ink"
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn("tabular rounded-full px-1.5 text-xs", active ? "bg-white/20" : "bg-primary-soft text-ink")}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
