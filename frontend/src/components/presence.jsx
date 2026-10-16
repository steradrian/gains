import { Children, Component, createContext, isValidElement, useCallback, useContext, useLayoutEffect, useMemo, useReducer, useRef } from 'react'
import { hold, motionStep, play } from '../lib/motion.js'

// The kit's enter and exit (fitness-eval spec-motion-enter-exit.md §4). Anything that appears or
// goes away animates through here, never with a bare mount or a CSS keyframe of its own.
//
// <Presence> keeps a child its parent has taken out: it renders it again from its last element,
// with `present: false`, until the child says its way out is over (`safeToRemove`). The logical
// state changes at once (the store no longer has the sheet, the toast has no message); only the
// DOM node outlives it, by its exit. A key that comes back while it is still leaving is present
// again, and its exit plays back the way it came.
//
// useEnterExit is what a child calls to do that with the Web Animations API (lib/motion.js), which
// the CSS rule that stops every animation under reduced motion does not reach: the presets carry
// their own reduced version, chosen when each animation starts. Where nothing can animate
// (happy-dom, an old engine), a leaving child is let go inside the same commit, so anything that
// expected an immediate unmount still gets one.

const PresenceContext = createContext(null)
const ALWAYS = { present: true, safeToRemove: () => {} }

/** `present` is false from the first render after the child was taken out until it calls
 *  `safeToRemove`. Outside a Presence a component is always present. */
export function usePresence() {
  return useContext(PresenceContext) || ALWAYS
}

/** What a leaving element carries from its first leaving render: out of reach of a finger, the
 *  keyboard and a screen reader while it plays out (`[data-leaving]` lets taps through to the page). */
export const leavingProps = present => (present ? {} : { inert: true, 'aria-hidden': true, 'data-leaving': '' })

export function Presence({ children, onExitComplete }) {
  const [, rerender] = useReducer(n => n + 1, 0)
  // What was rendered last, in order, and the children on their way out with the element each
  // last rendered. Worked out the same way however often React renders, so a second render pass
  // (StrictMode) lands where the first did.
  const shown = useRef([])
  const leaving = useRef(new Map())
  const done = useRef(onExitComplete)
  useLayoutEffect(() => { done.current = onExitComplete })

  const now = Children.toArray(children).filter(isValidElement)
  const keys = new Set(now.map(child => child.key))
  for (const key of [...leaving.current.keys()]) if (keys.has(key)) leaving.current.delete(key)
  for (const was of shown.current) if (!was.leaving && !keys.has(was.key)) leaving.current.set(was.key, was.element)
  // A leaving child keeps its place: after whatever came before it last time.
  const list = now.map(element => ({ key: element.key, element, leaving: false }))
  let at = -1
  for (const was of shown.current) {
    const i = list.findIndex(item => item.key === was.key)
    if (i >= 0) at = i
    else if (leaving.current.has(was.key)) list.splice(++at, 0, { key: was.key, element: leaving.current.get(was.key), leaving: true })
  }
  shown.current = list

  const safeToRemove = useCallback(key => {
    if (!leaving.current.delete(key)) return
    rerender()
    if (!leaving.current.size) done.current?.()
  }, [])

  return list.map(item => <Layer key={item.key} id={item.key} present={!item.leaving} done={safeToRemove}>{item.element}</Layer>)
}

function Layer({ id, present, done, children }) {
  const value = useMemo(() => ({ present, safeToRemove: () => done(id) }), [present, id, done])
  return <PresenceContext.Provider value={value}><DropOnError>{children}</DropOnError></PresenceContext.Provider>
}

// A leaving child renders against state that may already be gone: the sheet whose Delete button
// closed it re-renders once the item it showed has been deleted. That must not take the app down
// with it; the child is dropped on the spot instead. A child that is still present and fails is
// not this boundary's business, and the error goes on up.
class DropOnError extends Component {
  static contextType = PresenceContext
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch() { if (!this.context.present) this.context.safeToRemove() }
  render() {
    if (!this.state.error) return this.props.children
    if (this.context.present) throw this.state.error
    return null
  }
}

/**
 * Plays a component's way in when it mounts and its way out when its Presence lets it go, then
 * tells the Presence it may go. `layers(phase)` names what moves for 'enter' or 'exit', read when
 * the phase starts: a list of [element, preset] (lib/motion.js PRESETS). An empty list, or nothing
 * that can animate, lets it go at once.
 *
 * The way out starts from where the element is: a way in still running is stopped on its current
 * frame first. A safety timer at the exit's length plus 100ms lets it go even if the animation
 * never reports back (a throttled tab, a hidden ancestor).
 */
export function useEnterExit(layers) {
  const { present, safeToRemove } = usePresence()
  const read = useRef(layers)
  useLayoutEffect(() => { read.current = layers })
  const anims = useRef([])
  const out = useRef(null)
  const run = phase => {
    const moves = read.current(phase).filter(([el]) => el)
    anims.current = moves.map(([el, preset]) => play(el, preset, phase)).filter(Boolean)
    return Math.max(0, ...moves.map(([, preset]) => motionStep(preset, phase)?.ms || 0))
  }

  useLayoutEffect(() => { run('enter') }, [])
  useLayoutEffect(() => {
    if (present) {
      // Back while still leaving: the exit plays back to where it started.
      const was = out.current
      if (!was) return
      out.current = null
      clearTimeout(was.timer)
      for (const anim of anims.current) anim.reverse?.()
      return
    }
    for (const anim of anims.current) hold(anim)
    const ms = run('exit')
    if (!anims.current.length) { safeToRemove(); return }
    const token = { timer: 0 }
    out.current = token
    const end = () => {
      if (out.current !== token) return
      out.current = null
      clearTimeout(token.timer)
      safeToRemove()
    }
    token.timer = setTimeout(end, ms + 100)
    Promise.all(anims.current.map(anim => anim.finished)).then(end, () => {})
  }, [present])
  useLayoutEffect(() => () => clearTimeout(out.current?.timer), [])
}
