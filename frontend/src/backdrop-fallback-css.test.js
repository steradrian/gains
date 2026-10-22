// Where backdrop-filter is unsupported, a glass surface goes opaque through an
// `@supports not (backdrop-filter…)` block. Such a fallback has the specificity of the rule it
// overrides, so it only wins when it comes after that rule; one written before it is dead CSS (the
// rest timer's and the toast's were, in one shared block near the top of index.css). happy-dom does
// not apply the cascade, so this reads the files.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const src = resolve(process.cwd(), 'src')
// The design system's glass (ds/ds.css) has fallbacks too, so it is read alongside the app's sheets.
const files = [
  ...readdirSync(src).filter(f => f.endsWith('.css')),
  ...readdirSync(join(src, 'ds')).filter(f => f.endsWith('.css')).map(f => join('ds', f)),
]
const NO_GLASS = /^@supports\s+not\s*\(\s*\(\s*backdrop-filter/

// Every style rule in `css`, with where it opens and the at-rules it sits in.
function rulesOf(css) {
  const rules = []
  const stack = []
  let start = 0
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') {
      stack.push({ prelude: css.slice(start, i).trim(), at: i })
      start = i + 1
    } else if (css[i] === '}') {
      const block = stack.pop()
      if (block && !block.prelude.startsWith('@')) {
        rules.push({ selectors: block.prelude.split(',').map(s => s.trim()), body: css.slice(block.at + 1, i), at: block.at, parents: stack.map(b => b.prelude) })
      }
      start = i + 1
    } else if (css[i] === ';' && !stack.length) start = i + 1
  }
  return rules
}
const setsBackground = rule => /(^|;)\s*background(-color)?\s*:/.test(rule.body)

describe('opaque fallbacks for glass surfaces', () => {
  it('come after the rule they override', () => {
    let checked = 0
    for (const file of files) {
      const rules = rulesOf(readFileSync(join(src, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''))
      for (const fallback of rules.filter(r => r.parents.some(p => NO_GLASS.test(p)) && setsBackground(r))) {
        for (const selector of fallback.selectors) {
          const bases = rules.filter(r => !r.parents.length && setsBackground(r) && r.selectors.includes(selector))
          for (const base of bases) expect(base.at, `${file}: ${selector}`).toBeLessThan(fallback.at)
          checked++
        }
      }
    }
    // A floor so the scan cannot go blind; the old workout's fallback went with its stylesheet, and the unused sticky SubHeader's with its rule.
    expect(checked).toBeGreaterThan(2)
  })
})
