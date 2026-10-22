import { t, tn } from '../../lib/i18n.js'
import { settingValue } from '../../lib/search/settings-source.js'

// How many choices a hit names before it counts them instead ("Dark, Light, System", "28 options").
const NAMED_OPTIONS = 4

/** The hint after the page in a hit's line: the choices a row offers, else what it is set to now. */
export function hitDetail(hit, S, ctx) {
  if (hit.isPage) return null
  const opts = hit.opts || []
  if (opts.length) return opts.length <= NAMED_OPTIONS ? opts.map(o => t(o)).join(', ') : tn('{0} option', '{0} options', opts.length)
  return settingValue(hit, S, ctx)
}

/**
 * The rows of a settings search (SettingsRows): one per hit, "Theme" over "Appearance · Dark,
 * Light, System". `onGo(hit)` opens the hit's page and flashes its row.
 */
export function hitRows(hits, S, ctx, onGo) {
  return hits.map(h => {
    const detail = hitDetail(h, S, ctx)
    return {
      key: h.page + ':' + h.title,
      icon: h.icon,
      title: h.label,
      sub: [h.trail, detail].filter(Boolean).join(' · '),
      onClick: () => onGo(h),
    }
  })
}
