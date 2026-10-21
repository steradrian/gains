// The pushed pages' nav bar (StageNavBar, .g-snav) never stuck: .g-stage was overflow: hidden,
// which makes it a scroll box of its own, and a sticky part sticks to the nearest one, a box that
// grows with its content and never scrolls. happy-dom does not apply the cascade, so this reads the
// rules on the way from the stage down to the bar and holds them to boxes that clip without scrolling.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const src = resolve(process.cwd(), 'src')
const rulesOf = file => {
  const css = readFileSync(join(src, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  return [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].flatMap(m =>
    m[1].split(',').map(s => ({ file, selector: s.trim().replace(/\s+/g, ' '), decls: m[2] })))
}
// The overflow a rule ends on: a later declaration wins, so `hidden; clip` is clip.
const overflowOf = decls => [...decls.matchAll(/(?:^|;)\s*overflow(?:-[xy])?\s*:\s*([a-z-]+)/g)].map(m => m[1]).at(-1)
const rules = ['index.css', 'ui-kit.css', 'ds/ds.css', 'onboarding.css', 'views/shared/notifications.css', 'views/today/today.css', 'views/train/train.css'].flatMap(rulesOf)
// Every box between the stage and a sticky part: StageScreen, the notifications page, onboarding.
const CHAIN = ['.g-root', '.g-screen', '.g-screen > .g-stage', '.g-stage', '.g-stage-body', '.g-screen > .g-stage > .g-stage-body', '.notif', '.today', '.ob', '.ob-host']
const SCROLLS = new Set(['hidden', 'auto', 'scroll'])

describe('sticky parts on the stage', () => {
  it('.g-stage clips without being a scroll box, with hidden kept first as the fallback', () => {
    const stage = rules.filter(r => r.selector === '.g-stage' && /overflow/.test(r.decls))
    expect(stage).toHaveLength(1)
    expect(overflowOf(stage[0].decls)).toBe('clip')
    expect(stage[0].decls).toMatch(/overflow:\s*hidden;\s*overflow:\s*clip/)
  })

  it('no box between the stage and its sticky parts is a scroll box', () => {
    for (const r of rules.filter(r => CHAIN.includes(r.selector))) {
      expect(SCROLLS.has(overflowOf(r.decls)), `${r.file} ${r.selector}`).toBe(false)
    }
  })

  it('the notifications page adds no top inset: StageScreen\'s body clears the status bar once', () => {
    for (const r of rulesOf('views/shared/notifications.css')) expect(r.decls, r.selector).not.toMatch(/var\(--sat\b|safe-area-inset-top/)
  })

  it('the nav bar is still sticky under the status bar', () => {
    const bar = rules.find(r => r.selector === '.g-snav')
    expect(bar.decls).toMatch(/position:\s*sticky/)
    expect(bar.decls).toMatch(/top:\s*var\(--sat/)
  })
})
