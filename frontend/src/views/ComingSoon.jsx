import { t } from '../lib/i18n.js'
import { goBack } from '../lib/nav.js'
import Icon from '../components/Icon.jsx'

// The screens of the unified app that exist as routes before they exist as features: the four
// Nutrition tabs and Wellness. Each says plainly what will be here, instead of a blank page.
const SCREENS = {
  diary: { icon: 'note', title: () => t('Diary'), body: () => t('Log meals and see the day’s calories and macros here.') },
  foods: { icon: 'list', title: () => t('Foods'), body: () => t('Your foods, meals and recipes will live here.') },
  stats: { icon: 'chart', title: () => t('Stats'), body: () => t('Calorie and macro trends will show here.') },
  goals: { icon: 'target', title: () => t('Goals'), body: () => t('Calorie, macro and water targets will be set here.') },
  wellness: { icon: 'heart', title: () => t('Wellness'), body: () => t('Sleep, recovery and synced health data will show here.'), pushed: true },
}

export default function ComingSoon({ screen }) {
  const s = SCREENS[screen]
  return <div className="narrow">
    {s.pushed
      ? <div className="hdr"><button className="iconbtn" onClick={goBack} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
          <div className="coming-title"><h1>{s.title()}</h1></div></div>
      : <div className="hdr"><div><h1>{s.title()}</h1></div></div>}
    <div className="empty">
      <div className="ico"><Icon name={s.icon} /></div>
      <strong>{t('Coming in the next update')}</strong>
      <div>{s.body()}</div>
    </div>
  </div>
}
