import { cx } from '../lib/ui-kit.js'

const PX = { lg: 96, md: 44, sm: 36 }

// The exercise picture inside the workout kit (the hero, the footer's neighbours, a bar toast): a
// rounded still on white, decorative because the control around it carries the name. Without an
// image it keeps its size as an empty tile, so the layout does not jump.
export default function WorkoutThumb({ image, size = 'md', className }) {
  const px = PX[size]
  const cls = cx('g-wkimg', 'g-wkimg-' + size, className)
  if (!image) return <span className={cls} aria-hidden="true" />
  return <img className={cls} src={image} alt="" width={px} height={px} draggable={false} />
}
