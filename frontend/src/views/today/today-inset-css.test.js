// The installed iOS app put Today's header a whole status bar too low: StageScreen's body pads by
// the top inset (--sat) and .today padded by it again. In Safari the inset is 0, so it only showed
// once installed. happy-dom does not apply the cascade, so this reads the rules on the way from
// #app down to the stage header and holds the inset to exactly one of them.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const src = resolve(process.cwd(), 'src')
const rulesOf = file => {
  const css = readFileSync(join(src, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  return [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].flatMap(m =>
    m[1].split(',').map(s => ({ file, selector: s.trim().replace(/\s+/g, ' '), decls: m[2] })))
}
const rules = ['index.css', 'tab-shell.css', 'ui-kit.css', 'ds/ds.css', 'views/today/today.css'].flatMap(rulesOf)
const TOP_INSET = /var\(--sat\b|safe-area-inset-top/
const insets = decls => decls.match(new RegExp(TOP_INSET.source, 'g')) || []
// Every box between the window's top and Today's header (TodayScreen.jsx in ds/StageScreen.jsx).
const CHAIN = [
  ':root #app:has(> .g-root.g-screen)',
  '.g-root', '.g-screen', '.g-screen > .g-stage', '.g-stage', '.g-stage-body', '.g-screen > .g-stage > .g-stage-body',
  '#app > .g-screen > .g-stage > .g-stage-body', '.today', '.g-shdr',
]

describe('the stage\'s top inset', () => {
  it('a stage screen takes #app\'s inset padding off, so the stage paints under the status bar', () => {
    const app = rules.filter(r => r.selector === ':root #app:has(> .g-root.g-screen)')
    expect(app.length).toBeGreaterThan(0)
    for (const r of app) expect(r.decls).not.toMatch(TOP_INSET)
  })

  it('is added exactly once between #app and the stage header, by StageScreen\'s body', () => {
    const hits = rules.filter(r => CHAIN.includes(r.selector)).flatMap(r => insets(r.decls).map(() => r.selector))
    expect(hits).toEqual(['.g-screen > .g-stage > .g-stage-body'])
  })

  it.each(['views/today/today.css', 'views/train/train.css'])('%s adds no top inset of its own', file => {
    for (const r of rulesOf(file)) expect(r.decls, r.selector).not.toMatch(TOP_INSET)
  })
})
