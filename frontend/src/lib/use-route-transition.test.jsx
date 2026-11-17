// @vitest-environment happy-dom
// The layers a page change renders: the page left beside the page arriving for the length of a
// slide, one layer at rest, and which way and in what style the slide goes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { useView } from '../ds/render.test-util.js'
import { FADE_MS, SLIDE_MS } from './route-transition.js'
import { useRouteTransition } from './use-route-transition.js'

const view = useView()
const out = { current: null }
function Probe(props) {
  out.current = useRouteTransition(props)
  return null
}

const page = (pathname, state) => ({ pathname, search: '', hash: '', state, key: pathname })
const base = { enabled: true, reduced: false, leavingY: () => 0, arrivingY: () => 0 }
const show = (pathname, navType, extra = {}) => view.render(
  <Probe {...base} location={page(pathname, extra.state)} navType={navType} routeKey={extra.routeKey ?? pathname} {...extra.props} />,
)
const roles = () => out.current.layers.map(l => l.role + ':' + l.route)

beforeEach(() => {
  vi.useFakeTimers()
  history.replaceState(null, '')
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useRouteTransition', () => {
  it('is one layer at rest, and the first page does not slide', () => {
    show('/train', 'POP')
    expect(roles()).toEqual(['in:/train'])
    expect(out.current.active).toBe(false)
    expect(out.current.layers[0].fade).toBe(true)
  })

  it('a push keeps the page left beside the page arriving, which slides in without also fading', () => {
    show('/train', 'POP')
    show('/train/history', 'PUSH', { props: { leavingY: () => 340 } })
    expect(roles()).toEqual(['out:/train', 'in:/train/history'])
    expect(out.current.active).toBe(true)
    expect(out.current.layers.map(l => l.style)).toEqual(['push', 'push'])
    // the page left stays scrolled where it was; the page arriving starts at the top
    expect(out.current.layers.map(l => l.y)).toEqual([340, 0])
    expect(out.current.layers[1].fade).toBe(false)
    expect(out.current.layers[0].location.pathname).toBe('/train')
  })

  it('lets the page left go when the slide is over, whichever of the animation end or the timer comes first', () => {
    show('/train', 'POP')
    show('/train/history', 'PUSH')
    act(() => { vi.advanceTimersByTime(SLIDE_MS - 1) })
    expect(roles()).toHaveLength(2)
    act(() => { vi.advanceTimersByTime(200) })
    expect(roles()).toEqual(['in:/train/history'])
    expect(out.current.active).toBe(false)

    show('/train/exercises', 'PUSH')
    expect(roles()).toHaveLength(2)
    act(() => out.current.settle())
    expect(roles()).toEqual(['in:/train/exercises'])
  })

  it('a pop slides back: the page left goes out, the page returned to is drawn where it was left', () => {
    show('/train', 'POP')
    show('/train/history', 'PUSH')
    act(() => { vi.advanceTimersByTime(SLIDE_MS + 200) })
    show('/train', 'POP', { props: { leavingY: () => 120, arrivingY: () => 560 } })
    expect(out.current.layers.map(l => l.style)).toEqual(['pop', 'pop'])
    expect(roles()).toEqual(['out:/train/history', 'in:/train'])
    expect(out.current.layers.map(l => l.y)).toEqual([120, 560])
    // it is not the page's first mount: no fade-in on top of the slide
    expect(out.current.layers[1].fade).toBe(false)
  })

  it('does not slide between root tabs, nor on a tab switch the bar built', () => {
    show('/home', 'POP')
    show('/train', 'PUSH')
    expect(roles()).toEqual(['in:/train'])
    expect(out.current.layers[0].fade).toBe(true)
    show('/food/foods', 'PUSH', { state: { tabSwitch: true } })
    expect(roles()).toEqual(['in:/food/foods'])
  })

  it('does not slide on a replace or a redirect', () => {
    show('/train', 'POP')
    show('/train/history', 'REPLACE')
    expect(roles()).toEqual(['in:/train/history'])
    expect(out.current.active).toBe(false)
  })

  it('does not slide for a drawer: the page stays, whatever the history does', () => {
    show('/train', 'POP')
    // a sheet pushes an entry and closes by walking back: the pathname never changes
    show('/train', 'POP')
    expect(roles()).toEqual(['in:/train'])
    // and an entry that is a sheet's, reached by a pop onto another page
    history.replaceState({ gainsSheet: true }, '')
    show('/train/history', 'POP')
    expect(roles()).toEqual(['in:/train/history'])
  })

  it('does not slide when only the query changes', () => {
    show('/train', 'POP')
    view.render(<Probe {...base} location={{ ...page('/train'), search: '?x=1', key: 'k2' }} navType="PUSH" routeKey="/train" />)
    expect(roles()).toEqual(['in:/train'])
  })

  it('reduced motion cross-fades instead: no transform style, and a shorter wait', () => {
    show('/train', 'POP')
    show('/train/history', 'PUSH', { props: { reduced: true } })
    expect(out.current.layers.map(l => l.style)).toEqual(['fade', 'fade'])
    act(() => { vi.advanceTimersByTime(FADE_MS + 100) })
    expect(roles()).toEqual(['in:/train/history'])
  })

  it('leaves the screens with an entrance of their own alone', () => {
    show('/train', 'POP')
    show('/train/history', 'PUSH', { props: { enabled: false } })
    expect(roles()).toEqual(['in:/train/history'])
    // and does not slide out of one either
    show('/train/exercises', 'PUSH')
    expect(roles()).toEqual(['in:/train/exercises'])
  })

  it('a second navigation during a slide drops the first page left and starts again', () => {
    show('/train', 'POP')
    show('/train/history', 'PUSH')
    show('/train/exercises', 'PUSH')
    expect(roles()).toEqual(['out:/train/history', 'in:/train/exercises'])
  })

  it('every navigation mounts its page afresh, even back onto the page still leaving', () => {
    show('/progress', 'POP')
    show('/progress/body', 'PUSH')
    const left = out.current.layers[0].key
    show('/progress', 'POP')
    expect(roles()).toEqual(['out:/progress/body', 'in:/progress'])
    expect(out.current.layers[1].key).not.toBe(left)
  })

  it('an iOS edge swipe back is not slid again over its own slide', () => {
    show('/train', 'POP')
    show('/train/history', 'PUSH')
    act(() => { vi.advanceTimersByTime(SLIDE_MS + 200) })
    const touch = (type, clientX) => window.dispatchEvent(Object.assign(new Event(type), { touches: [{ clientX }] }))
    touch('touchstart', 4)
    touch('touchmove', 120)
    show('/train', 'POP')
    expect(roles()).toEqual(['in:/train'])
  })
})
