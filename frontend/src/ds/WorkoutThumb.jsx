import { useEffect, useState } from 'react'
import { cx } from '../lib/ui-kit.js'
import { isVideoSrc } from '../lib/exercises.js'

const PX = { lg: 96, md: 44, sm: 36 }

// The exercise picture inside the workout kit (the hero, the footer's neighbours, a bar toast): a
// rounded still on white, decorative because the control around it carries the name. Without an
// image it keeps its size as an empty tile, so the layout does not jump.
//
// `clip` is the exercise's animation (a muted loop, or an animated image where the build ships
// those), given only while the Animations setting is Full. When the caller gives none, or the clip
// fails to load, the still stands in.
export default function WorkoutThumb({ image, clip, size = 'md', className }) {
  const px = PX[size]
  const cls = cx('g-wkimg', 'g-wkimg-' + size, className)
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [clip])
  if (clip && !failed) {
    return isVideoSrc(clip)
      ? <video className={cls} src={clip} width={px} height={px} autoPlay muted loop playsInline disablePictureInPicture aria-hidden="true" onError={() => setFailed(true)} />
      : <img className={cls} src={clip} alt="" width={px} height={px} draggable={false} onError={() => setFailed(true)} />
  }
  if (!image) return <span className={cls} aria-hidden="true" />
  return <img className={cls} src={image} alt="" width={px} height={px} draggable={false} />
}
