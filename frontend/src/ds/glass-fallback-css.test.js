// happy-dom does not apply the cascade, so these read the liquid-glass fallback rules in ds.css and
// views/workout/summary.css (docs/audits/gains-glass-review.md findings 1, 2, 7 and 9).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = p => readFileSync(resolve(process.cwd(), 'src', p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const ds = read('ds/ds.css')
const summary = read('views/workout/summary.css')

describe('glass fallback CSS', () => {
  it('hides the chrome strip unless the host is live, and under the search overlay', () => {
    expect(ds).toMatch(/html:not\(\[data-lg="gl"\], \[data-lg-fade\]\) \.gl-layer-over,\s*body\.search-open \.gl-layer-over\s*\{\s*display:\s*none/)
  })

  it('draws the two glass focus rings as outlines, which a sprite cannot cover', () => {
    expect(ds).toMatch(/\.g-spill-field:focus-within\s*\{\s*outline:\s*2px solid/)
    expect(summary).toMatch(/\.g-sum-note:focus-within\s*\{\s*outline:\s*2px solid/)
    expect(ds).not.toMatch(/\.g-spill-field:focus-within\s*\{\s*box-shadow/)
    expect(summary).not.toMatch(/\.g-sum-note:focus-within\s*\{\s*box-shadow/)
  })

  it('reduces transparency without a GlassHost: the app switch and the OS query', () => {
    expect(ds).toMatch(/html\[data-transparency="reduce"\] :is\(\.g-glass, \.g-btn-glass\)/)
    expect(ds).toMatch(/@media \(prefers-reduced-transparency: reduce\)\s*\{\s*html :is\(\.g-glass, \.g-btn-glass\)/)
  })
})
