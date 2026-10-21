import Modals from '../components/Modals.jsx'
import Toast from '../components/Toast.jsx'
import { useUI } from '../store/useUI.js'
import ActionGrid from './ActionGrid.jsx'
import BottomSheet from './BottomSheet.jsx'
import Button from './Button.jsx'
import Section from './DevKitSection.jsx'
import MenuList from './MenuList.jsx'
import SegmentedControl from './SegmentedControl.jsx'
import UndoToast from './UndoToast.jsx'
import WhenChip from './WhenChip.jsx'

// The drawer and toast kit's part of the catalogue (DevKit.jsx): each drawn still in a phone-sized
// frame, and opened for real through the app's sheet frame and toast (mounted here, since the
// catalogue's route has neither), so focus, Escape, the scrim, a pull, back and Undo can be tried.
const SELF = '#/dev/kit'
const NOOP = () => {}
const FOODS = ['Chicken rice bowl · 540 kcal', 'Greek yogurt 2% · 120 kcal', 'Banana · 105 kcal', 'Oat porridge · 310 kcal', 'Salmon fillet · 420 kcal', 'Rice cakes · 70 kcal', 'Almonds · 170 kcal', 'Protein shake · 160 kcal']

const ADD_TILES = [
  { icon: 'utensils', label: 'Log food', onClick: NOOP }, { icon: 'scanBarcode', label: 'Scan', onClick: NOOP },
  { icon: 'droplet', label: 'Water', onClick: NOOP }, { icon: 'scale', label: 'Weigh-in', onClick: NOOP },
  { icon: 'play', label: 'Resume workout', detail: '24:10', onClick: NOOP }, { icon: 'history', label: 'Log activity', onClick: NOOP },
]
const ADD_ITEMS = [
  { icon: 'bolt', label: 'Quick kcal', onClick: NOOP },
  { icon: 'timer', label: 'Fast', value: '16 h', onClick: NOOP },
  { icon: 'qr', label: 'Gym check-in', onClick: NOOP },
]

function FoodList() {
  return <ul className="g-kit-list">{FOODS.map(f => <li key={f}>{f}</li>)}</ul>
}

function openDrawer(type) {
  const ui = useUI.getState()
  ui.openSheet(close => (
    <BottomSheet title={type === 'full' ? 'Log food' : 'Weigh-in'} chip={type === 'full' ? 'Today · Lunch' : 'Today'}
      onChip={type === 'full' ? () => ui.toast('The chip opens the day and meal picker') : undefined} type={type}
      footer={type === 'full' ? undefined : <Button block onClick={() => {
        close()
        ui.toast('Saved 81.4 kg to Today', { action: 'Undo', onAction: NOOP })
      }}>Save weigh-in</Button>}>
      {type === 'full' ? <FoodList /> : <p className="g-kit-p">81.4 kg. Last weigh-in: 81.7 kg on Sun 11 Oct.</p>}
    </BottomSheet>
  ), { variant: 'ds' })
}

export default function DevKitDrawers() {
  const toast = (msg, opts) => useUI.getState().toast(msg, opts)
  return (
    <>
      <Section title="BottomSheet" note="Drawn still: auto with a day chip and a footer, half, and full with a tappable chip and a close link. Then opened for real (variant 'ds' on the app's sheet frame).">
        <div className="g-kit-row">
          <Button variant="secondary" size="sm" onClick={() => openDrawer('auto')}>Open auto</Button>
          <Button variant="secondary" size="sm" onClick={() => openDrawer('full')}>Open full</Button>
        </div>
        <div className="g-kit-frame">
          <BottomSheet title="Weigh-in" chip="Today" onClose={NOOP} footer={<Button block>Save weigh-in</Button>}>
            <p className="g-kit-p">81.4 kg. Last weigh-in: 81.7 kg on Sun 11 Oct.</p>
          </BottomSheet>
        </div>
        <div className="g-kit-frame">
          <BottomSheet title="Nutrition today" type="half" onClose={NOOP}><FoodList /></BottomSheet>
        </div>
        <div className="g-kit-frame">
          <BottomSheet title="Log food" chip="Today · Lunch" onChip={NOOP} type="full" closeHref={SELF}
            head={<SegmentedControl options={['Recent', 'Saved meals', 'My foods']} label="Food source" />}><FoodList /></BottomSheet>
        </div>
      </Section>

      <Section title="SegmentedControl" note="Three options keeping their own choice (also pinned in the full drawer's head above), and two controlled.">
        <div className="g-kit-col">
          <SegmentedControl options={['Recent', 'Saved meals', 'My foods']} label="Food source" />
          <SegmentedControl options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} value="kg" onChange={NOOP} label="Unit" />
        </div>
      </Section>

      <Section title="ActionGrid" note="Four across (the bundle's), one accent; then lg, three across on the + drawer (T18Add), with a running workout's time under its label.">
        <ActionGrid items={[{ icon: 'utensils', label: 'Log food', accent: true }, { icon: 'scanBarcode', label: 'Scan' }, { icon: 'droplet', label: 'Water' }, { icon: 'scale', label: 'Weigh-in' }]} />
        <div className="g-kit-frame">
          <BottomSheet title="Add to Today" chip="Today · Lunch" onChip={NOOP} onClose={NOOP}>
            <ActionGrid size="lg" items={ADD_TILES} />
            <MenuList items={ADD_ITEMS} label="More" />
          </BottomSheet>
        </div>
      </Section>

      <Section title="MenuList" note="Glyph, label, a detail line, a value at the end; a danger item.">
        <MenuList label="More" items={[...ADD_ITEMS, { icon: 'trash', label: 'Delete this day', detail: 'Removes every log', tone: 'danger', onClick: NOOP }]} />
      </Section>

      <Section title="WhenChip" note="Where a log goes, tapped to change it: day and meal, then the day alone.">
        <div className="g-kit-row">
          <WhenChip day="Today" meal="Lunch" onClick={NOOP} />
          <WhenChip day="Tue 13 Oct" onClick={NOOP} />
        </div>
      </Section>

      <Section title="UndoToast" note="Drawn still: Undo with its 8 s bar, another action, and text alone. Then the app's one toast, which draws through it.">
        <div className="g-kit-row">
          <Button variant="secondary" size="sm" onClick={() => toast('Added Chicken rice bowl to Today, Lunch', { action: 'Undo', onAction: NOOP })}>Show with Undo</Button>
          <Button variant="secondary" size="sm" onClick={() => toast('Saved')}>Show text alone</Button>
        </div>
        <div className="g-kit-col">
          <UndoToast message="Added 250 ml of water to Today" onUndo={NOOP} />
          <UndoToast message="Workout saved to Today" actionLabel="Reopen" actionHref={SELF} />
          <UndoToast message="Saved" onUndo={false} icon={null} />
        </div>
      </Section>
      <Modals />
      <Toast />
    </>
  )
}
