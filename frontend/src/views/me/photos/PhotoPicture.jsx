import Icon from '../../../components/Icon.jsx'
import { t } from '../../../lib/i18n.js'
import { usePhotoPicture } from './PhotoThumb.jsx'

// One photo's picture inside the viewer and Compare: the image, or "On another phone" when no device
// here has the file; nothing while it loads. `alt` is the photo's spoken name.
export default function PhotoPicture({ photo, alt }) {
  const pic = usePhotoPicture(photo)
  if (pic.shown) return <img src={pic.url} alt={alt} decoding="async" draggable={false} onError={pic.onError} />
  if (!pic.missing) return null
  return <span className="g-pstage-gone"><Icon name="image" className="g-icon" />{t('On another phone')}</span>
}
