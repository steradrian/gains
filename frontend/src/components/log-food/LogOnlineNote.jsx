import { t } from '../../lib/i18n.js'
import { searchErrorText } from '../../lib/nutrition/foods.js'
import Button from '../../ds/Button.jsx'
import OnlineStatus from '../OnlineStatus.jsx'

// What stands in for Open Food Facts rows (board Ea8Offline): with no connection, or the lookup
// failing, one line that says what still works. Every other status is OnlineStatus's own (searching,
// paused, the one row that asks). Nothing says logs wait to sync: a log with no connection is not
// saved, and says so when tried.
export default function LogOnlineNote({ online, query }) {
  if (online.status === 'offline') return <p className="g-lf-note" role="status">{t('Online results need a connection. Your foods and recents still work.')}</p>
  if (online.status === 'error') return <>
    <p className="g-lf-note g-lf-err" role="alert">{t('Online results did not load. Your foods and recents still work.')} {searchErrorText(online.error)}</p>
    <Button variant="secondary" size="sm" onClick={online.ask}>{t('Retry')}</Button>
  </>
  return <OnlineStatus online={online} query={query} />
}
