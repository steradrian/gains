import { tappable } from '../lib/use-sheet-keyboard.js'
import Icon from './Icon.jsx'

// Content blocks. Each emits the exact classes and elements the pages build by hand today
// (.card, .item, .tiles, .big, .empty, h4.sec, .tag, .chips), so index.css stays the one source
// of their look and the tests that find them by class keep working. blocks.test.jsx holds each
// one to the hand-built markup it replaces.

const cx = (...parts) => parts.filter(Boolean).join(' ')

// A card. With `action`, the title shares a row with it, as the hand-built `row between` header
// did. tone: 'danger' | 'accent', the border colour the alert and live cards set inline.
export function Card({ title, action, tone, as: El = 'div', className, children, ...rest }) {
  return <El className={cx('card', tone && 'card-' + tone, className)} {...rest}>
    {title != null && (action
      ? <div className="row between"><h2 className="m-0">{title}</h2>{action}</div>
      : <h2>{title}</h2>)}
    {children}
  </El>
}

// A floating list row: lead (a thumb or an icon), the title over its subtitle, then what trails
// it. `onClick` makes it a keyboard-reachable button that may still nest a real <Button>.
export function ItemRow({ lead, title, subtitle, trailing, chevron = false, onClick, className, ...rest }) {
  return <div className={cx('item', className)} {...tappable(onClick)} {...rest}>
    {lead}
    <div className="grow">
      <div className="tt">{title}</div>
      {subtitle != null && <div className="ss">{subtitle}</div>}
    </div>
    {trailing}
    {chevron && <Icon name="chevronRight" className="chev" />}
  </div>
}

export function Tiles({ className, children }) {
  return <div className={cx('tiles', className)}>{children}</div>
}

// One tile: its label over its value. size: 'sm' (1.1rem) | 'xs' (.95rem) below the 26px default.
export function StatTile({ label, icon, value, unit, size, onClick }) {
  return <div className={cx('tile', onClick && 'tappable')} {...tappable(onClick)}>
    <div className="l">{icon && <Icon name={icon} />}{label}</div>
    <div className={cx('v', size && 'v-' + size)}>{value}{unit != null && <> <span className="muted stat-unit">{unit}</span></>}</div>
  </div>
}

// The big number and its muted unit. size: 'sm' (22px) below the 30px default.
export function Stat({ value, unit, size }) {
  return <div className={cx('big', size && 'big-' + size)}>{value}{unit != null && <> <span className="muted stat-unit">{unit}</span></>}</div>
}

// What a list says when it has nothing in it. With a title, the text sits under it in its own block.
export function EmptyState({ icon, title, className, children }) {
  return <div className={cx('empty', className)}>
    {icon && <div className="ico"><Icon name={icon} /></div>}
    {title != null
      ? <><strong>{title}</strong>{children != null && <div>{children}</div>}</>
      : children}
  </div>
}

export function SectionTitle({ as: El = 'h4', className, children }) {
  return <El className={cx('sec', className)}>{children}</El>
}

// tone: 'acc' | 'dim'. `nocap` keeps the text as written (tags capitalise by default).
export function Tag({ tone, icon, nocap = false, className, children }) {
  return <span className={cx('tag', tone, nocap && 'nocap', className)}>{icon && <Icon name={icon} />}{children}</span>
}

export function Chip({ on = false, nocap = false, onClick, className, children, ...rest }) {
  return <button className={cx('chip', nocap && 'nocap', on && 'on', className)} onClick={onClick} {...rest}>{children}</button>
}

// The horizontal chip strip. `ref` reaches the strip, for useRevealActiveChip.
export function ChipRow({ ref, className, children, ...rest }) {
  return <div ref={ref} className={cx('chips', className)} {...rest}>{children}</div>
}
