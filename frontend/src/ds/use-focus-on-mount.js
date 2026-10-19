import { useEffect, useRef } from 'react'

// A message that appears because something just failed (an alert, a banner) takes focus when it
// mounts, so a screen reader reads it and a keyboard starts from it. Callers key it per failure,
// so a second failure is a new element and is announced again. The element needs tabIndex={-1}.
export function useFocusOnMount(on = true) {
  const ref = useRef(null)
  useEffect(() => { if (on) ref.current?.focus() }, [])
  return ref
}
