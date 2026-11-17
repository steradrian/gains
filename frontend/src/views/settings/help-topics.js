// The Help page's answers (board St1Help, A1.35): short, and true to what the app does today.
// English keys, passed through t() where they are drawn and searched (views/settings-pages.js
// builds a search entry for each, so the answer's words find the row). Each answer is three
// sentences or fewer. `goTo` is the Settings page that does the thing the answer talks about; the
// answer's drawer offers a button for it where that page exists for this profile.
// No React and no t() at module level: settings-pages.js imports this.
export const HELP_TOPICS = [
  {
    id: 'ring', icon: 'flame', title: 'How the ring works', sub: 'Left today, eaten, burned', goTo: 'diary',
    answer: 'The big ring on Today counts down the calories you have left: your target minus what you have eaten. Activity adds to your target only when you have turned that on in Diary & meals. The three small rings do the same for protein, carbs and fat.',
  },
  {
    id: 'undo', icon: 'undo', title: 'Undo', sub: 'You have 8 seconds', goTo: 'backup',
    answer: 'After you delete a workout, a routine, a category or a logged food, a bar offers Undo for 8 seconds. Tap it and the change is put back as it was. After that it is gone, so export a backup now and then.',
  },
  {
    id: 'offline', icon: 'wifiOff', title: 'Offline and sync', sub: 'Why a change says Waiting',
    answer: 'Gains keeps working without a connection and saves every change on this phone first. A change that has not reached your profile yet says Waiting to sync, and it is sent as soon as you are back online. Tap the status to try again by hand.',
  },
  {
    id: 'passkeys', icon: 'fingerprint', title: 'Passkeys and devices', sub: 'Signing in without a password', goTo: 'account',
    answer: 'A passkey signs you in with your fingerprint, your face or your screen lock, so there is no password to remember. Keep one on each device, and add another device with a one-time code. If you lose a phone, remove its passkey.',
  },
  {
    id: 'import', icon: 'download', title: 'Importing from another app', sub: 'Strong, Hevy, FitNotes', goTo: 'import',
    answer: 'Pick a file exported from FitNotes or Strong, or body weight from Apple Health, or pull your history from Hevy with a Hevy Pro API key. Workouts come in with their original dates. A day that is already here is left alone, so importing twice never doubles a workout.',
  },
  {
    id: 'plan', icon: 'calendar', title: 'Training with a Plan', sub: 'Fixed week or Rotation', goTo: 'schedule',
    answer: 'A fixed week puts routines on days of the week. A rotation runs your routines in a loop, A then B then C, with no fixed days. Switching between them keeps your routines and history, and only the calendar changes.',
  },
]
