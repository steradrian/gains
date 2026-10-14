// The UI guards: a ratchet on the markup and styling the UI kit replaces (components/layout.jsx,
// blocks.jsx, sheet-layout.jsx, ui-kit.css; see components/README-ui-kit.md). Like
// page-width.test.js they read the sources. A guard fails only when a file's count rises above
// src/ui-guards.baseline.json, or a file the baseline lacks counts above 0: existing pages may
// stay as they are until migrated, new code starts clean. The baseline is tightened with
// `node scripts/ui-guards-baseline.mjs` after a migration merges, never to turn a guard green.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  BASELINE, LEGACY_CSS, PAGE_EXEMPT, cssFiles, cssHex, handBuilt, isStaticStyle, jsxHex, measure,
  newCssViolations, rises, routeViewsWithoutPage, sheetsImporters, staticStyles,
} from '../scripts/ui-guards-baseline.mjs'

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
const now = measure()

describe('UI guards (ratchet)', () => {
  it('G1: no file adds a static inline style; use Stack, Inline, Spacer, mb-N, .ink-*', () => {
    expect(rises(now.G1, baseline.G1)).toEqual([])
  })

  it('G2: no stylesheet adds a hex outside its :root theme rules', () => {
    expect(rises(now.G2css, baseline.G2css)).toEqual([])
  })

  it('G2: no JSX file adds a hex colour; use a token', () => {
    expect(rises(now.G2jsx, baseline.G2jsx)).toEqual([])
  })

  it('G3: no file adds hand-built .card/.item/.tile(s)/.empty/.lrow/.tag/.chip(s)/h4.sec markup; use the primitive', () => {
    expect(rises(now.G3, baseline.G3)).toEqual([])
  })

  it('G4: every routed view renders <Page>, other than the baselined ones and the full-screen views', () => {
    expect(now.G4.filter(name => !baseline.G4.includes(name))).toEqual([])
  })

  it('G6: nothing outside sheets.jsx and src/sheets/ imports src/sheets/* (the vi.mock facade)', () => {
    expect(sheetsImporters()).toEqual([])
  })

  it('G7: a new stylesheet holds no hex outside :root and no max-width', () => {
    const fresh = cssFiles().filter(f => !LEGACY_CSS.includes(f.file))
    expect(fresh.map(f => f.file)).toContain('ui-kit.css')
    expect(fresh.filter(f => newCssViolations(f.text) > 0).map(f => f.file)).toEqual([])
  })
})

// The measurements themselves, so a guard cannot pass by miscounting.
describe('UI guard measurements', () => {
  it('counts a style of literals and allows one with an expression or a custom property', () => {
    expect(isStaticStyle(` marginTop: 8, color: 'var(--red-ink)' `)).toBe(true)
    expect(isStaticStyle(` width: pct + '%' `)).toBe(false)
    expect(isStaticStyle(` '--tint': 'var(--blue)' `)).toBe(false)
    expect(isStaticStyle(` ...base, marginTop: 8 `)).toBe(false)
    expect(staticStyles(`<div style={{ height: 8 }} /><div style={{ width: w }} />
      {/* <div style={{ height: 2 }} /> */}<i style={on ? { opacity: .5 } : null} />`)).toBe(1)
  })

  it('counts hex outside :root theme rules and in code, not in comments', () => {
    expect(cssHex(`:root{--a:#fff} :root[data-theme="light"]{--a:#000}
      .x{color:#123456} /* #abc */ :root[data-theme="light"] .y{color:#fff}`)).toBe(2)
    expect(jsxHex(`// #fff\nconst c = '#30d158'; const s = 'https://x/#top'`)).toBe(1)
  })

  it('counts a className that starts with a primitive class, and h4.sec', () => {
    expect(handBuilt(`<div className="card"><div className={'chip' + on}><span className={\`tag \${x}\`}>
      <h4 className="sec">a</h4><div className="card-x"><div className="hub-card"><div className="items">`)).toBe(4)
  })

  it('finds the routed views and exempts the full-screen ones', () => {
    const views = routeViewsWithoutPage()
    expect(views).toContain('Workout')
    expect(PAGE_EXEMPT).toEqual(['FocusView', 'Login', 'MobileOnboarding', 'Workout'])
    expect(now.G4).not.toContain('Workout')
  })

  it('flags max-width in a new stylesheet', () => {
    expect(newCssViolations('.a{max-width:560px}')).toBe(1)
    expect(newCssViolations(':root{--x:#fff} .a{color:var(--x)}')).toBe(0)
  })
})
