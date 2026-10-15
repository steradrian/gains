import { t } from '../../lib/i18n.js'
import { Button } from '../ui.jsx'
import { InlineNote, Skeleton } from '../blocks.jsx'

// A slow source's place while it is not rows (ui-search.md §9): two skeleton rows on the rows' own
// geometry, so nothing below moves when they land, or one quiet line saying why there are none.
export function SkeletonRows() {
  return <div className="sr-skel" aria-hidden="true">
    {[[58, 34], [46, 40]].map(([title, sub], i) => (
      <div key={i} className="sr-skel-row">
        <Skeleton w={48} h={48} r={8} />
        <span className="sr-skel-t"><Skeleton w={title + '%'} h={12} /><Skeleton w={sub + '%'} h={10} /></span>
        <Skeleton w={36} h={12} />
      </div>
    ))}
  </div>
}

/**
 * kind: 'paused' (`seconds` left: "Open Food Facts paused · back in 12 s"), 'error' (`onRetry`),
 * 'offline' (Online: back when you reconnect), 'offline-days' (Days: a connection the first time),
 * 'indexing' (Days still loading the first time, searchable over what landed).
 */
export function SourceNote({ kind, seconds, onRetry, source }) {
  if (kind === 'paused') {
    return <InlineNote icon="hourglass" className="sr-note">
      {t('{0} paused · back in', source)} <b className="sr-count">{t('{0} s', seconds)}</b>
    </InlineNote>
  }
  if (kind === 'error') {
    return <div className="sr-note-row">
      <InlineNote icon="warning" className="sr-note err">{t('Couldn’t reach {0}', source)}</InlineNote>
      <Button size="sm" variant="plain" onClick={onRetry}>{t('Retry')}</Button>
    </div>
  }
  if (kind === 'offline') return <InlineNote icon="cloudSlash" className="sr-note">{t('Online results come back when you reconnect')}</InlineNote>
  if (kind === 'offline-days') return <InlineNote icon="cloudSlash" className="sr-note">{t('Days need a connection the first time')}</InlineNote>
  if (kind === 'indexing') return <InlineNote icon="hourglass" className="sr-note">{t('Still indexing your diary')}</InlineNote>
  return null
}
