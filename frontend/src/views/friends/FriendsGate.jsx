import { Navigate, Outlet } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { friendsAvailable } from '../../lib/friends/api.js'
import { useFriendsMe } from '../../lib/friends/use-friends.js'

// The layout of the Friends routes (/me/groups/*). Someone signed out, on the demo, on a phone with
// no server, or on a server that has no Friends lands on Me instead of a page that cannot work.
// It also keeps the cache fresh for as long as any Friends screen is on show (store.js
// watchFriends), so the screens below ask for nothing themselves.
export default function FriendsGate() {
  useStore(s => s.user)
  useFriendsMe()
  return friendsAvailable() ? <Outlet /> : <Navigate to="/me" replace />
}
