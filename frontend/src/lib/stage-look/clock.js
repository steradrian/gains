// The look's animation phase, published by StageLook each time it draws so the glass layer can
// refract the same frame of the stage. A module value, not state: nothing re-renders on a tick.
export const REST_PHASE = 0.12   // the still frame every look is designed around
let phase = REST_PHASE
const listeners = new Set()

export function publishPhase(p) {
  phase = p
  listeners.forEach(cb => cb(p))
}

export const currentPhase = () => phase

/** @returns {() => void} unsubscribe */
export function subscribePhase(cb) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}
