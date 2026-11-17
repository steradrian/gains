// The large title of a pushed page on the stage, under its StageNavBar (boards Sh3Notifications,
// Sh1Day, Sh2Week): the page's one h1, and an optional line under it. It scrolls away with the
// page while the bar sticks. `ref` reaches the heading, which takes focus (tabIndex -1) when a
// page has to move focus somewhere that stays, as after Mark all read. Text comes from the caller.
export default function StagePageTitle({ title, line, ref }) {
  return (
    <div className="g-sptitle">
      <h1 ref={ref} tabIndex={-1}>{title}</h1>
      {line && <p>{line}</p>}
    </div>
  )
}
