// @vitest-environment happy-dom
// The HUD shows the engine's numbers with the gate's budget flagged, and the sprite memory budget.
import { describe, expect, it } from 'vitest'
import { useView } from './render.test-util.js'
import DevGlassHud, { hudRows, REFRESH_BUDGET_MS } from './DevGlassHud.jsx'

const view = useView()
const row = (rows, key) => rows.find(r => r.key === key)

describe('hudRows', () => {
  it('flags a sprite refresh over the gate', () => {
    const snap = {
      gauges: { sprites: 6, refreshed: 6, atlas: '1280x448', pages: 1, bytes: 6 * 1048576, chrome: 3, inFlow: 20 },
      refresh: { mean: 3, p50: 3, p95: REFRESH_BUDGET_MS + 1, max: 9, n: 30 },
    }
    const rows = hudRows(snap)
    expect(row(rows, 'refresh').bad).toBe(true)
    expect(row(rows, 'memory').value).toBe('6.0 MB')
    expect(row(rows, 'shapes').value).toBe('3 chrome, 20 in-flow')
  })

  it('shows the memory budget and flags elements left on the CSS material', () => {
    const rows = hudRows({ gauges: { bytes: 31 * 1048576, budget: 30 * 1048576, over: 2 } })
    expect(row(rows, 'memory').value).toBe('31.0 MB of 30.0 MB')
    expect(row(rows, 'over')).toMatchObject({ value: '2 on CSS', bad: true })
    expect(row(hudRows({ gauges: { over: 0 } }), 'over').bad).toBe(false)
  })

  it('says the watchdog would trip on a slow device', () => {
    expect(row(hudRows({ gauges: {}, frame: { mean: 7, p50: 7, p95: 9, max: 9, n: 40 } }), 'watchdog').bad).toBe(true)
  })
})

describe('DevGlassHud', () => {
  it('renders the rows and the options line', async () => {
    await view.render(<DevGlassHud statsRef={{ current: null }} options="cards 3x" status="webgl" />)
    expect(document.querySelector('.gl-hud-opts').textContent).toBe('cards 3x')
    expect(document.querySelector('.gl-hud')).not.toBeNull()
  })
})
