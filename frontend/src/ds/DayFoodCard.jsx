import Icon from '../components/Icon.jsx'
import Act from './Act.jsx'

const R = 28
const C = 2 * Math.PI * R
const clamp = p => Math.min(Math.max(Number(p) || 0, 0), 1)

// A past day's food on a Day page (boards Sh1Day, Sh1DayRest, Sh1DayMissed; the bundle's
// DayTotals and MealsCard are the light drawer's): one glass card with a small ring and the day's
// total against its target ("2,075" `big`, "of 2,100 kcal" `of`, "On target" `status`), the macro
// bars, then a row a meal. `progress` (0-1) fills the ring, which is decoration: the numbers say it.
// macros: [{ key, name, line, progress }], `line` "132 of 150 g"; a macro without a goal has
// `progress` null and no bar. meals: [{ key, icon, name, sub, value, unit, found, href, onClick }],
// `sub` what was eaten ("Oats with milk, Banana") or that nothing was, `value` and `unit` the kcal,
// `found` the meal holding an entry a search opened the day for (lit once); a meal is a link or a
// button only with `href` or `onClick`. `of` is left out without a target. Every string is the
// caller's.
export default function DayFoodCard({ big, of, status, progress, macros = [], meals = [] }) {
  return (
    <div className="g-dfood g-glass">
      <div className="g-dfood-top">
        <svg className="g-dfood-ring" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r={R} className="g-dfood-track" />
          {progress > 0 && <circle cx="32" cy="32" r={R} className="g-dfood-fill" strokeDasharray={C} strokeDashoffset={C * (1 - clamp(progress))} />}
        </svg>
        <span className="g-dfood-num">
          <b>{big}{of && <> <span>{of}</span></>}</b>
          {status && <span>{status}</span>}
        </span>
      </div>
      {macros.length > 0 && (
        <div className="g-dfood-macros">
          {macros.map(m => (
            <div key={m.key ?? m.name} className="g-dfood-macro">
              <b>{m.name}</b>
              {m.progress != null && <span className="g-dfood-bar" aria-hidden="true"><i style={{ '--p': clamp(m.progress) }} /></span>}
              <span>{m.line}</span>
            </div>
          ))}
        </div>
      )}
      {meals.map(m => {
        const kids = (
          <>
            <span className="g-dfood-ic" aria-hidden="true"><Icon name={m.icon || 'utensils'} className="g-icon" /></span>
            <span className="g-dfood-mb"><b>{m.name}</b>{m.sub && <span>{m.sub}</span>}</span>
            {m.value != null && <span className="g-dfood-kcal">{m.value}{m.unit && <span> {m.unit}</span>}</span>}
          </>
        )
        const cls = m.found ? 'g-dfood-meal g-dfood-found' : 'g-dfood-meal'
        return m.href || m.onClick
          ? <Act key={m.key ?? m.name} href={m.href} onClick={m.onClick} className={cls}>{kids}</Act>
          : <div key={m.key ?? m.name} className={cls}>{kids}</div>
      })}
    </div>
  )
}
