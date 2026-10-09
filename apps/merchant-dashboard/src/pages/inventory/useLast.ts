import { useRef } from "react";

/**
 * The last value that was not null: a dialog keeps showing what it was opened
 * for while it closes, instead of blanking its title for the closing animation.
 */
export function useLast<T>(value: T | null): T | null {
  const ref = useRef<T | null>(value);
  if (value !== null) ref.current = value;
  return ref.current;
}
