// /train/workout: the running workout while one is open, Ready (W1.1) while none is. core-M3
// swaps the running line for the new screen.
import { useStore } from '../../store/useStore.js'
import { ActiveWorkout } from '../Workout.jsx'
import ReadyScreen from './ReadyScreen.jsx'

export default function WorkoutRoute() {
  const active = useStore(s => s.S.active)
  return active ? <ActiveWorkout /> : <ReadyScreen />
}
