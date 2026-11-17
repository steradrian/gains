// The installed iOS app put Today's header a whole status bar too low: StageScreen's body pads by
// the top inset (--sat) and .today padded by it again. In Safari the inset is 0, so it only showed
// once installed. Every tab root's header is now pinned (ds.css .g-shdr-pin, position: fixed) and
// is the one box that paints the inset; the screens add none of their own and only leave the
// header's row (--shdr-h) free. happy-dom does not apply the cascade, so this reads the rules on
// the way from #app down to the stage's content and holds the inset to exactly one of them.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const src = resolve(process.cwd(), 'src')
const rulesOf = file => {
  const css = readFileSync(join(src, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  return [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].flatMap(m =>
    m[1].split(',').map(s => ({ file, selector: s.trim().replace(/\s+/g, ' '), decls: m[2] })))
}
const SCREENS = ['views/today/today.css', 'views/train/train.css']
const rules = ['index.css', 'tab-shell.css', 'ui-kit.css', 'ds/ds.css', ...SCREENS].flatMap(rulesOf)
const TOP_INSET = /var\(--sat\b|safe-area-inset-top/
const insets = decls => decls.match(new RegExp(TOP_INSET.source, 'g')) || []
// Every box in flow between the window's top and a tab root's content (ds/StageScreen.jsx).
const CHAIN = [
  ':root #app:has(> .g-root.g-screen)', ':root .app-out:has(> .g-root.g-screen)',
  '.g-root', '.g-screen', '.g-screen > .g-stage', '.g-stage', '.g-stage-body', '.g-screen > .g-stage > .g-stage-body',
  '#app > .g-screen > .g-stage > .g-stage-body', '.app-out > .g-screen > .g-stage > .g-stage-body', '.today', '.train',
]

describe('the stage\'s top inset', () => {
  it('a stage screen takes #app\'s inset padding off, so the stage paints under the status bar', () => {
    const app = rules.filter(r => r.selector === ':root #app:has(> .g-root.g-screen)')
    expect(app.length).toBeGreaterThan(0)
    for (const r of app) expect(r.decls).not.toMatch(TOP_INSET)
  })

  it('is added exactly once in flow between #app and a tab root\'s content, by StageScreen\'s body', () => {
    const hits = rules.filter(r => CHAIN.includes(r.selector)).flatMap(r => insets(r.decls).map(() => r.selector))
    expect(hits).toEqual(['.g-screen > .g-stage > .g-stage-body'])
  })

  it('the pinned header is fixed to the window\'s top and holds the inset inside its own box', () => {
    const pin = rules.filter(r => r.selector === '.g-shdr-pin')
    expect(pin).toHaveLength(1)
    expect(pin[0].decls).toMatch(/position:\s*fixed/)
    expect(pin[0].decls).toMatch(/top:\s*0/)
    // The height and the padding both count it; the padding sits inside the height
    // (border-box), so the header's own row (--shdr-h) is what remains.
    expect(pin[0].decls).toMatch(/box-sizing:\s*border-box/)
    expect(insets(pin[0].decls)).toHaveLength(2)
  })

  it.each(SCREENS)('%s adds no top inset of its own and clears the pinned header\'s row', file => {
    for (const r of rulesOf(file)) expect(r.decls, r.selector).not.toMatch(TOP_INSET)
    const screen = rulesOf(file).find(r => r.selector === '.today' || r.selector === '.train')
    expect(screen.decls).toMatch(/padding-top:\s*var\(--shdr-h\)/)
  })
})
