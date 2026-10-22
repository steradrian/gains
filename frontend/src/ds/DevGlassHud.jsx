import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// The liquid-glass HUD on #/dev/glass: the engine's own numbers, read four times a second from
// GlassHost's statsRef. It renders into <body>, outside the glass ground, so its updates never wake the
// glass. Every timing is the mean / 95th percentile over the last 2 s of samples (the mean, because WebKit
// rounds performance.now() to 1 ms), so after a fling stops it keeps showing that fling. English only,
// like #/dev/kit.

const POLL_MS = 250
export const REFRESH_BUDGET_MS = 4 // plan 2.8: a throttled sprite refresh may cost this much main thread
const CPU_BUDGET_MS = 6 // the watchdog's limits (glass-watchdog.js)
const INTERVAL_BUDGET_MS = 24

const ms = s => (s ? `${s.mean.toFixed(2)} / ${s.p95.toFixed(1)} ms` : '-')
const px = s => (s ? `${s.p95.toFixed(0)} px (max ${s.max.toFixed(0)})` : '0 px')
const mb = n => `${((n || 0) / 1048576).toFixed(1)} MB`

/** The HUD's rows from a glass-stats.js snapshot (pure, for the test). */
export function hudRows(snap) {
  const g = snap.gauges || {}
  const wouldTrip = (snap.frame?.p50 ?? 0) > CPU_BUDGET_MS || (snap.interval?.p50 ?? 0) > INTERVAL_BUDGET_MS
  const overBudget = (g.over ?? 0) > 0
  return [
    { key: 'unit', label: 'Timings', value: 'avg / p95, last 2 s' },
    { key: 'frame', label: 'Frame CPU', value: ms(snap.frame), bad: (snap.frame?.p50 ?? 0) > CPU_BUDGET_MS },
    { key: 'interval', label: 'rAF interval', value: ms(snap.interval), bad: (snap.interval?.p50 ?? 0) > INTERVAL_BUDGET_MS },
    { key: 'draw', label: 'GL draw', value: ms(snap.draw) },
    { key: 'copy', label: 'Copy', value: ms(snap.copy) },
    { key: 'refresh', label: `Refresh (gate ${REFRESH_BUDGET_MS})`, value: ms(snap.refresh), bad: (snap.refresh?.p95 ?? 0) > REFRESH_BUDGET_MS },
    { key: 'content', label: 'Content lag', value: px(snap.contentLag) },
    { key: 'shapes', label: 'Shapes drawn', value: `${g.chrome ?? 0} chrome, ${g.inFlow ?? 0} in-flow` },
    { key: 'sprites', label: 'Sprites', value: g.sprites !== undefined ? `${g.sprites} alive, ${g.refreshed} last` : '-' },
    { key: 'atlas', label: 'Atlas', value: g.atlas ? `${g.atlas}, ${g.pages || 0} pass${g.skipped ? `, ${g.skipped} too big` : ''}` : '-' },
    { key: 'memory', label: 'Memory (est.)', value: g.budget ? `${mb(g.bytes)} of ${mb(g.budget)}` : mb(g.bytes), bad: overBudget },
    { key: 'over', label: 'Over budget', value: `${g.over ?? 0} on CSS`, bad: overBudget },
    { key: 'watchdog', label: 'Watchdog', value: wouldTrip ? 'would trip (off here)' : 'ok', bad: wouldTrip },
  ]
}

/**
 * @param {{ statsRef: { current: object | null }, options: string, status: string | null }} props
 * `options`: the sprite options in a line, so a screenshot of the HUD says what was measured.
 */
export default function DevGlassHud({ statsRef, options, status }) {
  const [snap, setSnap] = useState({ gauges: {} })
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const id = setInterval(() => setSnap(statsRef.current?.snapshot() ?? { gauges: {} }), POLL_MS)
    return () => clearInterval(id)
  }, [statsRef])

  const rows = hudRows(snap)
  const shown = open ? rows : rows.filter(r => r.key === 'refresh' || r.key === 'memory' || r.key === 'frame')
  return createPortal(
    <div className="g-root gl-hud" role="region" aria-label="Glass HUD">
      <div className="gl-hud-bar">
        <button type="button" onClick={() => statsRef.current?.reset()}>Reset</button>
        <button type="button" aria-expanded={String(open)} onClick={() => setOpen(v => !v)}>{open ? 'Less' : 'More'}</button>
      </div>
      <p className="gl-hud-opts">{status === 'webgl' ? options : `glass off: ${status || 'starting'}`}</p>
      <dl className="gl-hud-rows">
        {shown.map(r => (
          <div key={r.key} className={r.bad ? 'gl-hud-row gl-hud-bad' : 'gl-hud-row'}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>,
    document.body,
  )
}
