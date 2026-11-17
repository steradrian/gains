// The features a search can find switched off (board Sh0TurnOn): a page that only shows once its
// feature is on. A query that matches one gets its card, the feature named Off with one line on
// what it does and where it is switched, Turn on and the page holding the switch, in place of a
// page that would open onto nothing. Turning one on is components/search/open-result.js's.
//
// Only features whose whole page is held back are here (Fasting, Gym check-in). The other switches
// Profile › Features lists are rows on a page that is always there: a search finds them as
// settings, with their Off value, opening at the switch.
import { t } from '../i18n-core.js'
import { PAGES } from '../../views/settings-pages.js'
import { matchRecord } from './match.js'

export const FEATURES = [
  {
    id: 'fasting', title: 'Fasting', glyph: 'timer', kw: 'fast fasting intermittent 16:8 omad timer',
    line: page => t('A timer for your fasts with a goal and history. It is off in {0}, so Eat doesn’t show it.', page),
    available: c => !!c.nutrition, on: c => !!c.fastingOn, at: { page: 'features', find: 'Fasting' },
  },
  {
    id: 'checkIn', title: 'Gym check-in', glyph: 'qr', kw: 'check in gym card membership qr barcode',
    line: page => t('Your gym card’s code, ready at the door. It is off in {0}, so Train doesn’t show it.', page),
    available: () => true, on: c => !!c.checkIn, at: { page: 'appearance', find: 'Gym check-in' },
  },
]

/** The Profile page that holds a feature's switch, by name ("Features"). */
export const featurePageTitle = f => t(PAGES[f.at.page]?.title || 'Features')

/**
 * The switched-off features `words` match, as results of type 'feature': { id, key, title, ranges,
 * line (what it does and where it is off), media, off: { page, find } (its switch, the settings
 * `find` contract), pageTitle }. `ctx` is the pages context (use-search-data.js `pagesCtx`).
 */
export function featureResults(words, ctx) {
  if (!words.length) return []
  const out = []
  for (const f of FEATURES) {
    if (!f.available(ctx) || f.on(ctx)) continue
    const title = t(f.title)
    const m = matchRecord(words, { title, aliases: [f.kw, f.title] })
    if (!m) continue
    const pageTitle = featurePageTitle(f)
    out.push({
      type: 'feature', id: f.id, key: 'feature:' + f.id, title, ranges: m.ranges,
      subtitle: f.line(pageTitle), line: f.line(pageTitle), pageTitle,
      media: { kind: 'glyph', glyph: f.glyph }, off: f.at,
      // A card, never the best match: it opens nothing until the feature is on.
      score: m.score, exact: false, wordPrefix: false, frecency: 0,
    })
  }
  return out
}
