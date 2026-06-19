// Make normalization: resolve a raw NHTSA MAKETXT to a canonical RV make (CLAUDE.md §6).
// Matching is exact on a normalized key (uppercased, punctuation→space, collapsed).

export type MakeRow = {
  make_canonical: string;
  make_variants: string[] | null;
  category: string | null;
  is_motorhome_chassis: boolean | null;
};

export type MakeEntry = {
  canonical: string;
  category: string | null;
  isChassis: boolean;
};

/** Normalize a make string for matching: uppercase, strip punctuation, collapse spaces. */
export function normMake(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class MakeMatcher {
  private index = new Map<string, MakeEntry>();

  constructor(rows: MakeRow[]) {
    for (const r of rows) {
      const entry: MakeEntry = {
        canonical: r.make_canonical,
        category: r.category,
        isChassis: !!r.is_motorhome_chassis,
      };
      // The canonical name itself is always a valid variant.
      const variants = [r.make_canonical, ...(r.make_variants ?? [])];
      for (const v of variants) {
        const key = normMake(v);
        if (key) this.index.set(key, entry);
      }
    }
  }

  /** Returns the canonical entry for a raw make, or null if it's not an RV make. */
  match(rawMake: string | undefined | null): MakeEntry | null {
    if (!rawMake) return null;
    return this.index.get(normMake(rawMake)) ?? null;
  }
}
