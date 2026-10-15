import { t } from '../lib/i18n.js'
import { settingOf, useNtSettings } from '../lib/nutrition/use-nt-settings.js'
import { Section } from './ui.jsx'
import NtChoiceRow from './NtChoiceRow.jsx'
import NtSwitchRow from './NtSwitchRow.jsx'

// Profile › Foods & scanning (ia-proposal §5; NutriTrace Settings › Foods): what each row of the
// Foods, Meals and Recipes lists shows, the search source and order, and the barcode scanner and
// photo crop. The scanner's flashlight is a device setting NutriTrace never syncs, and Yesterday's
// meals is not one the hub lets through, so neither is here.
export default function FoodsSettings() {
  const { data } = useNtSettings()
  const sorts = [
    { value: 'alpha', label: t('A to Z') },
    { value: 'recent', label: t('Most recent') },
    { value: 'most', label: t('Most used') },
  ]
  const source = settingOf(data, 'foodsDefaultSource')
  // A source that is switched off is offered only while it is the one chosen, so the row never
  // shows a bare key.
  const sources = [
    { value: 'all', label: t('All sources') },
    { value: 'local', label: t('Your foods') },
    ...(settingOf(data, 'offEnabled') || source === 'off' ? [{ value: 'off', label: t('Open Food Facts') }] : []),
    ...(settingOf(data, 'usdaEnabled') || source === 'usda' ? [{ value: 'usda', label: t('USDA') }] : []),
  ]
  return <>
    <Section title={t('Food rows')} footer={t('What shows on each row in the Foods, Meals and Recipes lists.')}>
      <NtSwitchRow k="foodsShowThumbnails" icon="image" tint="var(--teal)" title={t('Show thumbnails')} />
      <NtSwitchRow k="foodsShowCategories" icon="list" tint="var(--indigo)" title={t('Show categories')} />
      <NtSwitchRow k="foodsShowLabels" icon="flag" tint="var(--orange)" title={t('Show category labels')} />
      <NtSwitchRow k="foodsShowNotes" icon="note" tint="var(--blue)" title={t('Show notes')} />
    </Section>
    <Section title={t('Search and order')} footer={t('Favorites stay at the top of Foods whatever the order.')}>
      <NtChoiceRow k="foodsDefaultSource" icon="magnifier" tint="var(--blue)" title={t('Search in')} options={sources} />
      <NtChoiceRow k="foodsSort" icon="apple" tint="var(--green)" title={t('Foods order')} options={sorts} />
      <NtChoiceRow k="mealsSort" icon="utensils" tint="var(--orange)" title={t('Meals order')} options={sorts} />
      <NtChoiceRow k="recipesSort" icon="cookingPot" tint="var(--red)" title={t('Recipes order')} options={sorts} />
    </Section>
    <Section title={t('Camera and scanning')}>
      <NtSwitchRow k="barcodeBeep" icon="speaker" tint="var(--pink)" title={t('Beep when a barcode scans')} />
      <NtSwitchRow k="cropPhotos" icon="camera" tint="var(--purple)" title={t('Crop photos')} />
    </Section>
  </>
}
