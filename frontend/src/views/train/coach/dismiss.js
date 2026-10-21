// Dismissing what the Coach proposed, from the Coach page or the Plan screen's banner (T3.2): the
// suggestions hide at once and the toast (T11.3) offers Undo for 8 s; nothing is recorded or sent
// until it closes (lib/coach-dismiss.js). There is no confirm (owner question 7).
import { t, tn } from '../../../lib/i18n.js'
import { dismissWithUndo } from '../../../lib/coach-dismiss.js'
import { useUI } from '../../../store/useUI.js'

/** Dismisses `proposal` with Undo and says so; `onCommit` runs once the dismissal is sent. */
export function dismissSuggestions(proposal, { onCommit } = {}) {
  const { count, undo } = dismissWithUndo(proposal, { onCommit })
  const toast = useUI.getState().toast
  const text = proposal.kind === 'create'
    ? t('Plan discarded. Your Plan stays as it is')
    : tn('Dismissed {0} suggestion. Your Plan stays as it is', 'Dismissed {0} suggestions. Your Plan stays as it is', count)
  // A toast held under a finger can outlive the window; by then the dismissal has been sent.
  toast(text, { action: t('Undo'), onAction: () => { if (!undo()) toast(t('Already dismissed. Ask for a fresh review to see them again.')) } })
}
