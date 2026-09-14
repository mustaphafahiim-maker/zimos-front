import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { DataState as SharedDataState, EmptyBlock as SharedEmptyBlock, type DataStateProps } from "@store-builder/ui";
import { getErrorMessage, isPermissionError } from "@/lib/errors";

const emptyIcon = <Inbox className="size-6 text-ink-muted" aria-hidden />;

/** Shared DataState bound to the admin copy and API error helpers. */
export function DataState(props: DataStateProps) {
  return (
    <SharedDataState
      labels={{ permission: "Your admin role doesn't have permission to view this." }}
      getErrorMessage={(err) => getErrorMessage(err)}
      isPermissionError={isPermissionError}
      emptyIcon={emptyIcon}
      {...props}
    />
  );
}

export function EmptyBlock({ message, action }: { message: string; action?: ReactNode }) {
  return <SharedEmptyBlock message={message} action={action} icon={emptyIcon} />;
}
