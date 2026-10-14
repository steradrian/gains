import RootHeader from './RootHeader.jsx'
import SubHeader from './SubHeader.jsx'

// Layout primitives. Each emits the markup the pages write by hand today, with the spacing that
// used to be inline as a ui-kit.css class, so a page moves onto them without a pixel changing.
// Sizes are steps on the space scale: 1…10 = 2, 4, 6, 8, 10, 12, 14, 16, 18, 22px.
// None of them sets a page width: that belongs to the shell (#app, --page-w).

const cx = (...parts) => parts.filter(Boolean).join(' ')

// A routed page: its header, then the page's content as it is (no wrapper). `root` is a tab's
// root (large title and the avatar); every other page gets SubHeader with back and `action`.
export function Page({ title, sub, action, onBack, root = false, children }) {
  return <>
    {root ? <RootHeader title={title} sub={sub} /> : <SubHeader title={title} sub={sub} action={action} onBack={onBack} />}
    {children}
  </>
}

// A column of blocks, `gap` apart. For new layout only: never around .lrow rows, whose hairlines
// are adjacency selectors.
export function Stack({ gap, as: El = 'div', className, children, ...rest }) {
  return <El className={cx('stack', gap && 'g-' + gap, className)} {...rest}>{children}</El>
}

// The height of today's `<div style={{ height: N }} />`.
export function Spacer({ size = 4 }) {
  return <div className={'sp-' + size} />
}

// A `.row`: centred, 12px apart unless `gap` says otherwise.
// justify: 'between' | 'end'; align: 'start' | 'end' | 'baseline' | 'stretch'.
const JUSTIFY = { between: 'between', end: 'jc-end' }
export function Inline({ gap, justify, align, wrap = false, as: El = 'div', className, children, ...rest }) {
  return <El className={cx('row', JUSTIFY[justify], gap && 'g-' + gap, wrap && 'wrap', align && 'ai-' + align, className)} {...rest}>
    {children}
  </El>
}
