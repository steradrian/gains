import { createContext, useContext, useState } from 'react'
import PhotoTile from '../../../ds/PhotoTile.jsx'
import { useMediaUrl } from '../../../components/CustomMedia.jsx'
import { t } from '../../../lib/i18n.js'
import { tileText } from './photos-data.js'

// Where the pictures come from. The app leaves this empty and reads the local store (useMediaUrl);
// the gallery (dev/screens) provides `(photo) => { url, status }` so a state shows pictures
// without a file ever being written.
export const PhotoSourceContext = createContext(null)

/** A photo's picture as the grid, the viewer and Compare show it: `{ url, shown, missing, onError }`.
 *  `missing` is a file no device here has (or one that will not draw); while it loads or waits for
 *  the network `shown` and `missing` are both false. */
export function usePhotoPicture(photo) {
  const source = useContext(PhotoSourceContext)
  const real = useMediaUrl(source ? null : photo.ref)
  const media = source ? source(photo) : real
  const [broken, setBroken] = useState(null)
  return {
    url: media.url,
    shown: !!media.url && broken !== media.url,
    missing: media.status === 'missing' || media.status === 'none' || (!!media.url && broken === media.url),
    onError: () => setBroken(media.url),
  }
}

// One photo of the grid: resolves its file and draws a PhotoTile. A file that no device here has
// (a synced entry whose file stayed on another phone, backup off) reads "On another phone"; while
// it loads, or a download waits for the network, the tile is just quiet glass.
export default function PhotoThumb({ photo, unit, onOpen }) {
  const pic = usePhotoPicture(photo)
  const { date, weight, label } = tileText(photo, unit)
  return (
    <PhotoTile
      image={pic.shown ? <img src={pic.url} alt="" loading="lazy" decoding="async" draggable={false} onError={pic.onError} /> : null}
      date={date} caption={weight} missing={pic.missing} missingLabel={t('On another phone')} label={label}
      onClick={() => onOpen(photo)} />
  )
}
