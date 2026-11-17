// The HUD's numbers: percentiles over the last 2 s of samples (not of wall time, so a fling's numbers stay
// up after it stops), the max since reset, and gauges.
import { describe, expect, it } from 'vitest'
import { createStats } from './glass-stats.js'

describe('createStats', () => {
  it('summarises the window that ends at the newest sample', () => {
    const s = createStats({ windowMs: 2000 })
    s.push('frame', 50, 0) // older than the window once the later samples land
    for (let i = 1; i <= 100; i++) s.push('frame', i / 10, 10000 + i * 16)
    const sum = s.summary('frame')
    expect(sum.n).toBe(100)
    expect(sum.p50).toBeCloseTo(5.1, 1)
    expect(sum.p95).toBeCloseTo(9.6, 1)
    expect(sum.max).toBe(50)
  })

  it('has no summary without samples, ignores non-finite values and keeps gauges in the snapshot', () => {
    const s = createStats()
    expect(s.summary('copy')).toBeNull()
    s.push('copy', NaN, 1)
    expect(s.summary('copy')).toBeNull()
    s.set('sprites', 4)
    s.push('copy', 2, 1)
    expect(s.snapshot()).toMatchObject({ gauges: { sprites: 4 }, copy: { p50: 2, n: 1 } })
  })

  it('forgets the series on reset', () => {
    const s = createStats()
    s.push('move', 30, 1)
    s.reset()
    expect(s.summary('move')).toBeNull()
  })
})
