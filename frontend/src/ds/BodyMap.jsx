import { useBodyPaths } from '../components/BodyMap.jsx'
import { t } from '../lib/i18n.js'
import { INERT, MUSCLES, MUSCLE_NAME } from '../lib/muscles.js'
import { cx, oneOf } from '../lib/ui-kit.js'

// The app's muscle map (lib/body-paths.js, the geometry components/BodyMap.jsx loads on first use)
// in the design system's skin (bundle.js `BodyMap`): `levels` is { slug: 0..4 }, shaded white on
// the stage and in the accent on a light surface. Small and quiet: it is the picture beside a
// sentence, so without a `label` it is hidden from a screen reader. Until the geometry lands it is
// an empty box that holds the space.
// `onMuscle(slug)` makes each muscle a button (board T6.2: tap a muscle to switch), named by its
// own name and pressed when `selected`; the map is then a named group, so it needs a `label`.
const activate = (event, slug, onMuscle) => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  if (event.key === ' ') event.preventDefault()
  onMuscle(slug)
}

export default function BodyMap({ levels = {}, body = 'male', tone = 'stage', views = ['front', 'back'], width = 160, selected, label, onMuscle }) {
  oneOf('BodyMap', 'tone', tone, ['stage', 'light'])
  const paths = useBodyPaths()
  const g = paths && (paths[body] || paths.male)
  if (!g) return <div className="g-bmap g-bmap-ph" aria-hidden="true" />
  return (
    <div className={cx('g-bmap', tone === 'light' ? 'g-bmap-light' : 'g-bmap-stage')}>
      {views.map(v => {
        const view = g[v]
        const [, , w, h] = view.vb.split(' ').map(Number)
        return (
          <svg
            key={v}
            width={width}
            height={Math.round(width * h / w)}
            viewBox={view.vb}
            role={onMuscle ? 'group' : label ? 'img' : undefined}
            aria-label={label ? `${label}, ${v === 'front' ? t('Front') : t('Back of the body')}` : undefined}
            aria-hidden={label || onMuscle ? undefined : 'true'}
          >
            {INERT.map(slug => (view.p[slug] || []).map((d, i) => <path key={slug + i} className="g-bm-sil" d={d} />))}
            {MUSCLES.map(slug => (view.p[slug] || []).map((d, i) => (
              <path
                key={slug + i}
                className={cx('g-bm-m', 'l' + (levels[slug] || 0), selected === slug && 'sel', onMuscle && 'g-bm-btn')}
                d={d}
                onClick={onMuscle ? () => onMuscle(slug) : undefined}
                onKeyDown={onMuscle ? event => activate(event, slug, onMuscle) : undefined}
                role={onMuscle ? 'button' : undefined}
                tabIndex={onMuscle ? 0 : undefined}
                aria-label={onMuscle ? t(MUSCLE_NAME[slug]) : undefined}
                aria-pressed={onMuscle ? selected === slug : undefined}
              />
            )))}
          </svg>
        )
      })}
    </div>
  )
}
