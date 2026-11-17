import { useRef } from 'react'
import { t } from '../../../lib/i18n.js'
import { useDsAccent } from '../../../lib/use-ds-accent.js'
import Button from '../../../ds/Button.jsx'
import ChangeRow from '../../../ds/ChangeRow.jsx'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import StageNavBar from '../../../ds/StageNavBar.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StagePageTitle from '../../../ds/StagePageTitle.jsx'
import StageScreen from '../../../ds/StageScreen.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import Tag from '../../../ds/Tag.jsx'
import { entryDetail, entryTitle, isUndo } from './changes-data.js'
import './changes.css'

// Me > Recent changes (boards M4.0 Me4Changes, M4.1 Me4Restored, M4.2 Me4Empty), a pushed page on
// the stage: the last 7 days of deletes and changes, a header per day, each row with a Restore (or
// Undo, for the Coach's own log). It draws what useChanges() gives it and holds nothing.
//
//   days        [{ key, label, items }] from groupByDay; items are journal entries
//   restoredIds the entries put back (a "Restored" tag instead of the button); alreadyIds the ones
//               that were already back ("Already back")
//   busyIds     entries being restored right now: their button is busy and ignores a second tap
//   onRestore   (entry) => Promise<boolean>; true when the entry is back, so focus can leave the
//               button that just turned into a tag
//   unit        the person's weight unit, for entries that did not record one
//
// The page's one h1 is the large title; focus moves to it when a button is replaced by its tag.
export default function ChangesScreen({ days, restoredIds, alreadyIds, busyIds, unit, onRestore, onBack }) {
  const accent = useDsAccent()
  const heading = useRef(null)
  const empty = !days.length
  const restore = async entry => {
    if (await onRestore(entry)) heading.current?.focus()
  }
  const control = entry => {
    if (restoredIds.has(entry.id)) return <Tag tone="glass" icon="check">{t('Restored')}</Tag>
    if (alreadyIds.has(entry.id)) return <Tag tone="glass">{t('Already back')}</Tag>
    const label = isUndo(entry) ? t('Undo') : t('Restore')
    return (
      <Button size="sm" variant="glass" busy={busyIds.has(entry.id)} aria-label={t('{0}: {1}', label, entryTitle(entry, { unit }))}
        onClick={() => restore(entry)}>{label}</Button>
    )
  }

  return (
    <StageScreen accent={accent}>
      <div className="chg">
        <StageNavBar onBack={onBack} />
        <StagePageTitle ref={heading} title={t('Recent changes')} line={empty ? null : t('Deletes and changes from the last 7 days')} />
        {empty
          ? <StageEmpty card={false} illustration="calendar" title={t('Nothing in the last 7 days')}
            body={t('When you delete or change something, it waits here for 7 days so you can put it back.')} />
          : <>
            {days.map(day => (
              <section key={day.key} className="chg-day">
                <StageSection variant="label" title={day.label} />
                <div className="chg-list">
                  {day.items.map(entry => (
                    <ChangeRow key={entry.id} title={entryTitle(entry, { unit })} detail={entryDetail(entry, { unit })} trailing={control(entry)} />
                  ))}
                </div>
              </section>
            ))}
            <StageNote>{t('Restoring puts it back where it was: the same day, the same meal, the same workout.')}</StageNote>
          </>}
      </div>
    </StageScreen>
  )
}
