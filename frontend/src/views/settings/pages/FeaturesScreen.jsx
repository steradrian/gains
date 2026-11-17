import { t } from '../../../lib/i18n.js'
import Button from '../../../ds/Button.jsx'
import GlassValueRow from '../../../ds/GlassValueRow.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import SettingsPage from '../SettingsPage.jsx'
import { Card, SwitchRow } from './prefs-rows.jsx'

// Settings > Features (boards St1Features, St1FoodOff), drawn from what FeaturesPage hands it and
// holding nothing. Three parts: what the person tracks (Training, Food, Activity), the features
// that start off and have a switch of their own here, and a link row for every other switch that
// starts off, which opens its page with the switch flashed.
//
// `track`: `{ training, food, activity }` are `{ on, disabled, onChange }`; `food` is null where
// there is no diary (the phone app, a guest). `fasting`: null, or `{ on, disabled, error, unread,
// onChange, onRetry }`. `coach`: `{ soon, onOpen }`. `water`: null or `{ on, disabled, onChange }`.
// `extra`: rows other areas add (features-rows.js). `links`: `[{ key, icon, title, sub, value,
// onClick }]`.
export default function FeaturesScreen({ title, line, track, fasting, coach, water, extra = [], links = [] }) {
  const { training, food, activity } = track
  return (
    <SettingsPage title={title} line={line}>
      <StageSection title={t('What you track')} />
      <Card>
        <SwitchRow icon="dumbbell" title={t('Training')} sub={t('Plan, workouts, history, Trends')}
          checked={training.on} disabled={training.disabled} onChange={training.onChange} />
        {food && <SwitchRow icon="utensils" title={t('Food')}
          sub={food.on ? t('Diary, foods, water, the calorie ring') : t('Off · your diary is kept')}
          checked={food.on} disabled={food.disabled} onChange={food.onChange} />}
        <SwitchRow icon="figureRun" title={t('Activity')} sub={t('Runs and sports, counted in Burned')}
          checked={activity.on} disabled={activity.disabled} onChange={activity.onChange} />
      </Card>

      <StageSection title={t('Features')} />
      <Card>
        {fasting && (fasting.unread
          ? <GlassValueRow static icon="timer" title={t('Fasting')} sub={t('Your settings did not load.')}
            trailing={<Button variant="glass" size="sm" onClick={fasting.onRetry}>{t('Try again')}</Button>} />
          : <SwitchRow icon="timer" title={t('Fasting')} sub={fasting.error || t('Adds Fast to the + sheet, with a timer and history.')}
            checked={fasting.on} disabled={fasting.disabled} onChange={fasting.onChange} />)}
        {coach.soon
          ? <SwitchRow icon="chat" title={t('AI Coach')} sub={t('Coming soon')} checked={false} disabled onChange={() => {}} />
          : <GlassValueRow icon="chat" title={t('AI Coach')} sub={t('Adjusts your Plan from how the week went.')} onClick={coach.onOpen} />}
        {extra.map(({ key, ...row }) => <SwitchRow key={key} {...row} />)}
        {water && <SwitchRow icon="droplet" title={t('Water')} sub={t('The water row on Today and Food')}
          checked={water.on} disabled={water.disabled} onChange={water.onChange} />}
      </Card>

      {links.length > 0 && <>
        <StageSection title={t('Off until you turn them on')} />
        <Card>
          {links.map(({ key, ...row }) => <GlassValueRow key={key} {...row} />)}
        </Card>
      </>}
      <StageNote>{t('Tap one to go to its switch. Turning something off hides it; nothing you logged is deleted.')}</StageNote>
    </SettingsPage>
  )
}
