import { useState } from 'react'
import { useStore } from '../../../store/useStore.js'
import { t } from '../../../lib/i18n.js'
import { LOOKS, lookLabel } from '../../../lib/stage-look/index.js'
import { useRadioGroup } from '../../../lib/onboarding/use-radio-group.js'
import { useDsAccent } from '../../../lib/use-ds-accent.js'
import { useStageLook } from '../../../lib/use-stage-look.js'
import { haptic as buzz } from '../../../lib/use-haptic.js'
import GlassValueRow from '../../../ds/GlassValueRow.jsx'
import LookTile from '../../../ds/LookTile.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import StageSlider from '../../../ds/StageSlider.jsx'
import { settingsPath } from '../paths.js'
import SettingsPage from '../SettingsPage.jsx'

// The two looks the lab marks as dramatic; the rest read as texture at its default.
const DRAMATIC = ['silk', 'bloom']

export default function BackgroundPage() {
  const update = useStore(s => s.update)
  const accent = useDsAccent()
  const { look, intensity, motion } = useStageLook()
  // The strength while the thumb is down: the tiles preview it, the store hears it on release.
  const [dragging, setDragging] = useState(null)
  const shown = dragging ?? intensity

  const pickLook = id => {
    if (id !== look) update(s => { s.bgLook = id })
  }
  // The haptic of a tile is its own; a key press through the group ticks here.
  const { tabIndexOf, onKeyDown } = useRadioGroup(LOOKS, look, id => { buzz('selection'); pickLook(id) })
  const commit = v => {
    setDragging(null)
    update(s => { s.bgIntensity = Math.min(1, Math.max(0, v)) })
  }

  return (
    <SettingsPage title={t('Background')} parent={settingsPath('appearance')}
      line={look === 'plain' ? t('Tap a look: this page shows it at inner-page strength') : `${lookLabel(look)} · ${t('tab roots full, inner pages half')}`}>
      <StageNote>{t('One look under every screen on the stage, in your accent. Tab roots draw it at the strength you pick; inner pages like this one at half, so lists stay easy to read.')}</StageNote>
      <div className="g-lgrid" role="radiogroup" aria-label={t('Background')} onKeyDown={onKeyDown}>
        {LOOKS.map(id => (
          <LookTile key={id} look={id} accent={accent} intensity={shown} label={lookLabel(id)} selected={id === look}
            tabIndex={tabIndexOf(id)} onSelect={pickLook} />
        ))}
      </div>

      <StageSection title={t('Intensity')} />
      {look === 'plain' ? (
        <StageNote>{t('Classic has no intensity: it is the stage itself.')}</StageNote>
      ) : (
        <>
          <StageSlider label={t('Intensity')} minLabel={t('Quiet')} maxLabel={t('Bold')} value={shown} onChange={setDragging} onCommit={commit} />
          <StageNote>{t('Around 40 to 50% a look reads as texture, not a picture.')}</StageNote>
          {DRAMATIC.includes(look) && <StageNote>{t('More dramatic; keep at 35% or less.')}</StageNote>}
        </>
      )}

      <StageSection title={t('Built in')} />
      <div className="g-glist g-glass">
        <GlassValueRow static icon="info" title={t('Calm behind the ring')} sub={t('The look steps back where the hero number sits')} value={t('Always on')} />
        <GlassValueRow static icon="info" title={t('Quiet under cards')} sub={t('It settles to the plain stage under the header and cards')} value={t('Always on')} />
        <GlassValueRow static icon="info" title={t('Slow drift')} sub={t('A 40 s loop. Stops when Reduce motion is on')} value={motion ? t('Follows phone') : t('Still')} />
      </div>
    </SettingsPage>
  )
}
