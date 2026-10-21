// /train/workout: the running workout while one is open, the way in while none is. core-M3
// swaps the running line for the new screen, finish-M2 the other for Ready.
import { useStore } from '../../store/useStore.js'
import { ActiveWorkout, StartChooser } from '../Workout.jsx'

export default function WorkoutRoute() {
  const active = useStore(s => s.S.active)
  return active ? <ActiveWorkout /> : <StartChooser />
}
