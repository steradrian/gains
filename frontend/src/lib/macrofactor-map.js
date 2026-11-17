// MacroFactor exercise name (lower-case) -> Gains catalogue id.
//
// MacroFactor names a lift by grip, loading and technique ("Overhand Grip Cable Lat Pulldown",
// "Pin-Loaded Machine Leg Extension") where the catalogue names it by equipment and movement.
// Each entry below is the same movement, chosen by hand; where the catalogue has a single entry
// for a family (one lat pulldown, one leg extension) grip and technique variants share it.
// Names with no genuine catalogue twin are deliberately absent and import as custom exercises
// (e.g. "Standing Pin-Loaded Machine Glute Kickback": no machine kickback exists, and the cable
// or bodyweight kickbacks are different lifts).
export const MACROFACTOR_ID_MAP = {
  '45° incline barbell press': '0047',           // barbell incline bench press
  'low incline dumbbell press': '0314',          // dumbbell incline bench press
  'seated dumbbell overhead press': '0405',      // dumbbell seated shoulder press
  'bent-over overhand grip barbell row': '0027', // barbell bent over row
  'underhand grip yates row': '0118',            // barbell reverse grip bent over row (Yates = supinated, upright)
  'pin-loaded machine leg extension': '0585',    // lever leg extension
  'accentuated eccentric pin-loaded machine leg extension': '0585',
  'lying pin-loaded machine hamstring curl': '0586', // lever lying leg curl
  'plate-loaded machine hip thrust (starting from the bottom)': '7384', // lever hip thrust (plate loaded)
  'overhand grip cable lat pulldown': '2330',    // same entry the plain "Lat Pulldown" alias uses
  'underhand close grip cable lat pulldown': '0245', // cable underhand pulldown
  'cable rope straight arm lat pulldown': '0237', // cable straight arm pulldown (with rope)
  'overhand grip cable reverse fly': '11254',    // cable standing reverse fly
  'overhand grip machine fly': '0596',           // lever seated fly (pec deck)
  'incline chest-supported dumbbell rear delt fly': '2500', // dumbbell incline rear fly
}

// Qualifiers that describe grip or technique but not which movement it is. Used only by the
// fallback for names the table doesn't list, and only to retry the ordinary matcher.
const QUALIFIERS = [
  /\b(overhand|underhand|neutral|reverse|pronated|supinated)\s+grip\b/g,
  /\baccentuated eccentric\b/g,
  /\b(pin|plate)[- ]loaded\b/g,
  /\b\d+\s*°/g,
  /\(([^)]*)\)\s*$/g,
]

export function stripMacrofactorQualifiers(name) {
  let k = String(name || '').toLowerCase()
  QUALIFIERS.forEach(re => { k = k.replace(re, ' ') })
  return k.replace(/\s+/g, ' ').trim()
}
