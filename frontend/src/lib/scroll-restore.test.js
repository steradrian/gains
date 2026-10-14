import { describe, expect, it } from 'vitest'
import { scrollAction } from './scroll-restore.js'

describe('the scroll on a route change', () => {
  it('a fresh load and a forward navigation start at the top', () => {
    expect(scrollAction({ first: true, samePath: false, navType: 'POP', modeSwitch: false })).toBe('top')
    expect(scrollAction({ first: false, samePath: false, navType: 'PUSH', modeSwitch: false })).toBe('top')
    expect(scrollAction({ first: false, samePath: false, navType: 'REPLACE', modeSwitch: false })).toBe('top')
  })

  it('back to a page restores where it was', () => {
    expect(scrollAction({ first: false, samePath: false, navType: 'POP', modeSwitch: false })).toBe('restore')
  })

  it('a sheet unwinding its entry leaves the page alone', () => {
    expect(scrollAction({ first: false, samePath: true, navType: 'POP', modeSwitch: false })).toBe('keep')
  })

  it('arriving in the other mode restores its page, though the router calls it a push', () => {
    expect(scrollAction({ first: false, samePath: false, navType: 'PUSH', modeSwitch: true })).toBe('restore')
    expect(scrollAction({ first: false, samePath: false, navType: 'REPLACE', modeSwitch: true })).toBe('restore')
  })
})
