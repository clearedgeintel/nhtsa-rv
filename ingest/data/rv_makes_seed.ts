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
  { make_canonical: "FOREST RIVER", make_variants: ["FOREST RIVER", "FOREST RIVER INC", "COACHMEN", "COACHMEN RV", "PALOMINO", "PRIME TIME", "CHEROKEE", "SUNSEEKER", "GEORGETOWN", "ROCKWOOD", "FLAGSTAFF", "SHASTA", "SHASTA REVERE", "EAST TO WEST", "EAST TO WEST RV"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "JAYCO", make_variants: ["JAYCO", "JAYCO INC", "ENTEGRA COACH JAYCO", "STARCRAFT", "STARCRAFT RV", "HIGHLAND RIDGE", "JAYCO TRAVEL TRAILER", "JAYCO TRAVEL TRAILERS", "JAYCO FIFTH WHEEL", "JAYCO CAMPING TRAILER", "JAYCO CLASS A MOTORHOME", "JAYCO CLASS C MOTORHOME"], category: "coach", is_motorhome_chassis: false },

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

  // ---- Brands discovered in the NHTSA data (cross-referenced to the USA RV manufacturer
  // list). Ambiguous bare names that collide with cars/tires/hitches were excluded
  // (e.g. ESCAPE→Ford, ECLIPSE→Mitsubishi, EXPLORER→Ford, KELLY SAFARI→tire). ----
  { make_canonical: "CRUISER RV", make_variants: ["CRUISER RV", "CRUISER", "SHADOW CRUISER"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "TRIPLE E", make_variants: ["TRIPLE E", "TRIPLE E RV"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "DRV", make_variants: ["DRV", "DRV LUXURY SUITES", "DRV SUITES"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "NEWELL", make_variants: ["NEWELL", "NEWELL COACH"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "SAFARI", make_variants: ["SAFARI", "SAFARI COACH", "SAFARI MOTOR COACHES"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "SAFARI CONDO", make_variants: ["SAFARI CONDO"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "MIDWEST AUTOMOTIVE DESIGN", make_variants: ["MIDWEST AUTOMOTIVE DESIGN", "MIDWEST AUTOMOTIVE"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "COLEMAN", make_variants: ["COLEMAN", "COLEMAN RV"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "VANLEIGH", make_variants: ["VANLEIGH", "VANLEIGH RV"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "HOST CAMPERS", make_variants: ["HOST CAMPERS", "HOST"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "LAZY DAZE", make_variants: ["LAZY DAZE"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "CHALET", make_variants: ["CHALET", "CHALET RV", "CHALET TRUCK CAMPERS"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "REGENCY", make_variants: ["REGENCY", "REGENCY RV", "REGENCY GT"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "CHINOOK", make_variants: ["CHINOOK", "CHINOOK RV"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "BRAXTON CREEK", make_variants: ["BRAXTON CREEK"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "ALINER", make_variants: ["ALINER", "ALINER LLC"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "GRECH", make_variants: ["GRECH", "GRECH RV", "GRECH MOTORS"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "BIGFOOT", make_variants: ["BIGFOOT", "BIGFOOT INDUSTRIES"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "HITCHHIKER", make_variants: ["HITCHHIKER", "HITCH-HIKER", "NU-WA", "NUWA"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "EMBER", make_variants: ["EMBER", "EMBER RV"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "PACIFIC COACHWORKS", make_variants: ["PACIFIC COACHWORKS"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "PHOENIX USA", make_variants: ["PHOENIX USA", "PHOENIX CRUISER", "PHOENIX"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "ADVENTURER", make_variants: ["ADVENTURER", "ADVENTURER MANUFACTURING", "ADVENTURER LP"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "BOWLUS", make_variants: ["BOWLUS"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "VENTURE RV", make_variants: ["VENTURE RV", "VENTURE"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "RUGGED MOUNTAIN", make_variants: ["RUGGED MOUNTAIN", "RUGGED MOUNTAIN CUSTOM RV"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "NORTHSTAR", make_variants: ["NORTHSTAR", "NORTHSTAR CAMPERS", "NORTHSTAR ARROW"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "MARATHON COACH", make_variants: ["MARATHON COACH"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "NEW HORIZONS", make_variants: ["NEW HORIZONS", "NEW HORIZON", "NEW HORIZONS RV"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "SUNSET PARK", make_variants: ["SUNSET PARK", "SUNSET PARK RV", "SUNSET PARK & RV"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "CASITA", make_variants: ["CASITA", "CASITA ENTERPRISES"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "SPORTSMOBILE", make_variants: ["SPORTSMOBILE"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "EARTHROAMER", make_variants: ["EARTHROAMER"], category: "coach", is_motorhome_chassis: false },
  { make_canonical: "THE RV FACTORY", make_variants: ["THE RV FACTORY", "RV FACTORY"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "TRAVEL LITE", make_variants: ["TRAVEL LITE", "TRAVEL LITE RV"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "NORTHERN LITE", make_variants: ["NORTHERN LITE"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "LITTLE GUY", make_variants: ["LITTLE GUY", "LITTLE GUY TRAILERS"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "OLD SCHOOL TRAILERS", make_variants: ["OLD SCHOOL TRAILERS"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "HAPPIER CAMPER", make_variants: ["HAPPIER CAMPER"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "EMBASSY", make_variants: ["EMBASSY", "EMBASSY RV"], category: "towable", is_motorhome_chassis: false },
  { make_canonical: "CAPRI CAMPER", make_variants: ["CAPRI CAMPER"], category: "towable", is_motorhome_chassis: false },
];
