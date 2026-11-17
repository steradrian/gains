import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import { nav } from '../../../lib/nav.js'
import { useStore } from '../../../store/useStore.js'
import CustomExerciseForm from '../../../components/CustomExerciseForm.jsx'
import StagePage from '../../../ds/StagePage.jsx'
import { deleteCustomEx, exerciseDetailSheet } from '../../../sheets.jsx'

const PARENT = '/train/exercises'
const WALK_OFF_MS = 400

// Back to where the page was opened from, then `then` once the router has landed there, so a drawer
// opened next sits on that page's entry and not on this one's. A deep link has nowhere to go back
// to and goes to the Exercises page instead.
function leave(then) {
  const canGoBack = Number(globalThis.history?.state?.idx) > 0
  if (!canGoBack) { nav(PARENT, { replace: true }); then?.(); return }
  if (!then) { nav(-1); return }
  let done = false
  const go = () => {
    if (done) return
    done = true
    clearTimeout(timer)
    globalThis.removeEventListener('popstate', go)
    then()
  }
  const timer = setTimeout(go, WALK_OFF_MS)
  globalThis.addEventListener('popstate', go)
  nav(-1)
}

// T6.4 Create exercise, /train/exercises/new, and the same form for an edit (?edit=<id>). A create
// goes back and opens the new exercise's drawer; a delete goes back. The exercise being edited is
// read once, so the page does not swap under the person when the delete lands.
export default function CreateExercise() {
  const [params] = useSearchParams()
  const editId = params.get('edit')
  // Exercises' "Create your own" after a search carries the search text as the name to start from.
  const prefill = params.get('name') || ''
  const [existing] = useState(() => (editId ? (useStore.getState().S.customEx || []).find(c => c.id === editId) || null : null))
  const editing = !!existing
  return (
    <StagePage largeTitle={editing ? t('Edit exercise') : t('New exercise')} sub={t('Works just like any other exercise')}>
      {editId && !editing
        ? <p className="g-cxf-gone">{t('This exercise is no longer here.')}</p>
        : <CustomExerciseForm key={editId || 'new'} existing={existing} prefill={prefill} tone="stage"
            onSaved={(ex, { created }) => leave(created && ex ? () => exerciseDetailSheet(ex) : undefined)}
            onDelete={editing ? () => deleteCustomEx(existing, () => leave()) : undefined} />}
    </StagePage>
  )
}
