import { useEffect, useState } from 'react'
import { clockText } from '../lib/workout-finish.js'

// A session's running time, "12:34" or "1:15:00" since `start`. Its own little component so the
// only thing that re-renders every second is this text: the workout header and the tab bar's
// Resume button both show it.
export default function Elapsed({ start }) {
  const [t, setT] = useState('0:00')
  useEffect(() => {
    const tick = () => setT(clockText(Date.now() - start))
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv)
  }, [start])
  return <span>{t}</span>
}
