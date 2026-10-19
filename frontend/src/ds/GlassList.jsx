import { Fragment } from 'react'
import Icon from '../components/Icon.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'
import Act from './Act.jsx'

// Rows in one rounded card (bundle.js `GlassList`): an icon disc, a title, a line under it and a
// chevron. `tone="light"` is the same card on a light surface (a drawer), glass is for the stage.
// A row with `href` or `onClick` is a link or a button with a chevron; one with neither is just
// said, and has none, so nothing looks tappable that is not.
export default function GlassList({ items, tone = 'glass', tall }) {
  oneOf('GlassList', 'tone', tone, ['glass', 'light'])
  return (
    <div className={cx('g-glist', tone === 'light' ? 'g-glist-light' : 'g-glass')}>
      {items.map(it => {
        const tappable = !!(it.href || it.onClick)
        const cls = cx('g-glist-row', tall && 'g-glist-tall')
        const kids = (
          <Fragment>
            <span className="g-glist-ic"><Icon name={it.icon || 'info'} className="g-icon" /></span>
            <span className="g-glist-body"><b>{it.title}</b>{it.sub && <span>{it.sub}</span>}</span>
            {tappable && <Icon name="chevronRight" className="g-icon g-glist-chev" />}
          </Fragment>
        )
        return tappable
          ? <Act key={it.title} href={it.href} onClick={it.onClick} className={cls}>{kids}</Act>
          : <div key={it.title} className={cls}>{kids}</div>
      })}
    </div>
  )
}
