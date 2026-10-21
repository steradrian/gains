import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import { Hl } from './SearchRow.jsx'

// A match inside a switched-off feature (board Sh0TurnOn): one glass card with the feature's glyph,
// its name (what matched in bold) and an Off tag, one line on what it does and where it is off,
// then Turn on (white, it flips the feature) and the page with its switch ("Features"). A feature
// result (lib/search/features.js) gives `title`, `ranges`, `line`, `icon` (its media's glyph) and
// `pageTitle`. `busy` holds Turn on while the switch is being written.
export default function SearchFeatureCard({ title, ranges, line, icon, pageTitle, onTurnOn, onOpenPage, busy = false }) {
  return (
    <div className="g-sfeat g-glass">
      <div className="g-sfeat-top">
        <span className="g-sfeat-ic" aria-hidden="true"><Icon name={icon || 'slider'} className="g-icon" /></span>
        <span className="g-sfeat-body">
          {/* The name is read once, whole: the highlight's pieces would each be a VoiceOver stop. */}
          <span className="g-sfeat-name">
            <b><span className="sr-only">{title}</span><span aria-hidden="true"><Hl text={title} ranges={ranges} /></span></b>
            <span className="g-sfeat-off">{t('Off')}</span>
          </span>
          {line && <span className="g-sfeat-line">{line}</span>}
        </span>
      </div>
      <div className="g-sfeat-acts">
        {/* Held with aria-disabled while busy, not disabled, so the focus stays on it. */}
        <button type="button" className="g-sfeat-on" onClick={busy ? undefined : onTurnOn} aria-disabled={busy || undefined} aria-busy={busy || undefined}>
          {t('Turn on {0}', title)}
        </button>
        <button type="button" className="g-sfeat-page g-glass" onClick={onOpenPage}>{pageTitle || t('Features')}</button>
      </div>
    </div>
  )
}
