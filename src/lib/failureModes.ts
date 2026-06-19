// Maps free-text answers back to the controlled failure-mode vocabulary produced by
// ingest/04_classify_narratives.ts, so the chat can deep-link a mentioned mode into the
// Explore taxonomy. Patterns are deliberately conservative (precision over recall) to
// avoid false "Explore this" chips. Canonical keys match the DB `complaints.failure_mode`
// exactly (incl. underscores), so they round-trip through the Explore ?mode= param.
import type { NarrativeHit } from "../types";

const MODE_PATTERNS: { mode: string; re: RegExp }[] = [
  { mode: "tires", re: /\btires?\b|\btyres?\b/i },
  { mode: "structural", re: /\bstructural\b|\bdelaminat/i },
  { mode: "brakes", re: /\bbrakes?\b|\bbraking\b/i },
  { mode: "electrical", re: /\belectrical\b|\bwiring\b/i },
  { mode: "suspension", re: /\bsuspension\b|\bleaf spring/i },
  { mode: "engine", re: /\bengine\b/i },
  { mode: "appliance", re: /\bappliances?\b|\brefrigerators?\b/i },
  { mode: "fire", re: /\bfires?\b/i },
  { mode: "water_intrusion", re: /\bwater intrusion\b|\bwater (?:leak|damage)\b|\broof leak/i },
  { mode: "wheels", re: /\bwheels?\b|\blug nut/i },
  { mode: "steering", re: /\bsteering\b/i },
  { mode: "lighting", re: /\blighting\b|\bheadlights?\b/i },
  { mode: "propane_lp", re: /\bpropane\b|\blp gas\b|\blpg\b/i },
  { mode: "fuel_system", re: /\bfuel (?:system|line|pump|leak|tank)\b/i },
  { mode: "chassis", re: /\bchassis\b/i },
  { mode: "slide_out", re: /\bslide[- ]?outs?\b/i },
  { mode: "transmission", re: /\btransmission\b/i },
  { mode: "awning", re: /\bawnings?\b/i },
  { mode: "leveling_jacks", re: /\bleveling jacks?\b|\bleveling system\b/i },
];
const KNOWN = new Set(MODE_PATTERNS.map((p) => p.mode));
const NON_LINKABLE = new Set(["other", "<UNKNOWN>"]);

/** Canonical failure modes referenced by an answer: those carried by its narrative hits
 *  (precise) plus any matched in the answer text. Capped, de-duplicated, order-stable. */
export function detectFailureModes(text: string, hits: NarrativeHit[] = [], cap = 4): string[] {
  const out: string[] = [];
  const add = (m: string | null | undefined) => {
    if (m && KNOWN.has(m) && !NON_LINKABLE.has(m) && !out.includes(m)) out.push(m);
  };
  for (const h of hits) add(h.failure_mode);
  for (const { mode, re } of MODE_PATTERNS) if (re.test(text)) add(mode);
  return out.slice(0, cap);
}

/** "water_intrusion" → "water intrusion" for display. */
export const humanizeMode = (m: string) => m.replace(/_/g, " ");
