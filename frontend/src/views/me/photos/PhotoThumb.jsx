import { createContext, useContext, useState } from 'react'
import PhotoTile from '../../../ds/PhotoTile.jsx'
import { useMediaUrl } from '../../../components/CustomMedia.jsx'
import { t } from '../../../lib/i18n.js'
import { tileText } from './photos-data.js'

// Where the pictures come from. The app leaves this empty and reads the local store (useMediaUrl);
// the gallery (dev/screens) provides `(photo) => { url, status }` so a state shows pictures
// without a file ever being written.
export const PhotoSourceContext = createContext(null)

// One photo of the grid: resolves its file and draws a PhotoTile. A file that no device here has
// (a synced entry whose file stayed on another phone, backup off) reads "On another phone"; while
// it loads, or a download waits for the network, the tile is just quiet glass.
export default function PhotoThumb({ photo, unit, onOpen }) {
  const source = useContext(PhotoSourceContext)
  const real = useMediaUrl(source ? null : photo.ref)
  const media = source ? source(photo) : real
  const [broken, setBroken] = useState(null)
  const shown = media.url && broken !== media.url
  const missing = media.status === 'missing' || media.status === 'none' || (!!media.url && broken === media.url)
  const { date, weight, label } = tileText(photo, unit)
  return (
    <PhotoTile
      image={shown ? <img src={media.url} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBroken(media.url)} /> : null}
      date={date} caption={weight} missing={missing} missingLabel={t('On another phone')} label={label}
      onClick={() => onOpen(photo)} />
  )
}
