import StageSection from './StageSection.jsx'

// A group on the Notifications page (README, NotificationRow): its small heading ("New", "This
// week", "Earlier") over the `NotificationRow`s in one rounded glass card. Rows are the children,
// edge to edge, with a hairline between them.
export default function NotificationGroup({ title, children }) {
  return (
    <div className="g-ngroup">
      <StageSection variant="label" title={title} />
      <div className="g-ngroup-card g-glass">{children}</div>
    </div>
  )
}
