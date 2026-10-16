// The motion tokens are CSS custom properties (index.css, ui-kit.css); lib/motion.js carries the
// same values as numbers for the Web Animations API. One changed without the other would have a
// sheet's CSS and its animation disagree, so they are read side by side here.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { EASE, MS, POP, SHIFT } from './motion.js'

const css = ['../index.css', '../ui-kit.css'].map(f => readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n')
const token = name => {
  const m = css.match(new RegExp(`${name}:\\s*([^;]+);`))
  if (!m) throw new Error(`${name} is not defined`)
  return m[1].trim()
}
const ms = name => parseFloat(token(name))
const px = name => parseFloat(token(name))
const curve = s => s.replace(/\s+/g, '').replace(/0\./g, '.')

describe('motion tokens', () => {
  it('match lib/motion.js: durations', () => {
    expect({
      fast: ms('--fast'), med: ms('--med'), slow: ms('--slow'),
      exitFast: ms('--exit-fast'), exit: ms('--exit'), exitSlow: ms('--exit-slow'), rm: ms('--rm'),
    }).toEqual(MS)
  })

  it('match lib/motion.js: easings', () => {
    expect(curve(token('--ease'))).toBe(curve(EASE.ease))
    expect(curve(token('--ease-io'))).toBe(curve(EASE.io))
    expect(curve(token('--ease-exit'))).toBe(curve(EASE.exit))
  })

  it('match lib/motion.js: shifts and the centred dialog\'s scale', () => {
    expect({ xs: px('--shift-xs'), sm: px('--shift-sm'), md: px('--shift-md'), x: px('--shift-x') }).toEqual(SHIFT)
    expect({ from: parseFloat(token('--pop-from')), to: parseFloat(token('--pop-to')) }).toEqual(POP)
  })
})
