import { Navigate } from 'react-router-dom'
import BurnedScreen from './BurnedScreen.jsx'
import { useBurned } from './use-burned.js'

// /food/burned. The page and the Eat root's Burned row exist only with Burned turned on
// (diaryShowActivity); with it off, or with no nutrition behind this build, the address goes to Eat.
export default function BurnedPage() {
  const burned = useBurned()
  if (burned.status === 'off') return <Navigate to="/food" replace />
  return <BurnedScreen {...burned} />
}
