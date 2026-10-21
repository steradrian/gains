import StageEmpty from '../../ds/StageEmpty.jsx'
import { t } from '../../lib/i18n.js'

// No match (board Ea8NoMatch): nothing in your foods, saved meals or (when it is on) Open Food Facts
// for what is typed. The way on: the nearest spelling when there is one, Create food with the
// query as its name, calories with no food behind them, and the barcode. `onQuick` is left out
// where Profile › Diary & meals has Quick calories off.
export default function LogNoMatch({ query, online, suggestion, onSuggest, onCreate, onQuick, onScan }) {
  return (
    <div className="g-lf-empty">
      <StageEmpty card={false} illustration="search" title={t('No match for “{0}”', query)}
        body={online ? t('Not in your foods or Open Food Facts. Try fewer words, or add it yourself.') : t('Not in your foods. Try fewer words, or add it yourself.')}
        actions={[
          ...(suggestion ? [{ label: t('Did you mean {0}', suggestion), icon: 'magnifier', onClick: () => onSuggest(suggestion) }] : []),
          { label: t('Create food'), icon: 'plus', onClick: onCreate },
          ...(onQuick ? [{ label: t('Add calories only'), icon: 'bolt', onClick: onQuick }] : []),
          { label: t('Scan its barcode'), icon: 'scanBarcode', onClick: onScan },
        ]} />
    </div>
  )
}
