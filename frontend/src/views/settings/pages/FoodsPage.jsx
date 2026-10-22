import { t } from '../../../lib/i18n.js'
import { settingOf, useNtSettings } from '../../../lib/nutrition/use-nt-settings.js'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import NtSettingsPage, { NtSegmentSetting, NtSwitchSetting } from '../nt-setting-rows.jsx'

const line = data => [
  { alpha: t('A to Z first'), recent: t('Most recent first'), most: t('Most used first') }[settingOf(data, 'foodsSort')],
  settingOf(data, 'barcodeBeep') ? t('beep on') : t('beep off'),
].join(' · ')

// Foods and scanning (board St1Foods, A1.22): what each row of the Foods page shows, the source it
// opens on and the order of Foods, Meals and Recipes (views/Foods, views/MealCatalog), and the
// barcode scanner's beep (ScanSheet). Not here: the flashlight is a device setting NutriTrace never
// syncs, Yesterday's meals is not one the hub lets through, and Gains has no thumbnails in these
// lists or photo crop.
export default function FoodsPage() {
  return <NtSettingsPage title={t('Foods & scanning')} line={line}><FoodsBody /></NtSettingsPage>
}

function FoodsBody() {
  const { data } = useNtSettings()
  const sorts = [
    { value: 'alpha', label: t('A to Z') },
    { value: 'recent', label: t('Most recent') },
    { value: 'most', label: t('Most used') },
  ]
  const source = settingOf(data, 'foodsDefaultSource')
  // Foods opens on your foods (`local`) or on the Open Food Facts tab (`off`); Gains has no other
  // source, so `all` and `usda` (which NutriTrace offers) would do what `local` does. They show
  // only while one of them is what NutriTrace has stored, marked as legacy, so the row never shows
  // a bare key. Open Food Facts is offered while it is on, or while it is the stored value.
  const sources = [
    ...(source === 'all' ? [{ value: 'all', label: t('{0} (legacy)', t('All sources')) }] : []),
    { value: 'local', label: t('Your foods') },
    ...(settingOf(data, 'offEnabled') || source === 'off' ? [{ value: 'off', label: t('Open Food Facts') }] : []),
    ...(source === 'usda' ? [{ value: 'usda', label: t('{0} (legacy)', t('USDA')) }] : []),
  ]
  return <>
    <div className="g-glist g-glass">
      <NtSwitchSetting k="foodsShowCategories" icon="list" title={t('Show categories')} sub={t('Group My foods by category')} />
      <NtSwitchSetting k="foodsShowLabels" icon="flag" title={t('Show category labels')} sub={t('A coloured tag on each food')} />
      <NtSwitchSetting k="foodsShowNotes" icon="note" title={t('Show notes')} sub={t('Your notes under a food name')} />
    </div>
    <StageNote>{t('What shows on each row in the Foods, Meals and Recipes lists.')}</StageNote>

    <StageSection variant="label" title={t('Search and order')} />
    <div className="g-glist g-glass">
      <NtSegmentSetting k="foodsDefaultSource" icon="magnifier" title={t('Search in')} sub={t('Where Log food looks first')} options={sources} />
      <NtSegmentSetting k="foodsSort" icon="apple" title={t('Foods order')} options={sorts} />
      <NtSegmentSetting k="mealsSort" icon="utensils" title={t('Meals order')} options={sorts} />
      <NtSegmentSetting k="recipesSort" icon="cookingPot" title={t('Recipes order')} options={sorts} />
    </div>
    <StageNote>{t('Favorites stay at the top of Foods whatever the order.')}</StageNote>

    <StageSection variant="label" title={t('Scanning')} />
    <div className="g-glist g-glass">
      <NtSwitchSetting k="barcodeBeep" icon="speaker" title={t('Beep when a barcode scans')} sub={t('Off by default')} />
    </div>
  </>
}
