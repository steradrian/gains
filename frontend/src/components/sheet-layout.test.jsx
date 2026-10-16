// @vitest-environment happy-dom
// G5, markup equivalence: the sheet header and footer render exactly what the sheets build by
// hand today (sheets.jsx BwSheet), with each static inline style swapped for the ui-kit.css class
// of the same px (marginBottom: 14 → mb-7, height: 8 → sp-4) and nothing else changed.
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import { SheetHeader, SheetActions } from './sheet-layout.jsx'

const html = el => renderToStaticMarkup(el)
const same = (primitive, legacy) => expect(html(primitive)).toBe(html(legacy))
const close = () => {}

describe('SheetHeader', () => {
  it('is the bare h3', () => {
    same(<SheetHeader title="Log body weight" />, <h3>Log body weight</h3>)
  })

  it('puts the muted line under it (the weigh-in history)', () => {
    same(<SheetHeader title="Weigh-ins" sub="12 weigh-ins" />,
      <><h3 className="mb-1">Weigh-ins</h3><div className="muted small mb-5" data-sheet-sub="">12 weigh-ins</div></>)
  })

  it('shares a row with the close button (the check-in weigh-in)', () => {
    same(<SheetHeader title="Quick check-in" onClose={close} />,
      <div className="row between mb-7">
        <h3 className="m-0">Quick check-in</h3>
        <button className="iconbtn" aria-label={t('Cancel')} onClick={close}><Icon name="xmark" /></button>
      </div>)
  })

  it('shares a row with an action', () => {
    same(<SheetHeader title="Meals" action={<button className="btn tinted sm">Edit</button>} />,
      <div className="row between mb-7"><h3 className="m-0">Meals</h3><button className="btn tinted sm">Edit</button></div>)
  })

  it('groups the action and the close button, with the muted line under the row', () => {
    same(<SheetHeader title="Meals" sub="Today" onClose={close} action={<button className="btn tinted sm">Edit</button>} />,
      <><div className="row between mb-1"><h3 className="m-0">Meals</h3>
        <div className="row g-4"><button className="btn tinted sm">Edit</button>
          <button className="iconbtn" aria-label={t('Cancel')} onClick={close}><Icon name="xmark" /></button></div></div>
        <div className="muted small mb-5" data-sheet-sub="">Today</div></>)
  })
})

describe('SheetActions', () => {
  it('is the 14px spacer and the button', () => {
    same(<SheetActions><Button variant="primary">Save</Button></SheetActions>,
      <><div className="sp-7" /><Button variant="primary">Save</Button></>)
  })

  it('puts the gap between buttons and skips the ones not shown', () => {
    const required = false
    same(<SheetActions>
      <Button variant="primary">Save</Button>
      {required && <Button>Hidden</Button>}
      <Button variant="ghost" className="dim">Start without weighing in</Button>
    </SheetActions>,
    <><div className="sp-7" /><Button variant="primary">Save</Button>
      <div className="sp-4" /><Button variant="ghost" className="dim">Start without weighing in</Button></>)
  })

  it('takes another gap step', () => {
    same(<SheetActions gap={1}><Button>A</Button><Button>B</Button></SheetActions>,
      <><div className="sp-7" /><Button>A</Button><div className="sp-1" /><Button>B</Button></>)
  })

  it('throws in development on a gap off the scale', () => {
    expect(() => html(<SheetActions gap={20}><Button>A</Button></SheetActions>)).toThrow(/SheetActions: gap=20/)
  })

  it('sticky pins the buttons in a footer of their own, the 14px above them now its padding', () => {
    same(<SheetActions sticky><Button variant="primary">Nice!</Button><Button>More</Button></SheetActions>,
      <div className="sheet-foot"><Button variant="primary">Nice!</Button><div className="sp-4" /><Button>More</Button></div>)
  })
})

// A control Tab reaches below the fold must not end up under the pinned footer (WCAG 2.4.11): the
// footer tells its sheet how tall it is, and the sheet's scroll-padding (ui-kit.css) clears that.
describe('SheetActions sticky, the height it reports to its sheet', () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  let observers
  const mount = async content => {
    const host = document.createElement('div')
    host.className = 'sheet'
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => { root.render(content) })
    return { host, root }
  }
  const stubHeight = px => vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return { height: this.classList.contains('sheet-foot') ? px : 0, width: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0 }
  })
  const stubObserver = () => {
    observers = []
    vi.stubGlobal('ResizeObserver', class {
      constructor(fn) { this.fn = fn; this.disconnected = false; observers.push(this) }
      observe() {}
      disconnect() { this.disconnected = true }
    })
  }

  it('sets --foot-h on the sheet from the footer\'s own height, and follows it when it grows', async () => {
    const spy = stubHeight(95.2)
    stubObserver()
    const { host, root } = await mount(<SheetActions sticky><Button>Nice!</Button></SheetActions>)
    expect(host.style.getPropertyValue('--foot-h')).toBe('96px')
    spy.mockRestore(); stubHeight(120)
    await act(async () => { observers[0].fn() })
    expect(host.style.getPropertyValue('--foot-h')).toBe('120px')
    await act(async () => { root.unmount() }); host.remove()
    vi.restoreAllMocks(); vi.unstubAllGlobals()
  })

  it('takes it off the sheet, and stops watching, when the footer goes', async () => {
    stubHeight(90)
    stubObserver()
    const { host, root } = await mount(<SheetActions sticky><Button>Nice!</Button></SheetActions>)
    expect(host.style.getPropertyValue('--foot-h')).toBe('90px')
    await act(async () => { root.render(<p>gone</p>) })
    expect(host.style.getPropertyValue('--foot-h')).toBe('')
    expect(observers[0].disconnected).toBe(true)
    await act(async () => { root.unmount() }); host.remove()
    vi.restoreAllMocks(); vi.unstubAllGlobals()
  })

  it('does nothing for a footer that is not sticky', async () => {
    stubHeight(90)
    const { host, root } = await mount(<SheetActions><Button>Save</Button></SheetActions>)
    expect(host.style.getPropertyValue('--foot-h')).toBe('')
    await act(async () => { root.unmount() }); host.remove()
    vi.restoreAllMocks()
  })
})

// happy-dom applies no cascade, so the layout rules are read from the sheet itself.
describe('the sticky footer\'s rules', () => {
  const css = file => readFileSync(join(process.cwd(), 'src', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const decls = (text, selector) => [...text.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].filter(m => m[1].trim() === selector).map(m => m[2]).join(';')
  const kit = css('ui-kit.css'), index = css('index.css')

  it('rests on the sheet\'s edge: the sheet gives up its bottom padding and the footer carries it', () => {
    const foot = decls(kit, '.sheet > .sheet-foot')
    expect(foot).toMatch(/position:sticky;bottom:0[;}]?/)
    expect(foot).not.toMatch(/bottom:\s*-|bottom:calc\(-/)
    expect(foot).toMatch(/padding:var\(--space-7\) var\(--sheet-gutter\) calc\(20px \+ var\(--sab\)\)/)
    expect(decls(kit, '.sheet:has(> .sheet-foot)')).toMatch(/padding-bottom:0/)
    expect(decls(kit, ':root[data-native-kb] .sheet:has(> .sheet-foot)')).toMatch(/padding-bottom:0/)
  })

  it('spans the sheet\'s own gutter, which is one custom property in both places', () => {
    expect(decls(index, '.sheet')).toMatch(/--sheet-gutter:18px;\s*padding:8px var\(--sheet-gutter\)/)
    expect(decls(kit, '.sheet > .sheet-foot')).toMatch(/margin-inline:calc\(-1 \* var\(--sheet-gutter\)\)/)
  })

  it('scrolls a focused control clear of the footer\'s height, with the Android keyboard up too', () => {
    for (const selector of ['.sheet:has(> .sheet-foot)', ':root[data-native-kb] .sheet:has(> .sheet-foot)']) {
      expect(decls(kit, selector), selector).toMatch(/scroll-padding-bottom:calc\(var\(--foot-h,84px\) \+ 8px\)/)
    }
  })
})
