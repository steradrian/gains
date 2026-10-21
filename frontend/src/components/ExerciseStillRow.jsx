import ExerciseThumbRow from '../ds/ExerciseThumbRow.jsx'
import { useExerciseStill } from './CustomMedia.jsx'

// ds/ExerciseThumbRow for one exercise, with its picture: the catalogue still, or a custom
// exercise's own (useExerciseStill). `figure` is the person's body figure (lib/exercises
// figureOf); every other prop goes to the row.
export default function ExerciseStillRow({ ex, figure, ...row }) {
  const image = useExerciseStill(ex, figure)
  return <ExerciseThumbRow image={image} {...row} />
}
