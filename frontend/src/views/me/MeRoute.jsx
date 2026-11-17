import { useNavigate } from 'react-router-dom'
import { mePath } from '../../lib/tab-route.js'
import { measurementLogSheet } from './body/measure-drawers.jsx'
import { logWeightSheet } from './body/weigh-in-drawers.jsx'
import { openAddPhoto } from './photos/photo-drawers.jsx'
import MeScreen from './MeScreen.jsx'
import { useMe } from './use-me.js'

// /me, Profile: the Me tab's root. Container only: useMe() reads, MeScreen draws, and the quick
// actions that open drawers are wired here.
export default function MeRoute() {
  const nav = useNavigate()
  const me = useMe()
  const run = {
    weight: () => logWeightSheet(),
    measure: () => measurementLogSheet(),
    photo: () => openAddPhoto(),
    invite: () => nav(mePath('invite')),
  }
  return (
    <MeScreen
      {...me}
      onRing={slide => (slide?.log ? logWeightSheet() : me.onRing(slide))}
      onAction={key => run[key]?.()}
      onRow={row => nav(row.to)}
    />
  )
}
