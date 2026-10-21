import { useLayoutEffect, useState } from 'react'
import CoachSoon from '../../../views/CoachSoon.jsx'
import { registerScreens } from '../registry.js'

// The Coach's "coming soon" page (lib/coach-availability.js): what /train/coach shows everyone
// while the Coach is off. The second state holds the app's Reduce motion switch on for as long as
// it shows, so the scene is its still final frame and the dots do not pulse.
function Still() {
  const [on, setOn] = useState(false)
  useLayoutEffect(() => {
    const root = document.documentElement
    const was = root.dataset.motion
    root.dataset.motion = 'reduce'
    setOn(true)
    return () => { if (was === undefined) delete root.dataset.motion; else root.dataset.motion = was }
  }, [])
  return on ? <CoachSoon /> : null
}

registerScreens('Train slice 6', [
  { id: 'T11.soon', title: 'Coach, coming soon', note: 'The line-art draws on, the dots pulse; a labelled preview of a review, a suggestion and the check-in (inert).',
    path: '/train/coach', render: () => <CoachSoon /> },
  { id: 'T11.soon-rm', title: 'Coach, coming soon, reduced motion', note: 'Same page with Reduce motion on: the scene fades in, nothing loops.',
    path: '/train/coach', render: () => <Still /> },
])
