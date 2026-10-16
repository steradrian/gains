// The EmptyState's sizing lives in tab-kit.css, and happy-dom does not apply the cascade, so these
// read the rules: what a surface sets for itself, and what no ancestor can change.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { codeFiles } from '../scripts/ui-guards-baseline.mjs'

const src = resolve(process.cwd(), 'src')
const css = readFileSync(join(src, 'tab-kit.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].trim(), decls: m[2] }))
const decls = selector => rules.filter(r => r.selector === selector).map(r => r.decls).join(';')

describe('EmptyState sizing', () => {
  it('a chart\'s body is never larger than its title', () => {
    expect(decls('.empty[data-surface=chart]')).toMatch(/font-size:var\(--fs-footnote\)/)
    expect(decls('.empty[data-surface=chart] .empty-t')).toMatch(/font-size:var\(--fs-footnote\)/)
    expect(decls('.empty[data-surface=chart] .empty-b')).toMatch(/color:var\(--label-3\)/)
    expect(decls('.empty[data-surface=chart] .empty-b')).not.toMatch(/font-size/)
  })

  it('pins the art size on every surface, so a section\'s smaller --art-w cannot shrink it', () => {
    expect(decls('.empty[data-surface]')).toMatch(/--art-w:96px;--art-h:72px/)
    expect(decls('.empty[data-surface=page]')).toMatch(/--art-w:128px;--art-h:96px/)
    expect(decls('.empty[data-surface=chart]')).toMatch(/--art-w:64px;--art-h:48px/)
  })

  it('has a height class for every h a LineChart is given', () => {
    const used = new Set(codeFiles().flatMap(f => [...f.text.matchAll(/<LineChart\b[^>]*?\bh=\{(\d+)\}/g)].map(m => m[1])))
    expect(used.size).toBeGreaterThan(0)
    for (const h of used) expect(decls(`.chart-h-${h}`), `.chart-h-${h}`).toBe(`--chart-h:${h}`)
  })
})
