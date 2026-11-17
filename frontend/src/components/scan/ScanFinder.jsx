// The frame the barcode goes in (board Ea9Scan): a window in a dimmed camera view with four
// corners, and the red line while it is reading. `line` is off once a code is read.
export default function ScanFinder({ line = true }) {
  return (
    <span className="g-scan-find" aria-hidden="true">
      {line && <span className="g-scan-line" />}
      <i className="g-scan-c g-scan-c-tl" />
      <i className="g-scan-c g-scan-c-tr" />
      <i className="g-scan-c g-scan-c-bl" />
      <i className="g-scan-c g-scan-c-br" />
    </span>
  )
}
