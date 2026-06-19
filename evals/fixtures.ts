// Hand-verified eval fixtures (CLAUDE.md §9). Each `number` value was derived from the
// golden SQL in evals/goldens.sql and confirmed against the live DB (see numbers as of the
// header date). Re-run goldens.sql after a data refresh and update the values here.
//
// Verified: 2026-06-19  (90 makes, 2,650 recalls, 14,483 complaints)

export type Check =
  | { kind: "number"; value: number; mention?: string[] } // count appears in the answer (+ entity mention)
  | { kind: "mention"; all?: string[]; any?: string[]; none?: string[] }
  | { kind: "narratives"; min: number; failureMode?: string }
  | { kind: "sourcesAny"; ids: string[] };

export type Fixture = {
  id: string;
  category:
    | "recall-count" | "complaint-count" | "chassis-coach" | "semantic"
    | "metric" | "grounding" | "normalization" | "comparison" | "investigation";
  question: string;
  golden?: string; // SQL the expected value came from (documentation)
  checks: Check[];
  note?: string;
};

export const FIXTURES: Fixture[] = [
  // ---------- Recall counts ----------
  {
    id: "winn-coach-recalls", category: "recall-count",
    question: "How many recalls have been filed under the Winnebago coach brand (excluding chassis)?",
    golden: "select count(distinct campaign_id) from recall_vehicles where make_canonical='WINNEBAGO' and is_chassis=false",
    checks: [{ kind: "number", value: 159, mention: ["winnebago"] }],
  },
  {
    id: "winn-2024-recalls", category: "recall-count",
    question: "How many recall campaigns affect Winnebago 2024 model-year vehicles?",
    golden: "select count(distinct campaign_id) from recall_vehicles where make_canonical='WINNEBAGO' and model_year=2024 and is_chassis=false",
    checks: [{ kind: "number", value: 25, mention: ["winnebago", "2024"] }],
  },
  {
    id: "forest-recalls", category: "recall-count",
    question: "How many total recall campaigns are there for Forest River?",
    // recall_vehicles distinct (537) > recalls representative count (532): a few campaigns
    // list Forest River alongside another make and collapse to a different representative in
    // `recalls`. The complete answer (campaigns involving Forest River anywhere) is 537.
    golden: "select count(distinct campaign_id) from recall_vehicles where make_canonical='FOREST RIVER'",
    checks: [{ kind: "number", value: 537, mention: ["forest river"] }],
  },
  {
    id: "grand-design-recalls", category: "recall-count",
    question: "How many recall campaigns does Grand Design have?",
    golden: "select count(*) from recalls where make_canonical='GRAND DESIGN'",
    checks: [{ kind: "number", value: 56, mention: ["grand design"] }],
  },
  {
    id: "total-recalls", category: "recall-count",
    question: "How many RV recall campaigns are in the database in total?",
    golden: "select count(*) from recalls",
    checks: [{ kind: "number", value: 2650 }],
  },
  {
    id: "brinkley-recalls", category: "recall-count",
    question: "How many recalls does Brinkley RV have?",
    golden: "select count(*) from recalls where make_canonical='BRINKLEY'",
    checks: [{ kind: "number", value: 11, mention: ["brinkley"] }],
    note: "Newly-added make must be answerable.",
  },

  // ---------- Complaint counts ----------
  {
    id: "forest-fire-complaints", category: "complaint-count",
    question: "How many fire-related complaints does Forest River have?",
    golden: "select count(*) from complaints where make_canonical='FOREST RIVER' and failure_mode='fire'",
    checks: [{ kind: "number", value: 100, mention: ["forest river", "fire"] }],
  },
  {
    id: "winn-complaints", category: "complaint-count",
    question: "How many consumer complaints are there for Winnebago in total?",
    golden: "select count(*) from complaints where make_canonical='WINNEBAGO'",
    checks: [{ kind: "number", value: 1460, mention: ["winnebago"] }],
  },
  {
    id: "winn-critical", category: "complaint-count",
    question: "How many critical-severity complaints does Winnebago have?",
    golden: "select count(*) from complaints where make_canonical='WINNEBAGO' and severity='critical'",
    checks: [{ kind: "number", value: 578, mention: ["winnebago", "critical"] }],
  },
  {
    id: "brinkley-complaints", category: "complaint-count",
    question: "How many complaints are there for Brinkley?",
    golden: "select count(*) from complaints where make_canonical='BRINKLEY'",
    checks: [{ kind: "number", value: 6, mention: ["brinkley"] }],
  },

  // ---------- Chassis vs. coach (the core accuracy trap) ----------
  {
    id: "winn-classA-2024-chassis", category: "chassis-coach",
    question: "How many recalls are there on Winnebago Class A motorhomes in 2024, including chassis?",
    golden: "coach: 25 (recall_vehicles WINNEBAGO 2024); chassis filed separately under Ford/Freightliner/etc.",
    checks: [
      { kind: "number", value: 25, mention: ["winnebago"] },
      { kind: "mention", all: ["chassis"], any: ["ford", "freightliner", "spartan", "workhorse", "mercedes"] },
    ],
    note: "REGRESSION GUARD: must not silently undercount by ignoring chassis recalls.",
  },
  {
    id: "tiffin-chassis-aware", category: "chassis-coach",
    question: "How many recalls are there for Tiffin motorhomes?",
    checks: [{ kind: "mention", all: ["chassis"] }],
    note: "Motorhome brand → must surface the coach-vs-chassis distinction.",
  },
  {
    id: "winn-ambiguous", category: "chassis-coach",
    question: "How many Winnebago recalls are there?",
    checks: [{ kind: "mention", all: ["chassis"], any: ["coach", "159"] }],
    note: "Ambiguous: should clarify coach vs chassis rather than give one undefined number.",
  },

  // ---------- Semantic search ----------
  {
    id: "brake-loss-downhill", category: "semantic",
    question: "Find complaints describing sudden loss of braking while going downhill.",
    checks: [{ kind: "narratives", min: 3, failureMode: "brakes" }],
  },
  {
    id: "water-intrusion", category: "semantic",
    question: "Show complaints about water leaking into the cabin or roof leaks.",
    checks: [{ kind: "narratives", min: 3, failureMode: "water_intrusion" }],
  },
  {
    id: "furnace-grand-design", category: "semantic",
    question: "Are there complaints about furnace or heating problems on Grand Design?",
    // The agent may answer via semantic search OR a SQL filter on failure_mode/component —
    // both are valid, so check the substance (make + a heating-related term) not the tool path.
    checks: [{ kind: "mention", all: ["grand design"], any: ["furnace", "heat", "appliance", "propane", "lp"] }],
    note: "Domain-specific query; tool path (semantic vs SQL) is the agent's choice.",
  },

  // ---------- Metric-definition guardrails ----------
  {
    id: "affected-units", category: "metric",
    question: "How many vehicles were potentially affected by Winnebago recalls in total?",
    golden: "select sum(affected_units) from recalls where make_canonical='WINNEBAGO'",
    checks: [{ kind: "number", value: 302658, mention: ["winnebago"] }],
    note: "Affected units != number of recall campaigns.",
  },
  {
    id: "recall-vs-complaint", category: "metric",
    question: "Are recalls and complaints the same thing?",
    checks: [{ kind: "mention", any: ["different", "not the same", "distinct", "separate"] }],
    note: "Must not conflate sources.",
  },

  // ---------- Grounding ----------
  {
    id: "nonexistent-make", category: "grounding",
    question: "How many recalls are there for Frobnicator RV?",
    checks: [
      { kind: "mention", any: ["no ", "none", "not find", "0 ", "couldn't", "no recall", "no data", "not in"] },
      { kind: "mention", none: ["159", "532"] },
    ],
    note: "Must not fabricate numbers for a make with no data.",
  },
  {
    id: "cite-tire-complaints", category: "grounding",
    question: "Show a few specific complaints about RV tire blowouts, with their ODI numbers.",
    checks: [{ kind: "narratives", min: 1 }],
    note: "Answers should cite verifiable ODI ids.",
  },

  // ---------- Make normalization ----------
  {
    id: "itasca-variant", category: "normalization",
    question: "How many recalls mention Itasca?",
    checks: [{ kind: "mention", all: ["winnebago"] }],
    note: "Itasca is a Winnebago variant → must resolve to canonical WINNEBAGO.",
  },
  {
    id: "coleman-disambiguation", category: "normalization",
    question: "What issues are reported on Coleman RVs?",
    checks: [{ kind: "mention", all: ["coleman"] }],
    note: "Coleman resolves to the RV make (not furnace components).",
  },

  // ---------- Comparison ----------
  {
    id: "compare-makes", category: "comparison",
    question: "Compare the number of recalls between Winnebago and Grand Design.",
    checks: [
      { kind: "mention", all: ["winnebago", "grand design"] },
      { kind: "number", value: 56 },
    ],
  },

  // ---------- Investigations ----------
  {
    id: "winn-investigations", category: "investigation",
    question: "How many defect investigations involve Winnebago?",
    golden: "select count(*) from investigations where make_canonical='WINNEBAGO'",
    checks: [{ kind: "number", value: 20, mention: ["winnebago"] }],
  },
];
