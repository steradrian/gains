// What "by muscle" browses: the catalogue the equipment profile leaves, and the exercises that train
// a muscle. Shared by the By muscle page (views/train/exercises) and the exercise picker's By muscle
// tab, so the two cannot drift apart on what a muscle's list holds.
import { allExercises } from './exercises.js'
import { activeProfile, exAvailable } from './equipment.js'
import { musclesOf } from './muscles.js'

/** Every exercise, or only what the active equipment profile can do unless `showAll`. */
export function muscleCatalog(S, showAll = false) {
  const all = allExercises(S)
  return activeProfile(S) && !showAll ? all.filter(e => exAvailable(S, e)) : all
}

/** The exercises of `catalog` that train `muscle` (a muscles.js slug), primary or helper. */
export const exercisesForMuscle = (catalog, muscle) => catalog.filter(e => musclesOf(e)[muscle])
