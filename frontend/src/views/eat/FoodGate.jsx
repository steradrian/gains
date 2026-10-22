import { Outlet } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { foodTracked } from '../../lib/nutrition/food-tracked.js'
import FoodOffScreen from './FoodOffScreen.jsx'

// The layout of the Eat routes. With Food off the tab root and every page under it (a deep link
// from a notification or a bookmark) land on the same "Food is off" state; nothing is deleted.
// Only the switch gates here: a build without the nutrition hub keeps Eat's own "lives in the web
// app" state.
export default function FoodGate() {
  const tracked = useStore(s => foodTracked(s.S))
  return tracked ? <Outlet /> : <FoodOffScreen />
}
