import { t } from '../../../lib/i18n.js'
import { HevyApiError } from '../../../lib/import-hevy.js'

// The order importHevyData (lib/import-hevy.js) walks Hevy's account in. Its onProgress says which
// stage and how many of the stage's pages are in; a stage's pages are not known until its first
// one answers, so the ring is an honest "stage i of 5, and this far through it", not a guess at
// bytes.
const STAGES = ['templates', 'workouts', 'routines', 'body', 'parse']

/** The line under the ring: what is being fetched, and the page it is on. */
export function hevyProgressLabel(p) {
  if (!p) return t('Fetching from Hevy…')
  if (p.stage === 'templates') return t('Fetching exercises… ({0}/{1})', p.page, p.pageCount)
  if (p.stage === 'workouts') return t('Fetching workouts… ({0}/{1})', p.page, p.pageCount)
  if (p.stage === 'routines') return t('Fetching routines… ({0}/{1})', p.page, p.pageCount)
  if (p.stage === 'body') return t('Fetching weigh-ins… ({0}/{1})', p.page, p.pageCount)
  if (p.stage === 'parse') return t('Matching exercises…')
  return t('Fetching from Hevy…')
}

/** 0 to 1 across the five stages. Matching is the last fifth; the screen goes when it ends. */
export function hevyFraction(p) {
  const i = STAGES.indexOf(p?.stage)
  if (i < 0) return 0
  const within = p.stage !== 'parse' && p.pageCount > 0 ? Math.min(1, Math.max(0, p.page / p.pageCount)) : 0
  return (i + within) / STAGES.length
}

/** What a failed fetch says. */
export function hevyFetchError(e) {
  if (e instanceof HevyApiError && e.message === 'auth') return t('That Hevy API key was refused')
  if (e instanceof HevyApiError && e.message === 'rate-limit') return t('Hevy is rate-limiting requests. Wait a minute and try again')
  if (e instanceof HevyApiError && e.message === 'empty') return t('Paste your Hevy API key first')
  return t('Couldn’t reach Hevy. Check the key and try again')
}
