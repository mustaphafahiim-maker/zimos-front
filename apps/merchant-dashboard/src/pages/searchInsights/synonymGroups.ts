import { SEARCH_SYNONYM_LIMITS, normalizeSearchTerm } from "@store-builder/api-client";

/**
 * The rules of search synonym groups (handoff 211), checked here before the
 * API refuses the whole save: 2–10 words in a group, a word in one group only
 * (compared the server's way — trimmed, lower case, single spaces).
 */

const has = (group: readonly string[], term: string) => group.some((word) => normalizeSearchTerm(word) === term);

export type AddPairResult =
  | { kind: "ok"; groups: string[][] }
  /** The two words are already in one group. */
  | { kind: "exists" }
  /** Each word already sits in a different group: merging two groups is the synonyms page's job. */
  | { kind: "both" }
  /** The group the pair belongs in is full. */
  | { kind: "full" }
  /** No room for another group. */
  | { kind: "tooMany" };

/**
 * `query` = `term`, added to the groups: into the group one of them is
 * already in, else as a new group — the searched word first, so the word that
 * has products is the one tried when it finds nothing.
 */
export function addSynonymPair(groups: readonly string[][], query: string, term: string): AddPairResult {
  const q = normalizeSearchTerm(query);
  const t = normalizeSearchTerm(term);
  const ofQuery = groups.findIndex((group) => has(group, q));
  const ofTerm = groups.findIndex((group) => has(group, t));
  if (ofQuery >= 0 && ofTerm >= 0) return ofQuery === ofTerm ? { kind: "exists" } : { kind: "both" };
  const into = ofQuery >= 0 ? ofQuery : ofTerm;
  if (into >= 0) {
    if (groups[into].length >= SEARCH_SYNONYM_LIMITS.maxTerms) return { kind: "full" };
    const added = ofQuery >= 0 ? term.trim() : query.trim();
    return { kind: "ok", groups: groups.map((group, i) => (i === into ? [...group, added] : [...group])) };
  }
  if (groups.length >= SEARCH_SYNONYM_LIMITS.groups) return { kind: "tooMany" };
  return { kind: "ok", groups: [...groups.map((group) => [...group]), [query.trim(), term.trim()]] };
}

/**
 * What stops the edited groups from being saved: the groups (by position)
 * holding a single word, and the first word found in two groups. Empty
 * groups are not a problem — they are simply not sent.
 */
export function synonymProblems(groups: readonly string[][]): { tooSmall: number[]; clash: { term: string; groups: [number, number] } | null } {
  const tooSmall: number[] = [];
  const seen = new Map<string, number>();
  let clash: { term: string; groups: [number, number] } | null = null;
  groups.forEach((group, index) => {
    if (group.length === 1) tooSmall.push(index);
    for (const word of group) {
      const key = normalizeSearchTerm(word);
      const first = seen.get(key);
      if (first !== undefined && first !== index && !clash) clash = { term: word, groups: [first, index] };
      if (first === undefined) seen.set(key, index);
    }
  });
  return { tooSmall, clash };
}
