// @vitest-environment happy-dom
// The HUD shows the engine's numbers with the gate's budget flagged, and switches the presenter in one tap.
import { describe, expect, it, vi } from 'vitest'
import { click, useView } from './render.test-util.js'
import DevGlassHud, { hudRows, REFRESH_BUDGET_MS } from './DevGlassHud.jsx'

const view = useView()
const row = (rows, key) => rows.find(r => r.key === key)

describe('hudRows', () => {
  it('flags a sprite refresh over the gate and reads the rim as exact under sprites', () => {
    const snap = {
      gauges: { sprites: 6, refreshed: 6, atlas: '1280x448', pages: 1, bytes: 6 * 1048576, chrome: 3, inSprite: 20, copy: 'draw2d' },
      refresh: { p50: 3, p95: REFRESH_BUDGET_MS + 1, max: 9, n: 30 },
      move: { p50: 20, p95: 48, max: 61, n: 30 },
    }
    const rows = hudRows(snap, 'sprite')
    expect(row(rows, 'refresh').bad).toBe(true)
    expect(row(rows, 'rim').value).toBe('0 px (in element)')
    expect(row(rows, 'memory').value).toBe('6.0 MB')
    expect(row(rows, 'shapes').value).toBe('3 chrome, 20 in-flow')
  })

  it('reads the fixed presenter\'s rim lag from the per-frame movement, and shows bitmap timings for that path', () => {
    const rows = hudRows({ gauges: { copy: 'bitmap', sprites: 0 }, move: { p50: 20, p95: 48, max: 61, n: 30 } }, 'fixed')
    expect(row(rows, 'rim').value).toBe('≥ 48 px (max 61)')
    expect(row(rows, 'latency')).toBeDefined()
  })

  it('says the watchdog would trip on a slow device', () => {
    expect(row(hudRows({ gauges: {}, frame: { p50: 7, p95: 9, max: 9, n: 40 } }, 'fixed'), 'watchdog').bad).toBe(true)
  })
})

describe('DevGlassHud', () => {
  it('switches the presenter with one tap', async () => {
    const onPresenter = vi.fn()
    await view.render(<DevGlassHud statsRef={{ current: null }} presenter="fixed" onPresenter={onPresenter} options="fixed" status="webgl" />)
    const sprite = [...document.querySelectorAll('.gl-hud button')].find(b => b.textContent === 'Sprite')
    expect(sprite.getAttribute('aria-pressed')).toBe('false')
    await click(sprite)
    expect(onPresenter).toHaveBeenCalledWith('sprite')
  })
})
