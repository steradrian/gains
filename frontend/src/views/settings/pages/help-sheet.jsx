import { useNavigate } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import { useUI } from '../../../store/useUI.js'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import { PAGES, pageVisible } from '../../settings-pages.js'
import { settingsPath } from '../paths.js'
import { useSettingsCtx } from '../use-settings-ctx.js'

// One Help answer (board St1Help): the question as the title, the answer under it, and a button to
// the page that does the thing, when that page exists for this profile. The answer is already
// short (help-topics.js); a drawer, not a page, keeps the list one tap away.
export function HelpSheet({ topic, close }) {
  const nav = useNavigate()
  const ctx = useSettingsCtx()
  const target = topic.goTo && pageVisible(topic.goTo, ctx) ? topic.goTo : null
  return (
    <BottomSheet title={t(topic.title)}>
      <div className="set-help-answer">
        <p>{t(topic.answer)}</p>
        {target && (
          <Button variant="secondary" block onClick={() => { close(); nav(settingsPath(target)) }}>
            {t('Open {0}', t(PAGES[target].title))}
          </Button>
        )}
      </div>
    </BottomSheet>
  )
}

export const openHelpSheet = topic => useUI.getState().openSheet(close => <HelpSheet topic={topic} close={close} />, { variant: 'ds' })
