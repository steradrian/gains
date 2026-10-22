import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// The liquid-glass HUD on #/dev/glass (M3's device gate): the engine's own numbers, read four times a
// second from GlassHost's statsRef, and the presenter switch, one tap. It renders into <body>, outside the
// glass ground, so its updates never wake the glass. Every timing is the mean / 95th percentile over the
// last 2 s of samples (the mean, because WebKit rounds performance.now() to 1 ms), so after a fling stops
// it keeps showing that fling. English only, like #/dev/kit.

const POLL_MS = 250
export const REFRESH_BUDGET_MS = 4 // plan 2.8: a throttled sprite refresh may cost this much main thread
const CPU_BUDGET_MS = 6 // the watchdog's limits (glass-watchdog.js)
const INTERVAL_BUDGET_MS = 24

const ms = s => (s ? `${s.mean.toFixed(2)} / ${s.p95.toFixed(1)} ms` : '-')
const px = s => (s ? `${s.p95.toFixed(0)} px (max ${s.max.toFixed(0)})` : '0 px')
const mb = n => `${((n || 0) / 1048576).toFixed(1)} MB`

/** The HUD's rows from a glass-stats.js snapshot (pure, for the test). */
export function hudRows(snap, presenter) {
  const g = snap.gauges || {}
  const sprite = presenter === 'sprite'
  const wouldTrip = (snap.frame?.p50 ?? 0) > CPU_BUDGET_MS || (snap.interval?.p50 ?? 0) > INTERVAL_BUDGET_MS
  const rows = [
    { key: 'unit', label: 'Timings', value: 'avg / p95, last 2 s' },
    { key: 'frame', label: 'Frame CPU', value: ms(snap.frame), bad: (snap.frame?.p50 ?? 0) > CPU_BUDGET_MS },
    { key: 'interval', label: 'rAF interval', value: ms(snap.interval), bad: (snap.interval?.p50 ?? 0) > INTERVAL_BUDGET_MS },
    { key: 'draw', label: 'GL draw', value: ms(snap.draw) },
    { key: 'copy', label: g.copy === 'bitmap' ? 'Copy (sync)' : 'Copy', value: g.sprites !== undefined ? ms(snap.copy) : '-' },
  ]
  if (g.copy === 'bitmap') {
    rows.push({ key: 'transfer', label: 'Transfer', value: ms(snap.transfer) })
    rows.push({ key: 'latency', label: 'Bitmap latency', value: ms(snap.latency) })
  }
  rows.push(
    { key: 'refresh', label: `Refresh (gate ${REFRESH_BUDGET_MS})`, value: g.sprites !== undefined ? ms(snap.refresh) : '-', bad: (snap.refresh?.p95 ?? 0) > REFRESH_BUDGET_MS },
    // The fixed presenter draws where the element was when the frame began; on iOS the page has moved at
    // least one frame further by the time it shows, so its rim trails by at least the per-frame movement.
    { key: 'rim', label: 'Rim lag', value: sprite && !g.compare ? '0 px (in element)' : `≥ ${px(snap.move)}` },
    { key: 'content', label: 'Content lag', value: g.sprites !== undefined ? px(snap.contentLag) : '-' },
    { key: 'shapes', label: 'Shapes drawn', value: `${g.chrome ?? 0} chrome, ${(g.inFixed ?? 0) + (g.inSprite ?? 0)} in-flow` },
    { key: 'sprites', label: 'Sprites', value: g.sprites !== undefined ? `${g.sprites} alive, ${g.refreshed} last` : '-' },
    { key: 'atlas', label: 'Atlas', value: g.atlas ? `${g.atlas}, ${g.pages || 0} pass${g.skipped ? `, ${g.skipped} too big` : ''}` : '-' },
    { key: 'memory', label: 'Memory (est.)', value: mb(g.bytes) },
    { key: 'watchdog', label: 'Watchdog', value: wouldTrip ? 'would trip (off here)' : 'ok', bad: wouldTrip },
  )
  return rows
}

/**
 * @param {{ statsRef: { current: object | null }, presenter: 'fixed' | 'sprite', onPresenter: (p: string) => void,
 *   options: string, status: string | null }} props
 * `options`: the sprite options in a line, so a screenshot of the HUD says what was measured.
 */
export default function DevGlassHud({ statsRef, presenter, onPresenter, options, status }) {
  const [snap, setSnap] = useState({ gauges: {} })
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const id = setInterval(() => setSnap(statsRef.current?.snapshot() ?? { gauges: {} }), POLL_MS)
    return () => clearInterval(id)
  }, [statsRef])

  const rows = hudRows(snap, presenter)
  const shown = open ? rows : rows.filter(r => r.key === 'refresh' || r.key === 'rim' || r.key === 'frame')
  return createPortal(
    <div className="g-root gl-hud" role="region" aria-label="Glass HUD">
      <div className="gl-hud-bar">
        <div className="gl-hud-seg" role="group" aria-label="Presenter">
          {['fixed', 'sprite'].map(p => (
            <button key={p} type="button" aria-pressed={String(p === presenter)} onClick={() => onPresenter(p)}>{p === 'fixed' ? 'Fixed' : 'Sprite'}</button>
          ))}
        </div>
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
