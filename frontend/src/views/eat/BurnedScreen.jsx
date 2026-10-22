import { t } from '../../lib/i18n.js'
import { loadErrorText } from '../../lib/nutrition/log-feedback.js'
import GlassList from '../../ds/GlassList.jsx'
import GlassValueRow from '../../ds/GlassValueRow.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageNote from '../../ds/StageNote.jsx'
import StagePage from '../../ds/StagePage.jsx'
import StageSection from '../../ds/StageSection.jsx'
import './burned.css'

// Every empty state is a scene, never a bare icon (owner rule).
const SCENE = 'chart'

// Burned on the stage (boards Ea7Burned and the empty week), pushed under Eat: the week's figure,
// what Burned does to the target, then the rows by day. A row with no number reads "0 kcal" and
// opens the drawer that adds one; the line under the list says so. It draws what useBurned()
// gives it (use-burned.js) and keeps nothing.
export default function BurnedScreen({ status, error, title, sub, note, groups, missing, empty, failed, canLog = true, onLog, onRetry }) {
  return (
    <StagePage
      title={t('Burned')}
      parent="/food"
      actions={canLog ? [{ icon: 'plus', label: t('Log activity'), onClick: onLog }] : []}
      largeTitle={title}
      sub={sub}
    >
      {status === 'error' && <StageEmpty card={false} illustration={SCENE} title={loadErrorText(error)} />}
      {status === 'ready' && failed && (
        <StageEmpty card={false} illustration={SCENE} title={t('Could not load this week')} action={t('Retry')} onClick={onRetry} />
      )}
      {status === 'ready' && !failed && empty && (
        <StageEmpty card={false} illustration={SCENE} title={t('Nothing burned logged this week')} action={canLog ? t('Log activity') : undefined} onClick={canLog ? onLog : undefined} />
      )}
      {status === 'ready' && !failed && !empty && <>
        {note && <div className="burned-gut"><GlassList items={[{ icon: 'info', title: note.title, sub: note.body }]} /></div>}
        {groups.map(g => (
          <section key={g.id}>
            <StageSection title={g.title} />
            <div className="burned-gut">
              <div className="g-glist g-glass">
                {g.items.map(({ key, ...row }) => <GlassValueRow key={key} {...row} />)}
              </div>
            </div>
          </section>
        ))}
        {missing.map(m => <StageNote key={m.key}>{m.text}</StageNote>)}
      </>}
      {status === 'ready' && !canLog && <StageNote>{t('Logging activity arrives soon')}</StageNote>}
    </StagePage>
  )
}
