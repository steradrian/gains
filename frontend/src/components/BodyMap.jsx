import { useEffect, useState } from 'react'
import { MUSCLES, INERT, MUSCLE_NAME, levelsOf } from '../lib/muscles.js'
import { t } from '../lib/i18n.js'
import { useMuscleKeys } from '../lib/use-muscle-keys.js'

// Front and back views of a body, each muscle shaded by how hard it was worked.
//
// The geometry is ~90 KB and only some screens show a map, so it is fetched on first
// render instead of riding along in the main bundle. Until it lands the component
// renders nothing but keeps its height, so nothing below it jumps on arrival.

let CACHE = null                                  // shared across every mounted map
let PENDING = null

// Exported for the design system's BodyMap (ds/BodyMap.jsx), which draws the same geometry.
export function useBodyPaths() {
  const [paths, setPaths] = useState(CACHE)
  useEffect(() => {
    if (CACHE) return
    let alive = true
    PENDING = PENDING || import('../lib/body-paths.js').then(m => (CACHE = m.default))
    PENDING.then(p => { if (alive) setPaths(p) }).catch(() => {})
    return () => { alive = false }
  }, [])
  return paths
}

const VIEWS = ['front', 'back']

function View({ g, v, levels, onMuscle, selected, label, keys }) {
  const view = g[v]
  return (
    <svg className="bm-v" viewBox={view.vb} role={onMuscle ? 'group' : 'img'}
      aria-label={label ? `${label}, ${v === 'front' ? t('Front') : t('Back of the body')}` : undefined}>
      {INERT.map(slug => (view.p[slug] || []).map((d, i) =>
        <path key={slug + i} className="bm-sil" d={d} />))}
      {MUSCLES.map(slug => (view.p[slug] || []).map((d, i) => {
        const own = onMuscle ? keys.keysFor(slug, v, i) : null
        return (
          <path
            key={slug + i}
            className={'bm-m l' + (levels[slug] || 0) + (selected === slug ? ' sel' : '') + (onMuscle && keys.ring === slug ? ' bm-ring' : '')}
            d={d}
            data-muscle={onMuscle ? slug : undefined}
            onClick={onMuscle ? () => onMuscle(slug) : undefined}
            aria-hidden={onMuscle && !own ? 'true' : undefined}
            {...own}
          >
            <title>{t(MUSCLE_NAME[slug])}</title>
          </path>
        )
      }))}
    </svg>
  )
}

/**
 * <BodyMap load={{ chest: 12, … }} body="male" />
 * `load` is effective sets per muscle (see lib/muscles.js); shading is relative to
 * the hardest-worked muscle in that same load, so it always reads as a balance. Pass ordered
 * `{ at, level, exclusive? }` `thresholds` for a fixed absolute scale (recovery views use this
 * to keep their semantic bands stable); omitting it preserves the balance behavior.
 * `captions` names each view under it, Front and Back (the Training load page's MuscleMap).
 * `onMuscle(slug)` makes the muscles buttons, one tab stop for the map (useMuscleKeys); `label`
 * names the map's views for a screen reader.
 */
export default function BodyMap({ load = {}, thresholds, body = 'male', onMuscle, selected, label, captions = false, className = '' }) {
  const paths = useBodyPaths()
  const levels = levelsOf(load, thresholds)
  const g = paths && (paths[body] || paths.male)
  const keys = useMuscleKeys({ g, views: VIEWS, selected, onMuscle })
  const view = (v, caption) => {
    const map = <View g={g} v={v} levels={levels} onMuscle={onMuscle} selected={selected} label={label} keys={keys} />
    return captions ? <figure className="bm-fig">{map}<figcaption className="bm-cap">{caption}</figcaption></figure> : map
  }
  return (
    <div className={'bodymap ' + className} ref={keys.box}>
      {g ? <>
        {view('front', t('Front'))}
        {view('back', t('Back of the body'))}
      </> : <div className="bm-ph" aria-hidden="true" />}
    </div>
  )
}
