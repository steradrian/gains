import StageEmpty from '../../../ds/StageEmpty.jsx'
import StageScreen from '../../../ds/StageScreen.jsx'
import { EMPTY_SCENE_NAMES } from '../../../ds/empty-scenes.js'
import { registerScreens } from '../registry.js'

// The empty states' line-art (ds/empty-scenes.js): each of the six scenes in a StageEmpty, centred
// and stacked (scene, title, line), drawn in on show and still under reduced motion.
const SUBJECT = {
  bell: ['Nothing new', 'Streaks and new bests show up here.'],
  dumbbell: ['No workouts yet', 'Log a workout and the muscles it worked light up here.'],
  plate: ['No meals yet', 'Log a meal and it shows up here.'],
  calendar: ['No fixed days yet', 'Plan a week to see it here.'],
  chart: ['No lifts yet', 'Finish your first workout and your progress curves will show up here.'],
  search: ['No match', 'Try a shorter word.'],
}

registerScreens('Shared: empty states', EMPTY_SCENE_NAMES.map(name => ({
  id: 'E1.' + name,
  title: 'Empty: ' + name,
  note: 'StageEmpty with the ' + name + ' line-art: it draws in; reduced motion shows the finished drawing.',
  render: () => (
    <StageScreen pushed accent="cobalt">
      <StageEmpty card={false} illustration={name} title={SUBJECT[name][0]} body={SUBJECT[name][1]} />
    </StageScreen>
  ),
})))
