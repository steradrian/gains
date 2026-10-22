import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { workoutDuration } from '../lib/history.js'
import { sameWorkout } from '../lib/workout-date.js'
import { friendsErrorText, removeMoment } from '../lib/friends/api.js'
import { useTogether } from '../lib/friends/use-together.js'
import { useFriendsMe } from '../lib/friends/use-friends.js'
import { setShareBest, setShareOff, shareOf } from '../lib/friends/workout-share.js'
import StageNote from '../ds/StageNote.jsx'
import StageSection from '../ds/StageSection.jsx'
import { Card, SwitchRow } from '../views/settings/pages/prefs-rows.jsx'

/**
 * The workout summary's "Friends will see" block (board Fr7Summary): one switch per thing this
 * workout can show, for this workout only. Nothing renders unless Friends is on, the person is in a
 * group and shares training (never an empty block). The choices are written on the saved workout
 * (`share`, lib/friends/workout-share.js): "Training done" and "Don't share this one" are the two
 * faces of `share.off`, a new best is the exercise id only, and "Trained together" is the server's
 * moment, taken down for the group when it is switched off. With several groups the rows apply to
 * every one of them.
 */
export default function WorkoutShareBlock({ w, bests }) {
  const { me, on } = useFriendsMe()
  const rec = useStore(s => (s.S.workouts || []).find(x => x && sameWorkout(x, w)))
  const groups = me?.groups || []
  const shown = on && groups.length > 0 && !!me?.share?.training
  const together = useTogether(groups, w, shown)
  const [removed, setRemoved] = useState({})
  if (!shown) return null

  const share = shareOf(rec || w)
  const off = !!share.off
  const name = w.name || t('Workout')
  const mins = Math.round(workoutDuration(w) / 60000)
  const solo = t('No weights, no sets')

  const dropTogether = async on => {
    if (on) return
    const rows = together.filter(x => !removed[x.mid])
    setRemoved(r => ({ ...r, ...Object.fromEntries(rows.map(x => [x.mid, true])) }))
    try {
      await Promise.all(rows.map(x => removeMoment(x.gid, x.mid)))
    } catch (e) {
      setRemoved(r => ({ ...r, ...Object.fromEntries(rows.map(x => [x.mid, false])) }))
      useUI.getState().toast(friendsErrorText(e))
    }
  }

  const names = [...new Set(together.flatMap(x => x.names))]
  const gone = together.length > 0 && together.every(x => removed[x.mid])
  const partner = names.length === 0 ? null
    : names.length === 1 ? { title: t('Trained together with {0}', names[0]), sub: t('{0} logged {1} the same day', names[0], name) }
    : { title: t('Trained together with {0} and {1} more', names[0], names.length - 1), sub: t('They logged {0} the same day', name) }

  return (
    <section>
      <StageSection title={groups.length === 1 ? t('Friends will see') : t('Friends')} action={groups.length === 1 ? groups[0].name : undefined} />
      <Card>
        <SwitchRow icon="dumbbell" title={t('{0} done', name)} sub={mins > 0 ? t('{0} · no weights, no sets', t('{0} min', mins)) : solo}
          checked={!off} onChange={on => setShareOff(w, !on)} />
        {partner && (
          <SwitchRow icon="users" title={partner.title} sub={gone ? t('Not shown in the group') : partner.sub}
            checked={!gone && !off} disabled={off || gone} onChange={dropTogether} />
        )}
        {bests.map(b => (
          <SwitchRow key={b.id} icon="trophy" title={t('New best: {0}', b.name)} sub={t('Shows the exercise, not the weight')}
            checked={(share.best || []).includes(b.id)} disabled={off} onChange={on => setShareBest(w, b.id, on)} />
        ))}
        <SwitchRow icon="lock" title={t("Don't share this one")} sub={t('Keeps the whole workout to yourself')}
          checked={off} onChange={on => setShareOff(w, on)} />
      </Card>
      <StageNote>{t('Each line is one choice for this workout only. Your defaults are in What you share.')}</StageNote>
    </section>
  )
}
