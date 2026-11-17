import { useStore } from '../store/useStore.js'
import { exOr, figureOf } from '../lib/exercises.js'
import Icon from './Icon.jsx'
import { useExerciseStill } from './CustomMedia.jsx'

/**
 * One exercise's picture for a thumbnail, by id: the catalogue still, or a custom exercise's own
 * poster from the local store (useExerciseStill). Without a picture it draws `fallback`, the
 * dumbbell tile by default. The caller's wrapper (a stack slot, a tile) is the caller's.
 */
export default function ExerciseStillImg({ id, size, fallback = <i><Icon name="dumbbell" className="g-icon" /></i> }) {
  const figure = useStore(s => figureOf(s.S))
  const src = useExerciseStill(id ? exOr(id) : null, figure)
  return src ? <img src={src} alt="" width={size} height={size} loading="lazy" /> : fallback
}
