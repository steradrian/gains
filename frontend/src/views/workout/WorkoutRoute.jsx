// /train/workout: the running workout while one is open, Ready (W1.1) while none is.
import { useStore } from '../../store/useStore.js'
import WorkoutScreen from './WorkoutScreen.jsx'
import ReadyScreen from './ReadyScreen.jsx'

export default function WorkoutRoute() {
  const active = useStore(s => s.S.active)
  return active ? <WorkoutScreen /> : <ReadyScreen />
}
