import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { Input, Label, cn } from "@store-builder/ui";

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  /**
   * Keeps the label for screen readers but not on screen — for a field whose
   * own heading already names it, where a visible label would read twice.
   */
  labelHidden?: boolean;
  /** Render prop so the control can wire up the generated id. */
  children: (props: { id: string; "aria-invalid"?: boolean }) => ReactNode;
}

export function Field({ label, error, hint, required, className, labelHidden, children }: FieldProps) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className={labelHidden ? "sr-only" : undefined}>
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
  labelHidden?: boolean;
}

/** Label + <Input> + inline error, the common case. */
export function TextField({ label, error, hint, required, className, labelHidden, ...inputProps }: TextFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className} labelHidden={labelHidden}>
      {({ id, ...aria }) => (
        <Input
          id={id}
          {...aria}
          {...inputProps}
          className={cn(error && "border-danger focus-visible:ring-danger/30")}
        />
      )}
    </Field>
  );
}
