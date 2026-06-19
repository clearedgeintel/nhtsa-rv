// Curated RV make universe (CLAUDE.md §4 rv_makes). Variants are the raw NHTSA MAKETXT
// spellings (uppercase) that should normalize to each canonical make. This list is the
// source of truth; 01_rv_reference.ts enriches the towable/motorhome universe from vPIC,
// and 03_filter_rv.ts logs any high-frequency unmatched makes so the list can be refined.
//
//   category: 'coach' (motorhome) | 'towable' (trailer / fifth-wheel) | 'chassis'
//   is_motorhome_chassis: true ONLY for the chassis makes a motorhome is built on.

export type RvMakeSeed = {
  make_canonical: string;
  make_variants: string[];
  category: "coach" | "towable" | "chassis";
  is_motorhome_chassis: boolean;
};

export const RV_MAKES_SEED: RvMakeSeed[] = [
  // ---- Motorhome chassis makes (chassis recalls are filed here; §6 chassis-vs-coach) ----
  { make_canonical: "FORD", make_variants: ["FORD", "FORD MOTOR COMPANY"], category: "chassis", is_motorhome_chassis: true },
  { make_canonical: "FREIGHTLINER", make_variants: ["FREIGHTLINER", "FREIGHTLINER CUSTOM CHASSIS", "FREIGHTLINER CHASSIS", "FCCC", "FREIGHTLINER CUSTOM CHASSIS CORPORATION"], category: "chassis", is_motorhome_chassis: true },
  { make_canonical: "MERCEDES-BENZ", make_variants: ["MERCEDES-BENZ", "MERCEDES BENZ", "MERCEDESBENZ"], category: "chassis", is_motorhome_chassis: true },
  { make_canonical: "SPARTAN", make_variants: ["SPARTAN", "SPARTAN MOTORS", "SPARTAN CHASSIS", "SPARTAN RV CHASSIS"], category: "chassis", is_motorhome_chassis: true },
  { make_canonical: "WORKHORSE", make_variants: ["WORKHORSE", "WORKHORSE CUSTOM CHASSIS"], category: "chassis", is_motorhome_chassis: true },
  { make_canonical: "CHEVROLET", make_variants: ["CHEVROLET", "CHEVY"], category: "chassis", is_motorhome_chassis: true },
  { make_canonical: "RAM", make_variants: ["RAM", "DODGE", "RAM TRUCKS"], category: "chassis", is_motorhome_chassis: true },
  { make_canonical: "INTERNATIONAL", make_variants: ["INTERNATIONAL", "NAVISTAR"], category: "chassis", is_motorhome_chassis: true },
  // Prevost: bus shell / chassis base for luxury Class A conversions (Marathon, Liberty,
  // Featherlite). Treated as RV-dedicated chassis so all its records are kept.
  { make_canonical: "PREVOST", make_variants: ["PREVOST", "PREVOST CAR"], category: "chassis", is_motorhome_chassis: true },

  // ---- Motorhome / coach brands ----
  { make_canonical: "WINNEBAGO", make_variants: ["WINNEBAGO", "WINNEBAGO INDUSTRIES", "ITASCA"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "THOR MOTOR COACH", make_variants: ["THOR MOTOR COACH", "THOR", "THOR MOTORCOACH", "FOUR WINDS", "FOUR WINDS INTERNATIONAL"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "TIFFIN", make_variants: ["TIFFIN", "TIFFIN MOTORHOMES", "TIFFIN MOTOR HOMES", "ALLEGRO"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "NEWMAR", make_variants: ["NEWMAR", "NEWMAR CORPORATION"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "FLEETWOOD", make_variants: ["FLEETWOOD", "FLEETWOOD RV", "FLEETWOOD ENTERPRISES"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "ENTEGRA COACH", make_variants: ["ENTEGRA COACH", "ENTEGRA"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "DYNAMAX", make_variants: ["DYNAMAX", "DYNAMAX CORP"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "NEXUS", make_variants: ["NEXUS", "NEXUS RV"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "RENEGADE", make_variants: ["RENEGADE", "RENEGADE RV"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "MONACO", make_variants: ["MONACO", "MONACO COACH"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "HOLIDAY RAMBLER", make_variants: ["HOLIDAY RAMBLER"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "DAMON", make_variants: ["DAMON", "DAMON MOTOR COACH"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "GULF STREAM", make_variants: ["GULF STREAM", "GULFSTREAM", "GULF STREAM COACH"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "FORETRAVEL", make_variants: ["FORETRAVEL"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "COUNTRY COACH", make_variants: ["COUNTRY COACH"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "AMERICAN COACH", make_variants: ["AMERICAN COACH", "AMERICAN MOTORHOME"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "ROADTREK", make_variants: ["ROADTREK"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "PLEASURE-WAY", make_variants: ["PLEASURE-WAY", "PLEASURE WAY"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "LEISURE TRAVEL VANS", make_variants: ["LEISURE TRAVEL VANS", "LEISURE TRAVEL"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "COACH HOUSE", make_variants: ["COACH HOUSE"], category: "coach", is_motorhome_chassis: false },

  // ---- Brands that build both coaches and towables (matched the same regardless) ----
  { make_canonical: "FOREST RIVER", make_variants: ["FOREST RIVER", "FOREST RIVER INC", "COACHMEN", "COACHMEN RV", "PALOMINO", "PRIME TIME", "CHEROKEE", "SUNSEEKER", "GEORGETOWN", "ROCKWOOD", "FLAGSTAFF"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "JAYCO", make_variants: ["JAYCO", "JAYCO INC", "ENTEGRA COACH JAYCO", "STARCRAFT", "STARCRAFT RV", "HIGHLAND RIDGE"], category: "coach", is_motorhome_chassis: false },

  // ---- Towable brands (travel trailers, fifth wheels) ----
  { make_canonical: "KEYSTONE", make_variants: ["KEYSTONE", "KEYSTONE RV", "KEYSTONE RV COMPANY", "MONTANA", "COUGAR"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "GRAND DESIGN", make_variants: ["GRAND DESIGN", "GRAND DESIGN RV"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "HEARTLAND", make_variants: ["HEARTLAND", "HEARTLAND RV", "HEARTLAND RECREATIONAL VEHICLES"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "DUTCHMEN", make_variants: ["DUTCHMEN", "DUTCHMEN MANUFACTURING"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "AIRSTREAM", make_variants: ["AIRSTREAM", "AIRSTREAM INC"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "LANCE", make_variants: ["LANCE", "LANCE CAMPER"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "NORTHWOOD", make_variants: ["NORTHWOOD", "NORTHWOOD MANUFACTURING", "ARCTIC FOX", "NASH"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "ALLIANCE", make_variants: ["ALLIANCE", "ALLIANCE RV"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "BRINKLEY", make_variants: ["BRINKLEY", "BRINKLEY RV"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "CROSSROADS", make_variants: ["CROSSROADS", "CROSSROADS RV"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "KZ", make_variants: ["KZ", "KZ RV", "K-Z", "K-Z INC"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "OUTDOORS RV", make_variants: ["OUTDOORS RV", "OUTDOORS RV MANUFACTURING"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "OLIVER", make_variants: ["OLIVER", "OLIVER TRAVEL TRAILERS"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "NUCAMP", make_variants: ["NUCAMP", "NUCAMP RV", "NU CAMP"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "INTECH", make_variants: ["INTECH", "INTECH RV"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "RIVERSIDE", make_variants: ["RIVERSIDE", "RIVERSIDE RV"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "GENESIS SUPREME", make_variants: ["GENESIS SUPREME"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "ATC", make_variants: ["ATC", "ALUMINUM TRAILER COMPANY"], category: "towable", is_motorhome_chassis: false },
];
