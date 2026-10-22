import Icon from '../components/Icon.jsx'
import StageNavBar from './StageNavBar.jsx'

// The scroll test on #/dev/glass (M3's device gate): a sticky StageNavBar with glass discs, a horizontal
// rail of discs (an inner scroller that clips), then a long list of 30 cards and 20 discs, all passing
// under the page's docked tab bar. Fling it under each presenter and read the HUD: with the fixed
// presenter the rims trail the content on iOS; with sprites they ride with it. English only.

const NOOP = () => {}
const ICONS = ['utensils', 'droplet', 'scale', 'flame', 'sunrise', 'moon', 'scanBarcode', 'search']
const RAIL = Array.from({ length: 12 }, (_, i) => i)
// 30 cards, with a row of two discs after every third card from the second on: 20 discs.
const ROWS = Array.from({ length: 30 }, (_, i) => ({ card: i, discs: i % 3 === 1 ? [(i - 1) / 3 * 2, (i - 1) / 3 * 2 + 1] : null }))

function Disc({ n }) {
  return (
    <button type="button" className="g-glass gl-disc" aria-label={`Disc ${n + 1}`} onClick={NOOP}>
      <Icon name={ICONS[n % ICONS.length]} className="g-icon" />
    </button>
  )
}

export default function DevGlassScroll() {
  return (
    <section className="gl-scroll" aria-label="Scroll test">
      <StageNavBar title="Scroll test" onBack={NOOP} actions={[{ icon: 'search', label: 'Search', onClick: NOOP }]} />
      <div className="gl-rail" aria-label="Rail">
        {RAIL.map(i => <Disc key={i} n={i} />)}
      </div>
      <div className="gl-list">
        {ROWS.map(r => (
          <div key={r.card} className="gl-list-group">
            <div className="g-glass gl-card">
              <b>Card {r.card + 1}</b>
              <span>Refraction should ride with the card, rim and all.</span>
            </div>
            {r.discs && (
              <div className="gl-disc-row">
                {r.discs.map(n => <Disc key={n} n={n} />)}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
