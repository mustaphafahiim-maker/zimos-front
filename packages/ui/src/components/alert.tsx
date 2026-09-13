import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-xl border px-4 py-3 text-start text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pe-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-line bg-zimos-cloud text-ink dark:bg-card",
        destructive:
          "border-danger/25 bg-danger-soft text-danger *:data-[slot=alert-description]:text-danger/90 *:[svg]:text-current",
        // Deprecated aliases kept so the existing call sites in the apps keep
        // working. `danger` was the old destructive; `info` the old default.
        danger:
          "border-danger/25 bg-danger-soft text-danger *:data-[slot=alert-description]:text-danger/90 *:[svg]:text-current",
        success:
          "border-success/25 bg-success-soft text-success *:data-[slot=alert-description]:text-success/90 *:[svg]:text-current",
        warning:
          "border-warning/25 bg-warning-soft text-warning *:data-[slot=alert-description]:text-warning/90 *:[svg]:text-current",
        info: "border-primary/15 bg-primary-soft text-ink *:[svg]:text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  role,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  const isError = variant === "destructive" || variant === "danger"
  return (
    <div
      data-slot="alert"
      role={role ?? (isError ? "alert" : "status")}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2.5 end-3", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
