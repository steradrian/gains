import { t } from '../../lib/i18n.js'
import GlassList from '../../ds/GlassList.jsx'
import StageNote from '../../ds/StageNote.jsx'
import { neverShared } from '../../lib/friends/share-copy.js'

const ICON = { training: 'dumbbell', consistency: 'calendar', targets: 'target', bests: 'trophy' }

// "What friends see" (boards Fr1Groups, Fr1Empty, Fr1Left): the person first, then one row for
// each thing their switches let through (share-copy.js previewRows, which leaves out every line
// the data cannot back), then the fixed promise of what is never shared. It is only said: the
// way to change it is Edit on the section above.
export default function SharePreview({ name, rows }) {
  const items = [
    { icon: 'personCircle', title: name || t('You'), sub: t('What friends see') },
    ...rows.map(r => ({ icon: ICON[r.key], title: r.title, sub: r.sub })),
  ]
  return (
    <>
      <div className="g-sp-card"><GlassList items={items} /></div>
      <StageNote>{neverShared()}</StageNote>
    </>
  )
}
