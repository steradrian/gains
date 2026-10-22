import { STILL } from '../../../ds/dev-still.js'
import { todayISO } from '../../../lib/format.js'
import { rangeStart } from '../../../lib/progress-range.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import BodyScreen from '../../../views/me/body/BodyScreen.jsx'
import { bodyOf } from '../../../views/me/body/body-data.js'
import { allPhotos } from '../../../lib/me/photos.js'
import { openAddPhoto } from '../../../views/me/photos/photo-drawers.jsx'
import { openCompare, openViewer } from '../../../views/me/photos/photo-overlays.jsx'
import { PhotoSourceContext } from '../../../views/me/photos/PhotoThumb.jsx'
import { registerScreens } from '../registry.js'
import { NOOP, emptyState, photosState, sourceOf, viewerState } from './me-photos-fixture.js'

// Me > Photos (PR-05 boards Me2Photos, Me2PhotosEmpty, Me2AddPhoto, Me2PhotosSync and the edge rows
// M2.8, M2.12, M2.9, M2.13): the real BodyScreen on its Photos tab reading a mocked store (nothing
// persists), the drawer and the toast the real ones, opened by `play`. The pictures are a stand-in
// still, never a file.
function Page({ gone }) {
  const S = useStore(s => s.S)
  const data = bodyOf(S, { from: rangeStart(0), today: todayISO() })
  return (
    <PhotoSourceContext.Provider value={sourceOf(STILL, { gone })}>
      <BodyScreen tab="photos" onTab={NOOP} data={data} range={0} onRange={NOOP} asks onLog={NOOP} onOpen={NOOP} />
    </PhotoSourceContext.Provider>
  )
}
const page = props => () => <Page {...props} />
const withS = S => ({ S })

// Switch Back up photos on: the real write and the real toast, held open.
const heldBackup = async t => {
  document.querySelector('[role="switch"]').click()
  await t.wait(100)
  useUI.getState().pauseToast()
  await t.wait(60)
}

// Me photos M3: the overlays open over the tab, their pictures from the same stand-in still (the
// overlays are drawn by the sheet host, outside the page's provider, so they take the source directly).
const source = sourceOf(STILL)
const photosNow = () => allPhotos(useStore.getState().S)
const showViewer = (pick, then) => async t => {
  openViewer(pick(photosNow()), { source })
  await t.wait(200)
  then?.()
  await t.wait(200)
}
const showCompare = then => async t => {
  openCompare(photosNow(), { source })
  await t.wait(200)
  then?.()
  await t.wait(200)
}
const click = selector => () => document.querySelector(selector).click()
const named = label => () => [...document.querySelectorAll('.g-pstage button')].find(b => b.textContent.trim() === label).click()

registerScreens('Me: photos', [
  { id: 'M2.8', title: 'Photos, six on this phone', note: 'Six photos newest first with each day’s weigh-in, Back up photos off: "on this phone", "Stored on this phone only" and who sees them. Nothing says encrypted.',
    render: page(), mock: withS(photosState()) },
  { id: 'M2.8a', title: 'Photos, backed up', note: 'Back up photos on: the page reads "6 photos · backed up", the section "In your account" and the footer "Backed up to your account."',
    render: page(), mock: withS(photosState({ backup: true })) },
  { id: 'M2.8b', title: 'Photos, one photo only', note: 'Compare is dimmed (a disabled button) with "Add one more photo to compare." under it.',
    render: page(), mock: withS(photosState({ count: 1 })) },
  { id: 'M2.8c', title: 'Photos, a file on another phone', note: 'One tile whose file is on no device here reads "On another phone" instead of a broken picture.',
    render: page({ gone: true }), mock: withS(photosState()) },
  { id: 'M2.8d', title: 'Photos, pounds', note: 'The same page in lb: the weight line under each tile follows the unit.',
    render: page(), mock: withS(photosState({ unit: 'lb' })) },
  { id: 'M2.8e', title: 'Photos, no weigh-ins', note: 'Photos on days with no weigh-in: the tile shows the date only.',
    render: page(), mock: withS(photosState({ weights: false })) },
  { id: 'M2.9', title: 'Add photo', note: 'The drawer over the Photos tab: the day chip (Today, a past day from the date picker), Take a photo, Choose from library, and the hint about light and pose.',
    render: page(), mock: withS(photosState()), play: async t => { openAddPhoto(); await t.wait(300) } },
  { id: 'M2.12', title: 'Photos, none yet', note: 'No photos: the empty scene, what Compare is for, that they stay on the phone unless backup is on, and Add photo.',
    render: page(), mock: withS(emptyState()) },
  { id: 'M2.13', title: 'Photos, backed up (toast)', note: 'Back up photos switched on: the toast "Backing up 6 photos to your account" with Undo (held open here, 8 s in the app); Undo turns it off.',
    render: page(), mock: withS(photosState()), play: heldBackup },

  // Me photos M3
  { id: 'M2.10', title: 'Photo viewer, middle of six', note: 'The photo full screen on black: close, the day, "3 of 6", the picture, its day and weigh-in under it, Compare and Delete; arrows or a swipe move between photos.',
    render: page(), mock: withS(viewerState()), play: showViewer(p => p[2]) },
  { id: 'M2.10a', title: 'Photo viewer, the last photo', note: 'The oldest of six: "6 of 6" with no Next button (the newest has no Previous).',
    render: page(), mock: withS(viewerState()), play: showViewer(p => p[p.length - 1]) },
  { id: 'M2.10b', title: 'Photo viewer, a workout photo', note: 'A photo taken in a workout looks the same; Delete there says it also leaves the workout.',
    render: page(), mock: withS(viewerState({ workout: true })), play: showViewer(p => p.find(x => x.source === 'workout')) },
  { id: 'M2.10c', title: 'Delete photo, confirm', note: 'Delete asks first and says what goes ("This photo goes from your photos."); the one drawer over the viewer. Delete then closes the viewer and offers Undo for 8 s.',
    render: page(), mock: withS(viewerState()), play: showViewer(p => p[2], named('Delete')) },
  { id: 'M2.11', title: 'Compare, two dates apart', note: 'The oldest and the newest side by side with their days and weights, and "77 days apart · -3.6 kg · waist -4 cm".',
    render: page(), mock: withS(viewerState()), play: showCompare() },
  { id: 'M2.11a', title: 'Compare, no weights', note: 'No weigh-ins or waist readings: the captions are the days only and the line is "77 days apart".',
    render: page(), mock: withS(viewerState({ weights: false })), play: showCompare() },
  { id: 'M2.11b', title: 'Compare, choosing a photo', note: 'Change before opens the other photos inside the overlay (no second drawer); the pick goes back in date order.',
    render: page(), mock: withS(viewerState()), play: showCompare(click('.g-cmp-side button')) },
])
