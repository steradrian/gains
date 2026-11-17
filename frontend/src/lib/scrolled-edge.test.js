// @vitest-environment happy-dom
// <html data-scrolled> follows the page's scroll position (ds.css "Liquid glass: content layer").
import { afterEach, describe, expect, it } from 'vitest'
import { installScrolledEdge, pageScrollTop, setScrolled } from './scrolled-edge.js'

let stop = () => {}
const html = () => document.documentElement
const scrollTo = y => {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  window.dispatchEvent(new Event('scroll'))
}

afterEach(() => {
  stop()
  scrollTo(0)
  document.body.removeAttribute('style')
})

describe('page scroll edge', () => {
  it('is off at rest and on once scrolled past the top', () => {
    stop = installScrolledEdge()
    expect(html().hasAttribute('data-scrolled')).toBe(false)
    scrollTo(1)
    expect(html().hasAttribute('data-scrolled')).toBe(true)
    scrollTo(0)
    expect(html().hasAttribute('data-scrolled')).toBe(false)
  })

  it('starts on when the page is already scrolled at install', () => {
    scrollTo(40)
    stop = installScrolledEdge()
    expect(html().hasAttribute('data-scrolled')).toBe(true)
  })

  it('reads a sheet-pinned body (position fixed, top -y) as still scrolled', () => {
    document.body.style.position = 'fixed'
    document.body.style.top = '-120px'
    scrollTo(0)
    expect(pageScrollTop()).toBe(120)
    stop = installScrolledEdge()
    expect(html().hasAttribute('data-scrolled')).toBe(true)
  })

  it('writes the attribute only when the answer changes', () => {
    stop = installScrolledEdge()
    let writes = 0
    const obs = new MutationObserver(r => { writes += r.length })
    obs.observe(html(), { attributes: true, attributeFilter: ['data-scrolled'] })
    scrollTo(5); scrollTo(9); scrollTo(300)
    return Promise.resolve().then(() => {
      expect(writes).toBe(1)
      obs.disconnect()
    })
  })

  it('removes the attribute on cleanup', () => {
    stop = installScrolledEdge()
    scrollTo(10)
    stop()
    expect(html().hasAttribute('data-scrolled')).toBe(false)
  })

  it('setScrolled toggles any scroller, such as the search panel', () => {
    const el = document.createElement('div')
    setScrolled(el, true)
    expect(el.hasAttribute('data-scrolled')).toBe(true)
    setScrolled(el, false)
    expect(el.hasAttribute('data-scrolled')).toBe(false)
  })
})
