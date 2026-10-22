// happy-dom does not apply the cascade, so a kit class declared twice is invisible to the component
// tests. Me photos' PhotoGrid once reused PlanWeekGrid's `.g-pgrid` and its later grid rule collapsed
// the Plan week picker; both are checked here as text.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = p => readFileSync(resolve(process.cwd(), 'src', p), 'utf8')
const ds = read('ds/ds.css').replace(/\/\*[\s\S]*?\*\//g, '')

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
