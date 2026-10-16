// A sheet takes the focus itself when it opens, and happy-dom does not apply the cascade, so this
// reads the rule: a confirm sheet is role=alertdialog, and gets no ring round the whole sheet either.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const src = resolve(process.cwd(), 'src')
const css = readFileSync(join(src, 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(m => ({ selectors: m[1].split(',').map(s => s.trim()), decls: m[2] }))
const noRing = rules.find(r => r.selectors.includes('[role="dialog"][tabindex="-1"]:focus-visible'))

describe('the focus ring on a sheet that holds the focus itself', () => {
  it('is off for a dialog and for an alertdialog, in the same rule', () => {
    expect(noRing).toBeDefined()
    expect(noRing.selectors).toContain('[role="alertdialog"][tabindex="-1"]:focus-visible')
    expect(noRing.decls).toMatch(/outline:none/)
  })
})
