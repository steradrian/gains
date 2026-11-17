// One component's block in the catalogue (DevKit.jsx): its name, what the samples show, the samples.
export default function DevKitSection({ title, note, children }) {
  return (
    <section className="g-kit-sec">
      <h2>{title}</h2>
      {note && <p>{note}</p>}
      {children}
    </section>
  )
}
