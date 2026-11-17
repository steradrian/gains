import { useEffect, useSyncExternalStore } from 'react'
import { useStore } from '../../../store/useStore.js'
import { t } from '../../../lib/i18n.js'
import { syncMedia } from '../../../lib/media-sync.js'
import { getMediaStatus, subscribeMediaStatus, waitingRefCount } from '../../../lib/media-owed.js'
import { fmtMB, MB } from '../../../lib/media-limits.js'
import { Section, Row } from '../../../components/ui.jsx'

/* Settings → Data → "Photos & videos": how much of the server's space they take and what is still
   waiting to go up; a tap sends what is waiting now, offers again what the server refused, and
   lets a device that showed a file as missing ask for it again. On a device without a server that
   stores media, it says they are kept here only. */
function MediaRow() {
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const config = useStore(s => s.config)
  const status = useSyncExternalStore(subscribeMediaStatus, getMediaStatus)
  // Signed in, the files go to the server unless it has said it stores none. A config not known
  // yet — a phone started without a network; it is not kept between starts — is not that answer:
  // what is waiting is counted as waiting (and goes up once the server answers), not called
  // local-only as a guest's files are.
  const remote = !!user && (config == null || !!config.media)
  useEffect(() => { if (remote) syncMedia() }, [remote])
  const pending = remote ? waitingRefCount(S) : 0
  const u = status.usage
  const usage = remote && u && u.quotaBytes > 0
    ? t('{0} of {1} MB used on your server', fmtMB((u.bytes || 0) / MB), fmtMB(Math.round(u.quotaBytes / MB)))
    : null
  const sub = remote
    ? [usage, pending ? t('{0} waiting to upload', pending) : null].filter(Boolean).join(' · ') || undefined
    : t('Kept on this device only. Export with photos & videos keeps a copy.')
  return <Row icon="image" iconTint="var(--teal)" title={t('Photos & videos')} subtitle={sub}
    onClick={remote ? () => syncMedia({ force: true, retryRejected: true }) : undefined} />
}

export default function MediaPage() {
  return <Section><MediaRow /></Section>
}
