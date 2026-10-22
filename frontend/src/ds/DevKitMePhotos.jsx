import Button from './Button.jsx'
import CompareView from './CompareView.jsx'
import Section from './DevKitSection.jsx'
import PhotoGrid from './PhotoGrid.jsx'
import PhotoStage from './PhotoStage.jsx'
import PhotoTile from './PhotoTile.jsx'
import { STILL } from './dev-still.js'

// The Photos tab's part of the catalogue (DevKit.jsx, Me photos M2): the square photo tile and the
// grid it sits in, with sample data (board Me2Photos).
const NOOP = () => {}
const TILES = [
  ['Sun 18 Oct', '81.4 kg'], ['Sun 4 Oct', '82.1 kg'], ['Sun 20 Sep', '83.0 kg'],
  ['Sun 6 Sep', '83.6 kg'], ['Sun 23 Aug', '84.3 kg'], ['Sun 2 Aug', '85.0 kg'],
]

export default function DevKitMePhotos() {
  return (
    <>
      <Section title="Me: photos" note="The Photos tab's parts (Me2Photos): the photo tile and its grid." />

      <Section title="PhotoTile" note="A square photo with its day and that day's weight under it; the whole tile opens the viewer. Without a weight the line is left out, and a file that is on no device here says so instead of drawing a broken picture.">
        <PhotoGrid label="Tile states">
          <PhotoTile key="a" image={<img src={STILL} alt="" />} date="Sun 18 Oct" caption="81.4 kg" label="Sun 18 Oct · 81.4 kg" onClick={NOOP} />
          <PhotoTile key="b" image={<img src={STILL} alt="" />} date="Sun 11 Oct" label="Sun 11 Oct" onClick={NOOP} />
          <PhotoTile key="c" date="Sun 4 Oct" caption="82.1 kg" missing missingLabel="On another phone" label="Sun 4 Oct · 82.1 kg" onClick={NOOP} />
        </PhotoGrid>
      </Section>

      <Section title="PhotoGrid" note="Three across on a phone, more as the stage widens; newest first.">
        <PhotoGrid label="Photos on this phone">
          {TILES.map(([date, caption]) => (
            <PhotoTile key={date} image={<img src={STILL} alt="" />} date={date} caption={caption} label={date + ' · ' + caption} onClick={NOOP} />
          ))}
        </PhotoGrid>
      </Section>

      {/* Me photos M3 */}
      <Section title="PhotoStage" note="The frame of a full-screen photo overlay (Me2Viewer): close, the day, a polite count, the content, and the action bar. Black in every theme.">
        <div className="g-kit-frame">
          <PhotoStage label="Photo" title="Sun 18 Oct 2026" count="3 of 6" closeLabel="Close" onClose={NOOP}
            actions={<><Button variant="glass" icon="sides" onClick={NOOP}>Compare</Button><Button variant="glass" icon="trash" onClick={NOOP}>Delete</Button></>}>
            <div className="g-pstage-pic"><img src={STILL} alt="" /></div>
            <div className="g-pstage-cap"><b>Sun 18 Oct</b><span>81.4 kg that day</span></div>
          </PhotoStage>
        </div>
      </Section>

      <Section title="CompareView" note="Two photos side by side, the earlier on the left in every language, each with its day, weight and the button that changes it; the change between them under both. A side without a weight shows its day only.">
        <div className="g-kit-frame">
          <PhotoStage label="Compare photos" title="Compare" count="2 Aug · 18 Oct" closeLabel="Close" onClose={NOOP}>
            <CompareView
              before={{ image: <img src={STILL} alt="" />, date: 'Sun 2 Aug', caption: '85.0 kg', changeLabel: 'Change before', onChange: NOOP }}
              after={{ image: <img src={STILL} alt="" />, date: 'Sun 18 Oct', caption: '81.4 kg', changeLabel: 'Change after', onChange: NOOP }}
              line="77 days apart · -3.6 kg · waist -4 cm" />
          </PhotoStage>
        </div>
      </Section>
    </>
  )
}
