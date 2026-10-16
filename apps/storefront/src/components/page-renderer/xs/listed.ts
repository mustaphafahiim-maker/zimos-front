import { type Props } from "../showcase/shared";

/**
 * A list prop's items, each with its place in the list as saved — the place a
 * picture's `data-xs-pic` path names ("items.2.image"), which must not shift
 * when an empty item is skipped.
 */
export function listed(props: Props, key: string, max: number): { item: Props; at: number }[] {
  const value = props[key];
  if (!Array.isArray(value)) return [];
  return value
    .map((item, at) => ({ item: item as Props, at }))
    .filter(({ item }) => !!item && typeof item === "object" && !Array.isArray(item))
    .slice(0, max);
}
