// Sports & activities (catalogue category 'sports & activities', ids 12101 to 12116): swimming,
// football, yoga and the like, logged inside a workout and counted toward Burned.
//
// They are cardio exercises (body part cardio), so a set is minutes first, as ever. What differs is
// the second number:
//   distance  running, cycling, swimming, hiking, walking, rowing: { min, speed } with the speed in
//             km/h like every cardio set; the distance is min x speed / 60 and is shown, never stored.
//   effort    team and racket sports, climbing, yoga, dance: { min, eff } where eff is 1 easy,
//             2 moderate, 3 hard. No speed, no distance.
// A set without `eff` and an exercise outside this table read exactly as cardio always did.
//
// Energy: kcal = MET x body weight (kg) x hours. MET values are from the Compendium of Physical
// Activities (Ainsworth et al., 2011 update); where the Compendium has no row for the sport, the
// closest one is used and said so. A finished workout reaches Burned through the hub, which works
// from the workout's cardio rows (api/sync-data.js): the MET rides on the set as `met`
// (stampSportMet, written when the session finishes) and goes out on that row, so this table is
// the only copy of it.
import { t } from './i18n-core.js'
import { fmtNum } from './format.js'

export const SPORTS_CATEGORY = 'sports & activities'

/** Easy, moderate, hard as stored on a set. */
export const EFFORT_LEVELS = [1, 2, 3]
export const DEFAULT_EFFORT = 2

// A body weight to estimate with when the person has not logged one: a round adult figure, so a
// sports session still counts for something. The estimate is labelled an estimate wherever shown.
export const FALLBACK_KG = 70

// Distance sports. `bands` is [upper bound in km/h, MET] in order, for sports whose cost climbs
// steeply with speed; `met` is the value for a set with no speed. `speed` is the km/h a new set
// opens at.
//   running  Compendium running 5 mph 8.3, 6 mph 9.8, 7 mph 11.0, 8 mph 11.8, 9 mph 12.8, 10 mph 14.5; jogging 7.0 below that
//   cycling  bicycling < 10 mph 4.0, 10-11.9 mph 6.8, 12-13.9 mph 8.0, 14-15.9 mph 10.0, 16-19 mph 12.0, over 20 mph 15.8
//   walking  walking 2.0 mph 2.8, 3.0 mph 3.5, 3.5 mph 4.3, 4.0 mph 5.0, 4.5 mph 7.0 (brisk, firm surface)
//   swimming laps, freestyle, light to moderate 5.8, rounded to 6.0 (vigorous 9.8 is not offered: log it as time)
//   hiking   hiking, cross country 6.0
//   rowing   rowing, stationary, moderate (100 W) 7.0
const DISTANCE = {
  12101: { met: 9.8, speed: 9, bands: [[8, 7], [9.7, 8.3], [11.3, 9.8], [12.9, 11], [14.5, 11.8], [16.1, 12.8], [Infinity, 14.5]] },
  12102: { met: 7.5, speed: 20, bands: [[16, 4], [19.2, 6.8], [22.4, 8], [25.7, 10], [32.2, 12], [Infinity, 15.8]] },
  12103: { met: 6, speed: 2.5 },
  12104: { met: 6, speed: 4 },
  12105: { met: 3.5, speed: 5, bands: [[3.7, 2.8], [5.2, 3.5], [6, 4.3], [6.8, 5], [Infinity, 7]] },
  12106: { met: 7, speed: 8 },
}

// Effort sports: [easy, moderate, hard].
//   football    Compendium soccer, casual 7.0 and competitive 10.0; easy is a light kickabout, 5.0
//   tennis      tennis, doubles 6.0, general 7.3, singles 8.0
//   basketball  shooting baskets 4.5, general 6.5, game 8.0
//   padel       no Compendium row: tennis doubles 6.0 at the centre, a step either side
//   climbing    rock climbing, rappelling 5.0, ascending 8.0, high difficulty 11.0
//   yoga        yoga, Nadisodhana 2.0, Hatha 2.5, power 4.0
//   volleyball  non-competitive 3.0, general 4.0, competitive 8.0
//   badminton   social singles and doubles 4.5, general 5.5, competitive 7.0
//   dancing     slow ballroom 3.0, general aerobic 5.0, fast 7.3
//   other       a plain light, medium and vigorous activity: 3.0, 5.0, 8.0
const EFFORT = {
  12107: [5, 7, 10],
  12108: [6, 7.3, 8],
  12109: [4.5, 6.5, 8],
  12110: [4.5, 6, 7.3],
  12111: [5, 8, 11],
  12112: [2, 2.5, 4],
  12113: [3, 4, 8],
  12114: [4.5, 5.5, 7],
  12115: [3, 5, 7.3],
  12116: [3, 5, 8],
}

const idOf = idOrEx => String(typeof idOrEx === 'object' && idOrEx ? idOrEx.id : idOrEx ?? '')

/** 'distance' or 'effort' for a sports exercise, null for anything else. */
export function sportKindOf(idOrEx) {
  const id = idOf(idOrEx)
  if (Object.hasOwn(DISTANCE, id)) return 'distance'
  if (Object.hasOwn(EFFORT, id)) return 'effort'
  return null
}
export const isSport = idOrEx => sportKindOf(idOrEx) !== null
export const isEffortSport = idOrEx => sportKindOf(idOrEx) === 'effort'
export const isDistanceSport = idOrEx => sportKindOf(idOrEx) === 'distance'

/** The speed (km/h) a new set of a distance sport opens at. */
export const defaultSportSpeed = idOrEx => DISTANCE[idOf(idOrEx)]?.speed ?? null

/** A stored level as 1, 2 or 3; anything else is moderate. */
export const effortLevel = v => (EFFORT_LEVELS.includes(Number(v)) ? Number(v) : DEFAULT_EFFORT)

/** Easy, Moderate or Intense, in the person's language. */
export function effortLabel(level) {
  const l = effortLevel(level)
  return l === 1 ? t('Easy') : l === 3 ? t('Intense') : t('Moderate')
}

/** Kilometres covered by a distance set: minutes x km/h / 60, to 0.01; null without both. */
export function setDistanceKm(set) {
  const min = Number(set?.min), speed = Number(set?.speed)
  return min > 0 && speed > 0 ? Math.round((speed * min) / 60 * 100) / 100 : null
}

const KM_PER_MI = 1.609344

/** "4 km", or "2.5 mi" for a profile that reads speed in mph; null for a set with no distance. */
export function fmtSetDistance(set, speedUnit) {
  const km = setDistanceKm(set)
  if (!km) return null
  return speedUnit === 'mph' ? `${fmtNum(Math.round((km / KM_PER_MI) * 100) / 100)} mi` : `${fmtNum(km)} km`
}

/** The MET of one set of a sport, or null for a set that is not one. */
export function sportMet(idOrEx, set) {
  const id = idOf(idOrEx)
  const d = DISTANCE[id]
  if (d) {
    const speed = Number(set?.speed)
    if (d.bands && speed > 0) return d.bands.find(([below]) => speed < below)[1]
    return d.met
  }
  const e = EFFORT[id]
  return e ? e[effortLevel(set?.eff) - 1] : null
}

/** kcal for one set: MET x kg x hours, to the nearest 5. Null for a set with no minutes or no MET. */
export function sportKcal(idOrEx, set, kg = FALLBACK_KG) {
  const met = sportMet(idOrEx, set)
  const min = Number(set?.min)
  if (met == null || !(min > 0)) return null
  const w = kg > 0 ? kg : FALLBACK_KG
  return Math.round((met * w * min) / 60 / 5) * 5
}

/** The same set with its MET written on it, for a finished workout (a done sport set that has none).
 *  Any other set comes back as it was, the same object. */
export function stampSportMet(idOrEx, set) {
  if (!set || set.done !== true || !(Number(set.min) > 0)) return set
  const met = sportMet(idOrEx, set)
  return met == null || set.met === met ? set : { ...set, met }
}
