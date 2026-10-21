// The pinned tab-root header and the search panel under it, as CSS (PR-07 review fixes): the header
// stays fixed through a navigation, meets the stage with no edge, follows the iOS keyboard, and the
// panel's focus rings, the bell's swap and the white chips read right on the stage.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = resolve(process.cwd(), 'src')
const read = file => readFileSync(join(src, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const index = read('index.css')
const ds = read('ds/ds.css')
const search = read('search.css')
const rules = css => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selectors: selector.split(',').map(s => s.trim()), body }))
const ruleFor = (css, sel) => rules(css).filter(r => r.selectors.includes(sel)).map(r => r.body).join(';')
const keyframes = (css, name) => {
  const at = css.indexOf('@keyframes ' + name)
  if (at < 0) return ''
  let depth = 0
  for (let i = css.indexOf('{', at); i < css.length; i++) {
    if (css[i] === '{') depth++
    if (css[i] === '}' && --depth === 0) return css.slice(at, i + 1)
  }
  return ''
}

// What makes an element the containing block of its fixed descendants.
const CONTAINS_FIXED = /(^|;|\s)(transform|filter|perspective|backdrop-filter|-webkit-backdrop-filter|contain|will-change)\s*:/

describe('the pinned header\'s ancestors', () => {
  // Today and Train: #app > .g-root.g-screen > .g-stage > .g-stage-body > .today | .train > header;
  // the older roots: #app > .g-root.root-hdr > header.
  const ANCESTORS = ['#app', '#app.vfade', '.g-root', '.g-screen', '.g-stage', '.g-stage-body', '.root-hdr', '.today']

  it('none sets a transform, a filter or anything else that would hold a fixed child', () => {
    for (const css of [index, ds, search]) {
      for (const sel of ANCESTORS) expect(ruleFor(css, sel), sel).not.toMatch(CONTAINS_FIXED)
    }
  })

  it('the view fade on #app animates opacity alone, so the header does not ride it on a navigation', () => {
    const body = ruleFor(index, '#app.vfade')
    const name = body.match(/animation:\s*([\w-]+)/)?.[1]
    expect(name).toBe('viewfade')
    const frames = keyframes(index, name)
    expect(frames).toMatch(/opacity/)
    expect(frames).not.toMatch(/transform|translate|scale/)
  })
})

describe('the header and the panel on the stage', () => {
  it('paint the stage\'s art anchored where the page\'s stage starts, not a flat fill that ends in an edge', () => {
    expect(ruleFor(ds, '.g-shdr-bg')).toMatch(/overflow:\s*hidden/)
    expect(ruleFor(ds, '.g-shdr-bg > .g-stage-art')).toMatch(/top:\s*var\(--conn/)
    expect(ruleFor(search, '.search-ov-bg>.g-stage-art')).toMatch(/top:calc\(-1 \* \(var\(--sat\) \+ var\(--shdr-h\)\)\)/)
    expect(ruleFor(search, '.search-ov')).not.toMatch(/linear-gradient/)
  })

  it('follow the visual viewport down with the iOS keyboard', () => {
    expect(ruleFor(ds, '.g-shdr-pin')).toMatch(/transform:\s*translate3d\(0, var\(--vv-top, 0px\), 0\)/)
    expect(ruleFor(search, '.search-ov')).toMatch(/transform:translate3d\(0,var\(--vv-top,0px\),0\)/)
  })

  it('the panel\'s focus rings are white, as everywhere on the stage', () => {
    expect(ruleFor(search, '.search-ov')).toMatch(/--focus:var\(--on-stage\)/)
  })

  it('the bell turns into × without the turn under either reduced motion', () => {
    expect(ruleFor(ds, ':root[data-motion="reduce"] .g-sbtn.g-bell .g-bell-b')).toMatch(/transform:\s*none/)
    expect(ruleFor(ds, ':root[data-motion="reduce"] .g-sbtn.g-bell-close .g-bell-a')).toMatch(/transform:\s*none/)
    expect(ruleFor(ds, ':root[data-motion="reduce"] .g-sbtn.g-bell > span')).toMatch(/transition:\s*none/)
    const media = ds.slice(ds.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(ruleFor(media, '.g-sbtn.g-bell-close .g-bell-a')).toMatch(/transform:\s*none/)
  })

  it('the search\'s white chips and its white button share one text token', () => {
    const colour = sel => ruleFor(ds, sel).match(/(?:^|;)\s*color:\s*([^;]+)/)?.[1].trim()
    const tokens = new Set(['.g-ssf-scope', '.g-rchip.on', '.g-sfeat-on'].map(colour))
    expect([...tokens]).toEqual(['var(--accent-stage-end)'])
  })
})
