// My goal's maths: calories, macros and water from a body and a goal. Pure, no UI.
//
// The numbers are the hub's (gains-hub src/onboarding/targets.ts computeTargets and
// constants.ts), so a target set here lands where the onboarding would have put it for the same
// person. The one difference is the activity input: the hub works the level out from the day plus
// the training days; Me takes the daily-movement level itself and never adds workouts (board
// rule, owner question 9: burned is shown on its own).

// constants.ts BMR (Mifflin-St Jeor as NutriTrace computes it). `unspecified` is the mean of the
// two sex constants, so "prefer not to say" never throws and never reads as one sex.
export const BMR = { perCm: 6.25, perKg: 9.99, perYear: 4.92, male: 5, female: -161, unspecified: (5 + -161) / 2 }
export const AGE_MIN = 15
// constants.ts ACTIVITY_MULTIPLIER
export const ACTIVITY_MULTIPLIER = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }
// constants.ts GOAL_FACTOR (this app's goals are lose, keep, build)
export const GOAL_FACTOR = { lose: 0.8, keep: 1, build: 1.1 }
// constants.ts LOSE_MAX_WEEKLY_SHARE, KCAL_PER_KG, CALORIE_FLOOR_KCAL
export const LOSE_MAX_WEEKLY_SHARE = 0.0075
export const KCAL_PER_KG = 7700
export const CALORIE_FLOOR_KCAL = 1200
// constants.ts PROTEIN_G_PER_KG, FAT_SHARE, KCAL_PER_G
export const PROTEIN_G_PER_KG = { lose: 2.0, keep: 1.6, build: 1.8 }
export const FAT_SHARE = { lose: 0.25, keep: 0.3, build: 0.25 }
export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 }
// constants.ts WATER_ML_PER_KG, WATER_ACTIVITY_BONUS_ML, WATER_ROUND_ML
export const WATER_ML_PER_KG = 35
export const WATER_ACTIVITY_BONUS_ML = { sedentary: 0, light: 350, moderate: 500, active: 700, very_active: 1000 }
export const WATER_ROUND_ML = 50

const YEAR_MS = 365.25 * 24 * 3600 * 1000
const round2 = n => Math.round(n * 100) / 100

// A level that is not one of the five (a setting never written) reads as the lowest: a burn that
// promises less is the safer miss.
const levelOf = activity => (ACTIVITY_MULTIPLIER[activity] ? activity : 'sedentary')
const bmrSex = sex => (sex === 'male' || sex === 'female' ? sex : 'unspecified')

/** Whole years from the middle of the birth year (the hub's `dob` convention), never under 15. */
export function ageOf(birthYear, now = Date.now()) {
  const years = Math.floor((now - Date.parse(`${birthYear}-07-01T00:00:00Z`)) / YEAR_MS)
  return Math.max(AGE_MIN, years)
}

const valid = ({ birthYear, heightCm, weightKg }) =>
  Number.isFinite(birthYear) && heightCm > 0 && weightKg > 0

/**
 * Calories burned a day before workouts: BMR times the movement multiplier, rounded (the hub's
 * `tdee`). Null when the body details are not all there.
 */
export function burnOf({ sex, birthYear, heightCm, weightKg, activity, now = Date.now() }) {
  if (!valid({ birthYear, heightCm, weightKg })) return null
  const bmr = BMR.perCm * heightCm + BMR.perKg * weightKg - BMR.perYear * ageOf(birthYear, now) + BMR[bmrSex(sex)]
  return Math.round(bmr * ACTIVITY_MULTIPLIER[levelOf(activity)])
}

/** The goal's factor on the burn. A loss is capped at 0.75% of body weight a week (hub factorOf). */
export function factorOf(goal, burn, weightKg) {
  const factor = GOAL_FACTOR[goal] ?? 1
  if (factor >= 1 || burn <= 0) return factor
  const maxDeficit = (LOSE_MAX_WEEKLY_SHARE * weightKg * KCAL_PER_KG) / 7
  if (burn * (1 - factor) <= maxDeficit) return factor
  // Up to the hundredth, so the cap is never overshot by the rounding.
  return Math.ceil((1 - maxDeficit / burn) * 100) / 100
}

/**
 * The daily targets for a goal. Null when the body details are not all there.
 * `{ age, burn, factor, calories, proteinG, carbsG, fatG, waterMl, weeklyChangeKg, belowFloor }`;
 * `weeklyChangeKg` is signed (negative: a loss). Protein follows the hub: by current body weight.
 */
export function targetsFor({ goal, sex, birthYear, heightCm, weightKg, activity, now = Date.now() }) {
  const burn = burnOf({ sex, birthYear, heightCm, weightKg, activity, now })
  if (burn == null) return null
  const g = GOAL_FACTOR[goal] != null ? goal : 'keep'
  const factor = factorOf(g, burn, weightKg)
  const calories = Math.round(burn * factor)
  const proteinG = Math.round(PROTEIN_G_PER_KG[g] * weightKg)
  const fatG = Math.round((calories * FAT_SHARE[g]) / KCAL_PER_G.fat)
  const carbsG = Math.max(0, Math.round((calories - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat) / KCAL_PER_G.carbs))
  const waterMl = Math.round((weightKg * WATER_ML_PER_KG + WATER_ACTIVITY_BONUS_ML[levelOf(activity)]) / WATER_ROUND_ML) * WATER_ROUND_ML
  return {
    age: ageOf(birthYear, now),
    burn,
    factor,
    calories,
    proteinG,
    carbsG,
    fatG,
    waterMl,
    weeklyChangeKg: round2(((calories - burn) * 7) / KCAL_PER_KG),
    belowFloor: calories < CALORIE_FLOOR_KCAL,
  }
}

/**
 * Whole weeks to get from `current` to `target` at `weeklyKg` a week (signed, as `weeklyChangeKg`),
 * all in one unit. 0 when there; null when the rate is missing or moves away from the target.
 */
export function weeksTo(current, target, weeklyKg) {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return null
  const gap = target - current
  if (gap === 0) return 0
  if (!Number.isFinite(weeklyKg) || weeklyKg === 0 || (gap > 0) !== (weeklyKg > 0)) return null
  return Math.max(1, Math.round(gap / weeklyKg))
}
