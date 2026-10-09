/**
 * A variant's options as the form has always held them: one line of text,
 * "Size=M, Color=Red", turned into `{ Size: "M", Color: "Red" }` for the API.
 * The chips input (OptionChipsInput.tsx) reads and writes that same line, so
 * what is sent did not change.
 */

/** Parse "Size=M, Color=Red" -> { Size: "M", Color: "Red" }. */
export function parseOptionValues(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of input.split(",")) {
    const [k, ...rest] = pair.split("=");
    const key = k?.trim();
    const value = rest.join("=").trim();
    if (key && value) out[key] = value;
  }
  return out;
}

export function stringifyOptionValues(values: Record<string, string> | undefined): string {
  if (!values) return "";
  return Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
}

/** The line as its pairs, in the order `parseOptionValues` keeps them. */
export function optionPairs(line: string): Array<[string, string]> {
  return Object.entries(parseOptionValues(line));
}

/** Pairs back into the line. A name or a value never holds a comma here: the chips input splits on it. */
export function optionLine(pairs: ReadonlyArray<readonly [string, string]>): string {
  return pairs.map(([name, value]) => `${name}=${value}`).join(", ");
}

/**
 * One typed pair — «المقاس: M», "Size=M" — as [name, value]; null while it is
 * not a pair yet. The name ends at the first «:» or «=»; the value may hold
 * either after that («الميعاد: 10:30»).
 */
export function readOptionPair(text: string): [string, string] | null {
  const at = text.search(/[:=：＝]/);
  if (at < 0) return null;
  const name = text.slice(0, at).trim();
  const value = text.slice(at + 1).trim();
  return name && value ? [name, value] : null;
}
