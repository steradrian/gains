import Button from '../../ds/Button.jsx'
import StageRing from '../../ds/StageRing.jsx'
import { fmtDur } from '../../lib/format.js'
import { t } from '../../lib/i18n.js'
import { dayTimeText, fullWhenText, clockSpoken, clockText } from './fast-format.js'
import { leftMs, progressOf } from '../../lib/nutrition/fasting.js'
import { cx } from '../../lib/ui-kit.js'

// The running fast (boards Ea6Running, Ea6Reached): the ring and the clock, the time left or past
// the goal, when it started and ends, Change start and End fast. From the goal on the ring is
// green and Change start is gone, as the board draws it. The clock is text, so it ticks without
// motion; a screen reader gets the minutes once, not every second.
export default function FastRunCard({ fast, now, hour12, busy, onChangeStart, onEnd }) {
  const p = progressOf(fast, now)
  const start = Date.parse(fast.start_at)
  const line = p.reached ? t('{0} past your goal', fmtDur(p.elapsedMs - p.goalMs)) : t('{0} to go', fmtDur(leftMs(p.remainingMs)))
  return (
    <section className={cx('g-fast-card g-glass', p.reached && 'g-fast-done')}>
      <div className="g-fast-ring" aria-hidden="true">
        <StageRing value={p.elapsedMs} max={p.goalMs} size={260} top={p.reached ? t('Goal reached') : t('Fasting')} big={clockText(p.elapsedMs)} unit={line} />
      </div>
      <p className="g-sr">{t('{0}, {1}', p.reached ? t('Goal reached') : t('Fasting'), t('{0}, {1}', clockSpoken(p.elapsedMs), line))}</p>
      <span className="g-fast-sub">{t('Started {0} · goal {1} h, ends {2}.', fullWhenText(start, hour12), fast.goal_hours, dayTimeText(p.targetAt, hour12))}</span>
      <div className="g-fast-acts">
        {!p.reached && <Button variant="glass" block onClick={onChangeStart}>{t('Change start')}</Button>}
        <Button block busy={busy} onClick={onEnd}>{t('End fast')}</Button>
      </div>
    </section>
  )
}
