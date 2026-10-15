import { t } from '../lib/i18n.js'
import { DEFAULT_GOAL_HOURS, PLANS } from '../lib/nutrition/fasting.js'
import { settingOf, useNtSettings } from '../lib/nutrition/use-nt-settings.js'
import { Section, SelectRow } from './ui.jsx'
import MealNamesSettings from './MealNamesSettings.jsx'
import NtChoiceRow from './NtChoiceRow.jsx'
import NtSwitchRow from './NtSwitchRow.jsx'

// Profile › Diary & meals (ia-proposal §5; NutriTrace Settings › Diary): what the diary shows on a
// food row and a meal card, quick calories, the activity section under the meals, the default
// fasting plan and the meal names. Saved one key at a time; a refused save keeps the old value and
// says so. The calorie target's own activity switch is on Goals, and the diary's side widgets are
// not settings the hub lets through.
export default function DiaryMealsSettings() {
  const { data, save } = useNtSettings()
  const hours = Number(data.fastingDefaultHours) || DEFAULT_GOAL_HOURS
  const activityCounts = settingOf(data, 'diaryShowActivity') && data.calorieAdjustFromActivity === true
  return <>
    <Section title={t('Food rows')} footer={t('What shows under each food in the diary.')}>
      <NtSwitchRow k="diaryShowBrands" icon="apple" tint="var(--green)" title={t('Show brand names')} />
      <NtSwitchRow k="diaryShowTimestamps" icon="clock" tint="var(--purple)" title={t('Show time logged')} />
      <NtSwitchRow k="diaryShowThumbnails" icon="image" tint="var(--teal)" title={t('Show food photos')} />
      <NtSwitchRow k="diaryShowAllNutrients" icon="list" tint="var(--indigo)" title={t('Show every nutrient')}
        subtitle={t('In a meal’s totals: vitamins and minerals too, not just the macros.')} />
      <NtSwitchRow k="diaryShowNutritionUnits" icon="ruler" tint="var(--blue)" title={t('Show nutrition units')}
        subtitle={t('g, mg and so on after the numbers.')} />
      <NtSwitchRow k="diaryShowPortionSize" icon="scale" tint="var(--orange)" title={t('Show portion size')}
        subtitle={t('150 g or 1 cup on each entry.')} />
    </Section>
    <Section title={t('Meal cards')}>
      <NtSwitchRow k="diaryShowMacroSummary" icon="chart" tint="var(--teal)" title={t('Show macro summary')}
        subtitle={t('Protein, carbs and fat at the bottom of each meal.')} />
      <NtSwitchRow k="diaryPromptQuantity" icon="plusCircle" tint="var(--green)" title={t('Ask for quantity when adding')}
        subtitle={t('Otherwise a food is added at its own portion.')} />
      <NtChoiceRow k="diaryDefaultField" icon="pencil" tint="var(--blue)" title={t('Quantity starts in')} options={[
        { value: 'servings', label: t('Number of servings') },
        { value: 'portion', label: t('Serving size') },
      ]} />
      <NtSwitchRow k="diaryShowNotes" icon="note" tint="var(--orange)" title={t('Show day notes')} />
      <NtSwitchRow k="diaryShowCompletion" icon="checkCircle" tint="var(--green)" title={t('Show day completion')}
        subtitle={t('A check to close each day once everything is logged.')} />
    </Section>
    <Section title={t('Nutrition units')} footer={t('Both off unless you log liquids in grams or use custom serving units.')}>
      <NtSwitchRow k="showUnitMetadata" icon="ruler" tint="var(--teal)" title={t('Show unit details')}
        subtitle={t('Per 100 g or ml, serving units and density in the food editor.')} />
      <NtSwitchRow k="warnUnitMismatch" icon="warning" tint="var(--orange)" title={t('Warn about unit conversions')}
        subtitle={t('When a weight unit meets a food measured per 100 ml, or the other way round.')} />
    </Section>
    <Section title={t('Quick calories')}>
      <NtSwitchRow k="showQuickCalories" icon="bolt" tint="var(--yellow)" title={t('Show quick calories')}
        subtitle={t('A fast calories-only entry on each meal.')} />
      {settingOf(data, 'showQuickCalories') && <NtChoiceRow k="quickCaloriesDisplay" icon="list" tint="var(--indigo)" title={t('Quick calories shown')} options={[
        { value: 'summed', label: t('Added into one row') },
        { value: 'separate', label: t('One row each') },
      ]} />}
    </Section>
    <Section title={t('Diary')} footer={t('Off also stops workouts counting toward your calorie target.')}>
      <NtSwitchRow k="diaryShowActivity" icon="flame" tint="var(--orange)" title={t('Show activity under meals')}
        subtitle={t('Workouts and other activity, with the calories they burned, on Home.')} />
      {activityCounts && <NtChoiceRow k="manualActivityPolicy" icon="swap" tint="var(--indigo)" title={t('Wearable and manual entries')} options={[
        { value: 'wearable_wins', label: t('Wearable wins'), subtitle: t('Only the wearable counts on days you have both.') },
        { value: 'manual_wins', label: t('Manual wins'), subtitle: t('Only what you logged counts on days you have both.') },
        { value: 'additive', label: t('Add them'), subtitle: t('Both count on days you have both.') },
      ]} />}
    </Section>
    {data.fastingEnabled === true && <Section title={t('Fasting')}>
      <SelectRow icon="timer" iconTint="var(--indigo)" title={t('Default fasting plan')} value={hours}
        onChange={v => save('fastingDefaultHours', v)}
        options={PLANS.map(p => ({ value: p.hours, label: p.label, subtitle: t('{0} h fast', p.hours) }))} />
    </Section>}
    <MealNamesSettings />
  </>
}
