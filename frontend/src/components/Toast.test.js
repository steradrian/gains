// A toast that wraps (the Coach's refusal of an http:// address runs to four lines) drew as a
// circle about 170 by 230 CSS px over the list and the button under it: its corners were a pill's
// 99px on a box that tall, and the box only ever got half the screen's width to wrap in (Android
// QA, v1.3.9). It is the design system's UndoToast now: a box with 20px corners, across the screen.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
const ds = readFileSync(new URL('../ds/ds.css', import.meta.url), 'utf8')
// #toast places it (the live region); the UndoToast inside is what is drawn.
const region = css.match(/\n#toast\{([^}]*)\}/)[1]
const toast = ds.match(/\n\.g-utoast \{([^}]*)\}/)[1]
const msg = ds.match(/\n\.g-utoast-msg \{([^}]*)\}/)[1]

describe('the toast', () => {
  it('rounds its corners as a box, not as a pill, so four lines are not a circle', () => {
    expect(toast).toMatch(/border-radius: 20px;/)
  })

  // left:50% leaves a box without a width half the screen to wrap in: the same message stood as
  // a column about 206 CSS px wide and as tall.
  it('wraps a long message across the screen, 16px from its edges, not in half of it', () => {
    expect(region).toMatch(/inset-inline:16px/)
    expect(region).not.toMatch(/left:50%/)
    expect(msg).toMatch(/flex: 1; min-width: 0;/)
  })

  // The bar says how long Undo lasts (8 s, ds/UndoToast.test.jsx); the time runs either way.
  it('stands its drain bar still under reduced motion, the system\'s or the app\'s', () => {
    expect(ds).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.g-utoast-drain \{ animation: none; \} \}/)
    expect(ds).toMatch(/:root\[data-motion="reduce"\] \.g-utoast-drain \{ animation: none; \}/)
  })
})
