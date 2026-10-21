import { useBodyPaths } from '../components/BodyMap.jsx'
import { t } from '../lib/i18n.js'
import { INERT, MUSCLES } from '../lib/muscles.js'
import { useMuscleKeys } from '../lib/use-muscle-keys.js'
import { cx, oneOf } from '../lib/ui-kit.js'

// The app's muscle map (lib/body-paths.js, the geometry components/BodyMap.jsx loads on first use)
// in the design system's skin (bundle.js `BodyMap`): `levels` is { slug: 0..4 }, shaded white on
// the stage and in the accent on a light surface. Small and quiet: it is the picture beside a
// sentence, so without a `label` it is hidden from a screen reader. Until the geometry lands it is
// an empty box that holds the space.
// `onMuscle(slug)` makes each muscle tappable, in one of two ways set by `label`:
// - with a `label`, each muscle is a button (board T6.2: tap a muscle to switch), named by its own
//   name and pressed when `selected`, and the map is a named group: the map is the way in. The
//   whole map is one tab stop and the arrow keys walk the muscles (lib/use-muscle-keys.js).
// - without one, the map stays hidden from a screen reader and a muscle takes only a pointer, with
//   no tab stops: the page lists the same muscles as rows, the keyboard and screen-reader way in.
export default function BodyMap({ levels = {}, body = 'male', tone = 'stage', views = ['front', 'back'], width = 160, selected, label, onMuscle }) {
  oneOf('BodyMap', 'tone', tone, ['stage', 'light'])
  const keyed = Boolean(onMuscle && label)
  const paths = useBodyPaths()
  const g = paths && (paths[body] || paths.male)
  const keys = useMuscleKeys({ g, views, selected, onMuscle })
  if (!g) return <div className="g-bmap g-bmap-ph" aria-hidden="true" />
  return (
    <div className={cx('g-bmap', tone === 'light' ? 'g-bmap-light' : 'g-bmap-stage')} ref={keys.box}>
      {views.map(v => {
        const view = g[v]
        const [, , w, h] = view.vb.split(' ').map(Number)
        return (
          <svg
            key={v}
            width={width}
            height={Math.round(width * h / w)}
            viewBox={view.vb}
            role={keyed ? 'group' : label ? 'img' : undefined}
            aria-label={label ? `${label}, ${v === 'front' ? t('Front') : t('Back of the body')}` : undefined}
            aria-hidden={label ? undefined : 'true'}
          >
            {INERT.map(slug => (view.p[slug] || []).map((d, i) => <path key={slug + i} className="g-bm-sil" d={d} />))}
            {MUSCLES.map(slug => (view.p[slug] || []).map((d, i) => {
              const own = keyed ? keys.keysFor(slug, v, i) : null
              return (
                <path
                  key={slug + i}
                  className={cx('g-bm-m', 'l' + (levels[slug] || 0), selected === slug && 'sel', onMuscle && (keyed ? 'g-bm-btn' : 'g-bm-tap'), keyed && keys.ring === slug && 'g-bm-ring')}
                  d={d}
                  data-muscle={onMuscle ? slug : undefined}
                  onClick={onMuscle ? () => onMuscle(slug) : undefined}
                  aria-hidden={keyed && !own ? 'true' : undefined}
                  {...own}
                />
              )
            }))}
          </svg>
        )
      })}
    </div>
  )
}
