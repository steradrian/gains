import { t } from '../lib/i18n.js'
import ChatBubble from '../ds/ChatBubble.jsx'
import ChipGroup from '../ds/ChipGroup.jsx'
import Illustration from '../ds/Illustration.jsx'
import StagePage from '../ds/StagePage.jsx'
import StageSection from '../ds/StageSection.jsx'
import Icon from '../components/Icon.jsx'
import './train/coach/coach-page.css'

// The Coach while it is off (lib/coach-availability.js): /train/coach and the pages under it land
// here for everyone. A pushed Train page: the line-art scene, one warm line on what the Coach will
// do, then a preview of three of its surfaces, built from the real kit and filled with sample data.
// The preview is `inert`: nothing in it can be focused, pressed or read out as a control, and
// nothing in it writes or opens anything. "Preview" is said in the heading above it.
const noop = () => {}

export default function CoachSoon() {
  return (
    <StagePage parent="/train" largeTitle={t('Your coach is still warming up')}
      sub={t('It will read your training and check-ins, then suggest changes to your week. Nothing moves until you approve it.')}>
      <div className="tcs">
        <Illustration name="coach" tone="stage" draw width={260} />

        <section className="tcs-prev" aria-label={t('Preview')}>
          <StageSection title={t('A peek at what it will do')} action={t('Preview')} />
          <div className="tcs-cards" inert>
            <ChatBubble who={t('Coach')} text={t('Three of four sessions done this week. Your squat is ready for 102.5 kg × 5.')} />

            <div className="tco-rows g-glass">
              <div className="tco-chg">
                <span className="tco-chg-body">
                  <b>{t('Move Legs to Thursday')}</b>
                  <span>{t('You’ve missed Mondays three weeks running')}</span>
                </span>
                <span className="tco-chg-mark tcs-on" aria-hidden="true"><Icon name="check" className="g-icon" /></span>
              </div>
            </div>

            <div className="tcs-card g-glass">
              <b>{t('Check in')}</b>
              <p className="tcs-label">{t('How the week felt')}</p>
              <ChipGroup tone="stage" label={t('How the week felt')} value="right" onChange={noop}
                options={[{ value: 'easy', label: t('Too easy') }, { value: 'right', label: t('Just right') }, { value: 'hard', label: t('Hard') }]} />
              <p className="tcs-label">{t('Sleep')}</p>
              <ChipGroup tone="stage" label={t('Sleep')} value="good" onChange={noop}
                options={[{ value: 'poor', label: t('Poor') }, { value: 'ok', label: t('OK') }, { value: 'good', label: t('Good') }]} />
            </div>
          </div>
        </section>
      </div>
    </StagePage>
  )
}
