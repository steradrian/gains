import { Skeleton } from '../blocks.jsx'

// A slow source's place while it is not rows, off the stage (a food picker's Open Food Facts card,
// OnlineStatus.jsx): two skeleton rows on the rows' own geometry, so nothing below moves when they
// land (ui-search.md §9).
export function SkeletonRows() {
  return <div className="sr-skel" aria-hidden="true">
    {[[58, 34], [46, 40]].map(([title, sub], i) => (
      <div key={i} className="sr-skel-row">
        <Skeleton w={48} h={48} r={8} />
        <span className="sr-skel-t"><Skeleton w={title + '%'} h={12} /><Skeleton w={sub + '%'} h={10} /></span>
        <Skeleton w={36} h={12} />
      </div>
    ))}
  </div>
}
