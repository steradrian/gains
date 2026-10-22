import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { workoutDuration } from '../lib/history.js'
import { sameWorkout } from '../lib/workout-date.js'
import { useTogether } from '../lib/friends/use-together.js'
import { useFriendsMe } from '../lib/friends/use-friends.js'
import { setShareBest, setShareOff, setShareTogether, shareOf } from '../lib/friends/workout-share.js'
import StageNote from '../ds/StageNote.jsx'
import StageSection from '../ds/StageSection.jsx'
import { Card, SwitchRow } from '../views/settings/pages/prefs-rows.jsx'

/**
 * The workout summary's "Friends will see" block (board Fr7Summary): one switch per thing this
 * workout can show, for this workout only. Nothing renders unless Friends is on, the person is in a
 * group and shares training (never an empty block). The choices are written on the saved workout
 * (`share`, lib/friends/workout-share.js): "<Workout> done" is the one switch for `share.off` (off
 * keeps the whole workout to yourself and greys the rows under it, which it covers), a new best is
 * the exercise id only, and "Trained together" is
 * `share.together`: off leaves this workout out of the moment, for this person only, and on brings
 * it back. Taking the moment down for the whole group is the group page's Remove this moment.
 * With several groups the rows apply to every one of them.
 */
export default function WorkoutShareBlock({ w, bests }) {
  const { me, on } = useFriendsMe()
  const rec = useStore(s => (s.S.workouts || []).find(x => x && sameWorkout(x, w)))
  const groups = me?.groups || []
  const shown = on && groups.length > 0 && !!me?.share?.training
  const together = useTogether(groups, w, shown)
  if (!shown) return null

  const share = shareOf(rec || w)
  const off = !!share.off
  const withThem = share.together !== false
  const name = w.name || t('Workout')
  const mins = Math.round(workoutDuration(w) / 60000)
  const solo = t('No weights, no sets')

  const names = [...new Set(together.flatMap(x => x.names))]
  const partner = names.length === 0 ? null
    : names.length === 1 ? { title: t('Trained together with {0}', names[0]), sub: t('{0} logged {1} the same day', names[0], name) }
    : { title: t('Trained together with {0} and {1} more', names[0], names.length - 1), sub: t('They logged {0} the same day', name) }

  return (
    <section>
      <StageSection title={groups.length === 1 ? t('Friends will see') : t('Friends')} action={groups.length === 1 ? groups[0].name : undefined} />
      <Card>
        <SwitchRow icon="dumbbell" title={t('{0} done', name)}
          sub={off ? t('Keeps the whole workout to yourself') : mins > 0 ? t('{0} · no weights, no sets', t('{0} min', mins)) : solo}
          checked={!off} onChange={on => setShareOff(w, !on)} />
        {partner && (
          <SwitchRow icon="users" title={partner.title} sub={withThem ? partner.sub : t('Not shown in the group')}
            checked={withThem && !off} disabled={off} onChange={on => setShareTogether(w, on)} />
        )}
        {bests.map(b => (
          <SwitchRow key={b.id} icon="trophy" title={t('New best: {0}', b.name)} sub={t('Shows the exercise, not the weight')}
            checked={(share.best || []).includes(b.id)} disabled={off} onChange={on => setShareBest(w, b.id, on)} />
        ))}
      </Card>
      <StageNote>{t('Each line is one choice for this workout only. Your defaults are in What you share.')}</StageNote>
    </section>
  )
}
