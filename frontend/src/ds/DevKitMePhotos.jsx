import Section from './DevKitSection.jsx'
import PhotoGrid from './PhotoGrid.jsx'
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
    </>
  )
}
