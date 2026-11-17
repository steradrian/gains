import { fmtPlate } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import ChipGroup from '../../../ds/ChipGroup.jsx'
import GlassValueRow from '../../../ds/GlassValueRow.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StagePage from '../../../ds/StagePage.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import StageSwitch from '../../../ds/StageSwitch.jsx'
import { SETTINGS_ROOT } from '../../settings/paths.js'
import '../coach-pages.css'
import { useGym } from './use-gym.js'

// Gym setup (T12.0, /me/equipment; Settings opens the same page): the equipment profiles, the
// filter they drive, and the plates and dumbbells the workout loads from. Plates and dumbbells are
// the one inventory every profile shares, and the copy says so. Bars and machines are not here:
// the app has no data for them (owner question 8). `find` is a Settings search hit's row.
export default function GymSetup({ find = null }) {
  const gym = useGym(find)
  const { profiles, active, unit } = gym
  return (
    <StagePage largeTitle={t('Gym setup')} sub={t('Used for plate maths and plan fitting')} parent={SETTINGS_ROOT}>
      <div className="tcp">
        <div className="tcp-block" id="gym-profiles">
          <ChipGroup tone="stage" scroll label={t('Equipment')} options={gym.chips} value={active?.id ?? ''} onChange={gym.pick} />
          {active && (
            <p className="tcp-line">
              {t('{0} equipment types', active.equipment.length)} · <button type="button" className="tcp-link" onClick={() => gym.editProfile(active)}>{t('Edit profile')}</button>
            </p>
          )}
        </div>

        {profiles.length > 0 && (
          <div className="g-glist g-glass" id="gym-filter">
            <GlassValueRow static title={t('Filter by equipment')}
              sub={t('Filters the exercise library and picker, and flags routine exercises that need something you don’t have in the active profile.')}
              trailing={<StageSwitch label={t('Filter by equipment')} checked={gym.filterOn} onChange={gym.setFilter} />} />
          </div>
        )}

        <div className="tcp-block" id="gym-plates">
          <StageSection title={t('Plates')} action={unit} />
          <div className="g-glist g-glass">
            {gym.plates.length > 0
              ? gym.plates.map(p => <GlassValueRow key={p.w} title={`${fmtPlate(p.w)} ${unit}`} value={`× ${p.n}`} onClick={gym.openPlates} />)
              : <GlassValueRow title={t('None')} onClick={gym.openPlates} />}
          </div>
          <p className="tcp-sub">{t('Pairs of each size you own, the same in every profile. Set rows load from this list.')}</p>
          <p className="tcp-sub">{gym.ownPlates ? t('Your own list for {0}.', unit) : t('Standard set. Tap to count the pairs you own.')}</p>
        </div>

        <div className="tcp-block" id="gym-bells">
          <StageSection title={t('Dumbbells')} action={unit} />
          <div className="g-glist g-glass">
            <GlassValueRow onClick={gym.openBells}
              title={gym.bells.length ? gym.bells.map(fmtPlate).join(' · ') : t('Any weight. Tap to list the ones you own.')} />
          </div>
          <p className="tcp-sub">{t('The bells you own, the same in every profile. Progression and the + and − buttons of dumbbell lifts land on these.')}</p>
        </div>

        <StageNote>{t('Ready-made plans can fit to this profile, and the workout shows which plates to load.')}</StageNote>
      </div>
    </StagePage>
  )
}
