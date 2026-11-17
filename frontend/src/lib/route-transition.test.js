import { describe, expect, it } from 'vitest'
import { transitionKind } from './route-transition.js'
import { routeDepth, WORKOUT_DEPTH } from './tab-route.js'

const at = (pathname, state) => ({ pathname, state })
const kind = (from, to, navType, extra = {}) => transitionKind({ from: at(from), to: typeof to === 'string' ? at(to) : to, navType, ...extra })

describe('routeDepth', () => {
  it('counts the pages above a page up to its tab root, the way Back walks them', () => {
    expect(routeDepth('/home')).toBe(1)
    expect(routeDepth('/me')).toBe(1)
    expect(routeDepth('/train/history')).toBe(2)
    expect(routeDepth('/train/routines/abc')).toBe(3)
    // a Day or Week page has nothing above it but its tab's root
    expect(routeDepth('/food/day/2026-10-05')).toBe(2)
    expect(routeDepth('/home/week/2026-W41')).toBe(2)
    // Progress is Me's child, Body its child
    expect(routeDepth('/progress')).toBe(2)
    expect(routeDepth('/progress/body')).toBe(3)
    expect(routeDepth('/progress/body/measurements')).toBe(3)
  })

  it('puts the workout, which opens over any tab, deeper than everything, and unowned paths at 0', () => {
    expect(routeDepth('/train/workout')).toBe(WORKOUT_DEPTH)
    expect(routeDepth('/nowhere')).toBe(0)
  })
})

describe('transitionKind', () => {
  it('a push onto a deeper page slides forward', () => {
    expect(kind('/train', '/train/history', 'PUSH')).toBe('push')
    expect(kind('/home', '/home/notifications', 'PUSH')).toBe('push')
    expect(kind('/me', '/progress', 'PUSH')).toBe('push')
  })

  it('a pop onto a shallower page slides back', () => {
    expect(kind('/train/history', '/train', 'POP')).toBe('pop')
    expect(kind('/progress/body', '/progress', 'POP')).toBe('pop')
    expect(kind('/food/day/2026-10-05', '/food', 'POP')).toBe('pop')
  })

  it('a pop out of the workout is Back whatever page it was opened from', () => {
    expect(kind('/train/workout', '/progress/body', 'POP')).toBe('pop')
    expect(kind('/train/workout', '/home', 'POP')).toBe('pop')
    expect(kind('/home', '/train/workout', 'PUSH')).toBe('push')
  })

  it('a pop onto a deeper page (the browser\'s forward button) reads as forward', () => {
    expect(kind('/train', '/train/history', 'POP')).toBe('push')
  })

  it('a pop onto a page as deep as the one left is still Back', () => {
    expect(kind('/train/exercises', '/train/history', 'POP')).toBe('pop')
  })

  it('switching root tabs does not slide', () => {
    expect(kind('/home', '/train', 'PUSH')).toBe('none')
    expect(kind('/train', '/food', 'POP')).toBe('none')
    // the tab bar's switch builds the arriving tab's stack and flags the entries
    expect(kind('/home', at('/train/history', { tabSwitch: true }), 'PUSH')).toBe('none')
    // landing on a page of another tab by whatever route is a switch too
    expect(kind('/train/history', '/me/appearance', 'PUSH')).toBe('none')
  })

  it('replace navigations and redirects do not animate', () => {
    expect(kind('/train', '/train/history', 'REPLACE')).toBe('none')
    expect(kind('/train/history', '/train', 'REPLACE')).toBe('none')
  })

  it('a drawer opening or closing does not animate: the sheet entry, or the same pathname again', () => {
    expect(kind('/train', '/train', 'POP')).toBe('none')
    expect(kind('/train', '/train', 'PUSH')).toBe('none')
    // a drawer's history entry under another page (a leaked one) is not a page change either
    expect(kind('/train', '/train/history', 'POP', { sheetEntry: true })).toBe('none')
  })

  // Me root M2: the avatar opens Profile as a push over the tab it is on.
  it('a cross-tab entry carrying pushed slides in, even as the tab machinery\'s replace', () => {
    const pushed = { pushed: true, from: '/home' }
    expect(kind('/home', at('/me', pushed), 'PUSH')).toBe('push')
    expect(kind('/home', at('/me', { tabSwitch: true, ...pushed }), 'REPLACE')).toBe('push')
  })

  it('Back off a pushed entry slides away to the tab it came from', () => {
    const from = at('/me', { pushed: true, from: '/train' })
    expect(transitionKind({ from, to: at('/train'), navType: 'POP' })).toBe('pop')
    expect(transitionKind({ from, to: at('/train'), navType: 'REPLACE' })).toBe('pop')
  })

  it('a plain tab switch stays still, also off a pushed entry', () => {
    expect(kind('/home', at('/me', { tabSwitch: true }), 'REPLACE')).toBe('none')
    const from = at('/me', { pushed: true, from: '/home' })
    expect(transitionKind({ from, to: at('/food', { tabSwitch: true }), navType: 'REPLACE' })).toBe('none')
  })

  it('a page pushed within the tab from a pushed Profile is an ordinary push', () => {
    expect(transitionKind({ from: at('/me', { pushed: true }), to: at('/me/settings'), navType: 'PUSH' })).toBe('push')
  })

  it('has nothing to move from on the first page', () => {
    expect(transitionKind({ from: null, to: at('/home'), navType: 'POP' })).toBe('none')
  })
})
