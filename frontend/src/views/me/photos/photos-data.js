import { fmtDate, fmtNum } from '../../../lib/format.js'
import { t, tn } from '../../../lib/i18n.js'
import { allPhotos, localOnlyCount } from '../../../lib/me/photos.js'

// What the Photos tab shows, read from the state (boards Me2Photos, Me2PhotosEmpty, Me2PhotosSync).
// No JSX. Every claim in the copy is backed by a value here: "on this phone" only while a photo is
// local-only (lib/me/photos.js localOnlyCount), "backed up" only with Back up photos on or when no
// photo is held back.

/**
 * { empty, count, photos (newest first, allPhotos), since (the oldest day), backupOn, localOnly,
 *   allLocal, header: 'phone' | 'account', canCompare }.
 */
export function photosOf(S) {
  const photos = allPhotos(S)
  const count = photos.length
  const localOnly = localOnlyCount(S)
  return {
    empty: count === 0,
    count,
    photos,
    since: count ? photos[count - 1].d : null,
    backupOn: S?.photoBackup === true,
    localOnly,
    allLocal: count > 0 && localOnly === count,
    header: localOnly > 0 ? 'phone' : 'account',
    canCompare: count >= 2,
  }
}

/** The page's line under "Body" on this tab: "6 photos on this phone · since Sun 2 Aug", or
 *  "6 photos · backed up" when nothing is held on the phone. Nothing with no photos. */
export function photosSub(data) {
  if (data.empty) return undefined
  if (data.header === 'account') return tn('{0} photo', '{0} photos', data.count) + ' · ' + t('backed up')
  return tn('{0} photo on this phone', '{0} photos on this phone', data.count) + ' · ' + t('since {0}', fmtDate(data.since, true))
}

/** The state line of the Back up photos row. */
export function backupSub(on) {
  return on ? t('On · kept across your devices') : t('Off · turn on to keep them across devices')
}

/** The footer: where the photos are (only when the data says so), and who sees them. */
export function photosFooter(data) {
  const where = data.backupOn ? t('Backed up to your account.') : data.allLocal ? t('Stored on this phone only.') : ''
  return (where ? where + ' ' : '') + t('Only you see them; Friends never do.')
}

/** A tile's spoken name and caption: the day, and that day's weight when there is one. */
export function tileText(photo, unit) {
  const date = fmtDate(photo.d, true)
  const weight = photo.weight == null ? null : fmtNum(photo.weight) + ' ' + unit
  return { date, weight, label: weight ? date + ' · ' + weight : date }
}
