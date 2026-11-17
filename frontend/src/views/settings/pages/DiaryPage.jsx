import { t } from '../../../lib/i18n.js'
import { mealsOf } from '../../../lib/nutrition/diary.js'
import { DEFAULT_GOAL_HOURS, PLANS } from '../../../lib/nutrition/fasting.js'
import { mealLabels } from '../../../lib/nutrition/meal-name.js'
import { MEAL_NAMES_MAX } from '../../../lib/nutrition/settings-lists.js'
import { settingOf, useNtSettings } from '../../../lib/nutrition/use-nt-settings.js'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import StageSegmented from '../../../ds/StageSegmented.jsx'
import SettingRow from '../SettingRow.jsx'
import NtSettingsPage, { NtSegmentSetting, NtSwitchSetting } from '../nt-setting-rows.jsx'
import { openMealSheet } from './meal-sheet.jsx'

const line = data => {
  const n = mealsOf(data).length
  return [n === 1 ? t('1 meal') : t('{0} meals', n), settingOf(data, 'diaryPromptQuantity') ? t('quantity asked') : t('quantity not asked')].join(' · ')
}

// Diary and meals (board St1Diary, A1.18): the meals of a day and what Home shows for each, how
// food is added, quick calories, the activity rows under the meals and the default fasting plan.
// Each row changes a Gains screen (MealRow, FoodPicker, PortionSheet, PlusSheet, the activity
// rows) and is saved one key at a time. A tap on a meal opens its drawer (meal-sheet.jsx), where it
// is renamed, moved or deleted. NutriTrace's notes, completion, thumbnails, unit-detail and
// side-widget options are not here: Gains has no screen for them.
export default function DiaryPage() {
  return <NtSettingsPage title={t('Diary & meals')} line={line}><DiaryBody /></NtSettingsPage>
}

function DiaryBody() {
  const { data, save } = useNtSettings()
  const names = mealLabels(data)
  const hours = Number(data.fastingDefaultHours) || DEFAULT_GOAL_HOURS
  const activityCounts = settingOf(data, 'diaryShowActivity') && data.calorieAdjustFromActivity === true
  return <>
    <StageSection variant="label" title={t('Meals')} />
    <div className="g-glist g-glass">
      {names.map((name, slot) => (
        <SettingRow key={slot} icon="utensils" title={name} sub={t('Tap to rename or move')} onClick={() => openMealSheet(slot)} />
      ))}
      {names.length < MEAL_NAMES_MAX && (
        <SettingRow icon="plusCircle" title={t('Add a meal')} sub={t('Up to {0} · e.g. Pre-workout', MEAL_NAMES_MAX)} onClick={() => openMealSheet(names.length)} />
      )}
    </div>
    <StageNote>{t('The order here is the order in the diary. Moving or removing a meal moves what was logged under it.')}</StageNote>

    <StageSection variant="label" title={t('What a meal shows')} />
    <div className="g-glist g-glass">
      <NtSwitchSetting k="diaryShowMacroSummary" icon="chart" title={t('Show macro summary')} sub={t('Protein, carbs and fat under each meal.')} />
      <NtSwitchSetting k="diaryShowBrands" icon="apple" title={t('Show brand names')} />
      <NtSwitchSetting k="diaryShowTimestamps" icon="clock" title={t('Show time logged')} />
      <NtSwitchSetting k="diaryShowActivity" icon="flame" title={t('Show activity under meals')}
        sub={t('Workouts and other activity, with the calories they burned, on Home.')} />
      {activityCounts && <NtSegmentSetting k="manualActivityPolicy" icon="swap" title={t('Wearable and manual entries')}
        sub={t('Which counts on days you have both.')}
        options={[{ value: 'wearable_wins', label: t('Wearable wins') }, { value: 'manual_wins', label: t('Manual wins') }, { value: 'additive', label: t('Add them') }]} />}
    </div>
    <StageNote>{t('Off also stops workouts counting toward your calorie target.')}</StageNote>

    <StageSection variant="label" title={t('Adding food')} />
    <div className="g-glist g-glass">
      <NtSwitchSetting k="diaryPromptQuantity" icon="plusCircle" title={t('Ask for quantity when adding')}
        sub={t('Otherwise a food is added at its own portion.')} />
      <NtSegmentSetting k="diaryDefaultField" icon="pencil" title={t('Quantity starts in')}
        options={[{ value: 'servings', label: t('Servings') }, { value: 'portion', label: t('Serving size') }]} />
      <NtSwitchSetting k="showQuickCalories" icon="bolt" title={t('Show quick calories')} sub={t('A fast calories-only entry when you add food.')} />
      <NtSegmentSetting k="quickCaloriesDisplay" icon="list" title={t('Quick calories shown')}
        options={[{ value: 'summed', label: t('Added into one row') }, { value: 'separate', label: t('One row each') }]} />
    </div>

    {data.fastingEnabled === true && <>
      <StageSection variant="label" title={t('Fasting')} />
      <div className="g-glist g-glass">
        <SettingRow icon="timer" title={t('Default fasting plan')}
          below={<StageSegmented label={t('Default fasting plan')} value={hours} options={PLANS.map(p => ({ value: p.hours, label: p.label }))}
            onChange={v => save('fastingDefaultHours', v)} />} />
      </div>
    </>}
  </>
}
