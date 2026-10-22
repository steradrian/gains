// The look's animation phase, published by StageLook each time it draws so the glass layer can
// refract the same frame of the stage. A module value, not state: nothing re-renders on a tick.
export const REST_PHASE = 0.12   // the still frame every look is designed around
let phase = REST_PHASE
let phaseFrameTs = -1
const listeners = new Set()

export function publishPhase(p) {
  phase = p
  phaseFrameTs = frameTs
  listeners.forEach(cb => cb(p))
}

export const currentPhase = () => phase

/** The timestamp of the shared frame the look last drew in (compare with a frame callback's own `ts`). */
export const phaseFrame = () => phaseFrameTs

/** @returns {() => void} unsubscribe */
export function subscribePhase(cb) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

// One shared frame clock for the look and the glass: every callback asked for this frame runs inside a
// single requestAnimationFrame, in the order asked, so an animating look and a scrolling glass cost one
// rAF per frame, not one each. One-shot, like requestAnimationFrame: ask again from the callback to loop.
const queue = new Map()
let nextId = 0
let rafId = 0
let frameTs = -1 // the running frame's timestamp, or the last one's between frames

function runFrame(ts) {
  rafId = 0
  frameTs = ts
  const run = [...queue.values()]
  queue.clear()
  for (const cb of run) {
    try { cb(ts) } catch (err) { queueMicrotask(() => { throw err }) } // one failure never stops the others
  }
}

/** requestAnimationFrame on the shared clock. @returns {number} an id for cancelFrame */
export function requestFrame(cb) {
  const id = ++nextId
  queue.set(id, cb)
  if (!rafId) rafId = requestAnimationFrame(runFrame)
  return id
}

export function cancelFrame(id) {
  queue.delete(id)
  if (!queue.size && rafId) { cancelAnimationFrame(rafId); rafId = 0 }
}
