// happy-dom does not apply the cascade, so a kit class declared twice is invisible to the component
// tests. Me photos' PhotoGrid once reused PlanWeekGrid's `.g-pgrid` and its later grid rule collapsed
// the Plan week picker; both are checked here as text.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = p => readFileSync(resolve(process.cwd(), 'src', p), 'utf8')
const ds = read('ds/ds.css').replace(/\/\*[\s\S]*?\*\//g, '')

// Every stylesheet in src, as { path, css } with comments gone.
const sheets = () => {
  const out = []
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (name.endsWith('.css')) out.push({ path, css: readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') })
    }
  }
  walk(resolve(process.cwd(), 'src'))
  return out
}

describe('class collisions across stylesheets', () => {
  // My goal's `.mg` was also the macro gauge's (tab-kit.css), whose align-items: center shrink-wrapped
  // every card on the page. A bare class rule belongs to one file. These are the ones that already
  // share a name on purpose: the coach and onboarding share one layout, and the tokens file and the
  // kit both set up `.g-root`; the sheet's glass is index.css's.
  const SHARED = new Set(['.ob', '.ob-body', '.ob-sub', '.ob-chips', '.ob-foot', '.g-root', '.sheet'])
  it('no new bare class is styled in two files', () => {
    const where = new Map()
    for (const { path, css } of sheets()) {
      for (const [, sel] of css.matchAll(/^(\.[\w-]+)\s*\{/gm)) where.set(sel, new Set([...(where.get(sel) ?? []), path]))
    }
    expect([...where].filter(([sel, files]) => files.size > 1 && !SHARED.has(sel)).map(([sel]) => sel)).toEqual([])
  })
})

describe('kit class collisions', () => {
  it('no bare component class sets a grid track list in two rules', () => {
    const seen = new Map()
    for (const [, sel, body] of ds.matchAll(/^(\.g-[\w-]+) \{([^}]*)\}/gm)) {
      if (!/grid-template-columns/.test(body)) continue
      seen.set(sel, (seen.get(sel) ?? 0) + 1)
    }
    expect([...seen].filter(([, n]) => n > 1).map(([s]) => s)).toEqual([])
  })

  it('the week picker and the photo grid are different classes with the right layouts', () => {
    expect(read('ds/PhotoGrid.jsx')).toContain('className="g-phgrid"')
    expect(read('ds/PlanWeekGrid.jsx')).toContain('className="g-pgrid g-glass"')
    expect(ds).toMatch(/^\.g-pgrid-grid \{[^}]*repeat\(7, minmax\(0, 1fr\)\)/m)
    expect(ds).not.toMatch(/^\.g-pgrid \{[^}]*grid-template-columns/m)
  })
})
