import { t } from '../../lib/i18n.js'
import { useDsAccent } from '../../lib/use-ds-accent.js'
import Act from '../../ds/Act.jsx'
import DangerRow from '../../ds/DangerRow.jsx'
import Icon from '../../components/Icon.jsx'
import InlineBanner from '../../ds/InlineBanner.jsx'
import StagePageTitle from '../../ds/StagePageTitle.jsx'
import StageScreen from '../../ds/StageScreen.jsx'
import StageSearchField from '../../ds/StageSearchField.jsx'
import StageSection from '../../ds/StageSection.jsx'
import SettingsRows from './SettingsRows.jsx'
import SettingsSearch from './SettingsSearch.jsx'
import './settings-root.css'

// The Settings root on the stage (boards St1Settings A1.0, St3Scheduled A3.3, St3Cancelled A3.4):
// the large title, the deletion banner while one is scheduled, the account card, the sync pill,
// the search field, then one card of rows per group, each saying what it is set to, and Sign out.
// It draws what the container gives it and holds nothing.
//
//   banner   { date, busy, onCancel } while `user.deletion` is set, else null; `date` is worded
//   account  { initial, name, line, onOpen }: `initial` null draws the person glyph
//   pill     { state: 'ok' | 'waiting' | 'paused' | 'problem', label, trail } or null; onPill opens Sync
//   groups   [{ key, title, rows: [{ key, icon, title, sub, value, onClick }] }], top to bottom;
//            a row another board adds to a group (root-groups.js ROOT_ROW_SLOTS) arrives here like
//            any other
//   search   { open, query, rows, onOpen, onQuery, onClose }: `open` swaps the page for the overlay
//   signOut  { title, sub, onClick } or null (a guest and the demo have nothing to leave)
//   footer   the line at the very end
//
// The root is the Me tab's root: like every tab root it has no Back, the tab bar is the way out.
// The stage behind is the app's, so the page paints no background.
export default function SettingsRootScreen({ title = t('Settings'), banner, account, pill, onPill, groups, search, signOut, footer, bodyRef }) {
  const accent = useDsAccent()
  return (
    <StageScreen accent={accent}>
      <div ref={bodyRef}>
        {search.open
          ? <SettingsSearch query={search.query} onQuery={search.onQuery} rows={search.rows} onClose={search.onClose} />
          : (
            <div className="sroot">
              <StagePageTitle title={title} />
              {banner && (
                <div className="sroot-banner">
                  <InlineBanner stage icon="warning" title={t('Your account is scheduled for deletion')}
                    body={t('Deleted on {0}', banner.date) + '. ' + t('Everything is still here until then. Sync is paused.')}
                    actions={[{ label: t('Cancel deletion'), solid: true, onClick: banner.busy ? undefined : banner.onCancel }]} />
                </div>
              )}
              {account && (
                <div className="sroot-gutter">
                  <div className="g-glist g-glass">
                    <Act onClick={account.onOpen} className="g-glist-row sroot-acct">
                      <span className="sroot-avatar" aria-hidden="true">{account.initial || <Icon name="personCircle" className="g-icon" />}</span>
                      <span className="g-glist-body"><b>{account.name}</b><span>{account.line}</span></span>
                      <Icon name="chevronRight" className="g-icon g-glist-chev" />
                    </Act>
                  </div>
                  {pill && (
                    <Act onClick={onPill} className="sroot-pill g-glass">
                      <span className={'sroot-dot sroot-dot-' + pill.state} aria-hidden="true" />
                      <span className="sroot-pill-t">{pill.label}{pill.trail && <span>{' · ' + pill.trail}</span>}</span>
                    </Act>
                  )}
                </div>
              )}
              {/* Focusing the field opens the overlay, which brings its own field and takes the focus. */}
              <div className="sroot-search" onFocus={search.onOpen}>
                <StageSearchField placeholder={t('Search settings')} label={t('Search settings')} />
              </div>
              {groups.map(g => (
                <section key={g.key}>
                  <StageSection title={t(g.title)} />
                  <div className="sroot-gutter"><SettingsRows rows={g.rows} /></div>
                </section>
              ))}
              {signOut && (
                <div className="sroot-out">
                  <div className="g-glist g-glass">
                    <DangerRow icon="signOut" title={signOut.title} sub={signOut.sub} onClick={signOut.onClick} />
                  </div>
                </div>
              )}
              {footer && <p className="sroot-foot">{footer}</p>}
            </div>
          )}
      </div>
    </StageScreen>
  )
}
