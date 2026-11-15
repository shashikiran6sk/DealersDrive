import type { PoseGuide, ShotFact, ShotGuide } from './photo-standard.types';

export const PHOTO_GUIDE_ASSETS = {
  base: '/photo-guide',
  pdf: '/photo-guide/dealers-drive-photo-guide.pdf',
  pdfName: 'dealers-drive-photo-guide.pdf',
  walkround: '/photo-guide/walkround.webp',
} as const;

export const PHOTO_STANDARD_TEXT = {
  eyebrow: 'Photography guide',
  title: 'Ten photos that sell a car.',
  intro:
    'Where to stand, how low to go, and which way to hold your phone for each of the ten photos on a Dealers-Drive listing. It takes about ten minutes per car and needs nothing but a phone.',
  lap: 'One lap round the car.',
  lapBody: 'Shoot 1 → 6 outside, kneeling at every stop, then 7 → 10 inside.',
  walkroundAlt:
    'A car seen from above with the ten places to take each photo numbered around it: six outside, kneeling, and four inside.',
  downloadPdf: 'Download the guide (PDF)',
  openGuide: 'Open the full guide',
  beforeTitle: 'Before you shoot',
  posesTitle: 'The four poses',
  posesIntro:
    'The single biggest upgrade is getting low. Most people shoot standing, from 1.4 m, looking down on the car. Every outside photo in this guide is taken kneeling, with the phone at about 1 m.',
  posesNote:
    'Never take the outside photos standing. It shows the roof and makes the car look small.',
  photoOf: (number: string) => `Photo ${number} of 10`,
  positionLabel: 'How to position yourself',
  resultLabel: 'The result',
  planLabel: 'Where to stand · seen from above',
  positionAlt: (title: string) => `A dealer in position to take the ${title.toLowerCase()} photo`,
  resultAlt: (title: string) => `Example ${title.toLowerCase()} photo from a reference listing`,
  planAlt: (title: string) =>
    `Where to stand for the ${title.toLowerCase()} photo, seen from above`,
  poseAlt: (title: string) => `Pose: ${title.toLowerCase()}`,
  facts: { pose: 'Pose', height: 'Phone height', distance: 'Distance', hold: 'Hold the phone' },
  stepsTitle: 'Step by step',
  checksTitle: 'Check the screen before you tap',
  avoidTitle: 'Avoid',
  quickTitle: 'Quick reference',
  quickIntro: 'One line per photo, in shooting order. Print the PDF and keep it in the glovebox.',
  quickColumns: {
    photo: 'Photo',
    where: 'Where',
    pose: 'Pose',
    height: 'Phone height',
    hold: 'Hold',
  },
  lastCheckTitle: 'Last check before you upload:',
  lastCheck:
    'all ten photos sharp, level and bright; the car fills each frame; nothing personal in the cabin; the odometer matches the km in the listing; photo 1 is your best one, because it becomes the thumbnail.',
} as const;

export const BEFORE_YOU_SHOOT: readonly {
  title: string;
  items: readonly (readonly [string, string])[];
}[] = [
  {
    title: 'The car',
    items: [
      ['Wash and dry it.', 'Water spots and dust show up badly on white and silver.'],
      ['Empty the cabin.', 'No phones, papers, bottles, air fresheners or seat covers.'],
      ['Straighten the front wheels', 'and fold both mirrors out.'],
      [
        'Park in open space',
        'with a plain wall or open ground behind it. Keep other cars, people and bikes out of frame.',
      ],
    ],
  },
  {
    title: 'The light',
    items: [
      ['Even shade or a cloudy sky is best.', 'Early morning or late afternoon works too.'],
      ['Avoid harsh midday sun.', 'It throws hard shadows and glares off the paint.'],
      ['Keep the sun behind you,', 'not behind the car.'],
    ],
  },
  {
    title: 'The phone',
    items: [
      ['Wipe the lens', 'on your shirt first. A greasy lens is the #1 cause of hazy photos.'],
      ['Turn on gridlines', '(Camera settings → Grid) to keep the car level.'],
      [
        '1× lens outside, 0.5× inside',
        'if your phone has it. Never pinch-zoom; walk closer instead.',
      ],
      ['Flash off. Landscape', 'for every photo except 7 and 8.'],
    ],
  },
];

export const POSES: readonly PoseGuide[] = [
  {
    pose: 'kneel',
    title: 'Kneel',
    body: 'One knee down, back straight, phone at eye level. Photos 1 to 6.',
    image: '/photo-guide/pose-kneel.webp',
  },
  {
    pose: 'kneelAtDoor',
    title: 'Kneel at the door',
    body: 'Kneel in the open doorway, close to the door, back straight. Photos 7 and 8.',
    image: '/photo-guide/pose-kneel-at-door.webp',
  },
  {
    pose: 'sitInBack',
    title: 'Sit in the back',
    body: 'Middle of the rear seat, lean forward between the headrests. Photo 9.',
    image: '/photo-guide/pose-sit-in-back.webp',
  },
  {
    pose: 'sitInDriverSeat',
    title: 'Sit in the driver seat',
    body: 'Ignition on, phone just behind the steering wheel. Photo 10.',
    image: '/photo-guide/pose-sit-in-driver-seat.webp',
  },
];

const KNEELING: ShotFact = { value: '≈ 1 m', note: 'kneeling, at eye level' };
const AT_SEAT: ShotFact = { value: '≈ 1 m', note: 'kneeling, level with the seat' };
const LANDSCAPE: ShotFact = { value: 'Landscape', note: 'Lens: 1×' };
const LANDSCAPE_WIDE: ShotFact = { value: 'Landscape', note: 'Lens: 0.5× if your phone has it' };
const PORTRAIT_WIDE: ShotFact = { value: 'Portrait', note: 'Lens: 0.5× if your phone has it' };

export const SHOT_GUIDES: readonly ShotGuide[] = [
  {
    slot: 'FRONT_THREE_QUARTER_RIGHT',
    number: 1,
    title: 'Front three-quarter',
    side: 'Driver side (right)',
    purpose:
      'Your cover photo. It becomes the thumbnail on every search result, so it does most of the selling.',
    pose: 'kneel',
    height: KNEELING,
    distance: { value: '≈ 4 m', note: 'from the front corner · 5 big steps' },
    hold: LANDSCAPE,
    steps: [
      'Stand at the front-right corner of the car, halfway between straight-ahead and side-on (45°).',
      'Walk back about 5 big steps, keeping that 45° line.',
      'Kneel on one knee with your back straight.',
      'Hold the phone in landscape at eye level, straight and level. Don’t tilt it down.',
    ],
    checks: [
      'Whole car in frame with a small gap all round',
      'Front and side both visible, both wheels showing',
      'Badge just left of centre',
    ],
    avoid: 'Standing and shooting down. The roof fills the frame and the car looks small.',
  },
  {
    slot: 'FRONT',
    number: 2,
    title: 'Straight front',
    side: 'Centred on the badge',
    purpose: 'Shows the face of the car: grille, headlamps, bumper condition and number plate.',
    pose: 'kneel',
    height: KNEELING,
    distance: { value: '≈ 3 m', note: 'from the bumper · 4 big steps' },
    hold: LANDSCAPE,
    steps: [
      'Stand directly in front of the car, lined up with the badge.',
      'Walk back about 4 big steps.',
      'Kneel on one knee right in front of the grille, back straight.',
      'Hold the phone in landscape at eye level. Keep both headlights the same size on screen.',
    ],
    checks: [
      'Badge dead centre',
      'Both mirrors inside the frame',
      'Bumper bottom and roofline both visible',
    ],
    avoid:
      'Standing off-centre. One headlight looks bigger than the other and the car looks crooked.',
  },
  {
    slot: 'FRONT_THREE_QUARTER_LEFT',
    number: 3,
    title: 'Front three-quarter',
    side: 'Passenger side (left)',
    purpose: 'The mirror of photo 1. Buyers check that the left side is as clean as the right.',
    pose: 'kneel',
    height: KNEELING,
    distance: { value: '≈ 4 m', note: 'from the front corner · 5 big steps' },
    hold: LANDSCAPE,
    steps: [
      'Walk round to the front-left corner. Stand on the 45° line between the front and the left side.',
      'Walk back about 5 big steps.',
      'Kneel on one knee with your back straight, the mirror image of photo 1.',
      'Hold the phone in landscape at eye level, straight and level.',
    ],
    checks: [
      'Same distance and height as photo 1',
      'Front and left side both visible',
      'Badge just right of centre',
    ],
    avoid: 'Moving closer than for photo 1. Keep the pair matching.',
  },
  {
    slot: 'LEFT_SIDE',
    number: 4,
    title: 'Side profile',
    side: 'Passenger side (left)',
    purpose:
      'Shows length, stance and every panel down one side: dents, scratches and paint mismatch.',
    pose: 'kneel',
    height: KNEELING,
    distance: { value: '≈ 4.5 m', note: 'from the doors · 6 big steps' },
    hold: LANDSCAPE,
    steps: [
      'Stand level with the gap between the front and rear doors.',
      'Face the car square-on and walk back about 6 big steps.',
      'Kneel on one knee, back straight, centred on the car.',
      'Hold the phone in landscape at eye level, square to the car.',
    ],
    checks: [
      'Car fills the width with equal space front and back',
      'Both wheels look round, not oval',
      'Bottom of the doors and the roof rails both visible',
    ],
    avoid:
      'Standing near the front or back. The car looks stretched and the near end looks too big.',
  },
  {
    slot: 'REAR',
    number: 5,
    title: 'Straight rear',
    side: 'Centred on the badge',
    purpose: 'Tail-lamps, boot lid, rear bumper and the variant badge. Buyers zoom in on this one.',
    pose: 'kneel',
    height: KNEELING,
    distance: { value: '≈ 3 m', note: 'from the bumper · 4 big steps' },
    hold: LANDSCAPE,
    steps: [
      'Stand directly behind the car, lined up with the rear badge.',
      'Walk back about 4 big steps.',
      'Kneel on one knee right behind the badge, back straight.',
      'Hold the phone in landscape at eye level. Keep both tail-lamps the same size on screen.',
    ],
    checks: [
      'Badge dead centre',
      'Number plate and bumper fully visible',
      'No reflection of you in the rear glass',
    ],
    avoid: 'Shooting with the boot open or anything leaning on the bumper.',
  },
  {
    slot: 'RIGHT_SIDE',
    number: 6,
    title: 'Side profile',
    side: 'Driver side (right)',
    purpose:
      'The other half of the panel check. Together with photo 4, the buyer has seen every outside panel.',
    pose: 'kneel',
    height: KNEELING,
    distance: { value: '≈ 4.5 m', note: 'from the doors · 6 big steps' },
    hold: LANDSCAPE,
    steps: [
      'Walk round to the driver side. Stand level with the gap between the doors.',
      'Face the car square-on and walk back about 6 big steps.',
      'Kneel on one knee, back straight, centred on the car.',
      'Hold the phone in landscape at eye level, square to the car.',
    ],
    checks: [
      'Same distance and height as photo 4',
      'Both wheels look round',
      'Equal space in front and behind',
    ],
    avoid:
      'Shooting this side into the sun. If it’s bright behind the car, turn the car round first.',
  },
  {
    slot: 'FRONT_SEATS',
    number: 7,
    title: 'Front seats',
    side: 'Through the open driver door',
    purpose:
      'Seat condition, steering wheel wear and the gear lever. The first thing buyers check inside.',
    pose: 'kneelAtDoor',
    height: AT_SEAT,
    distance: { value: 'At the door', note: 'kneeling beside the open door' },
    hold: PORTRAIT_WIDE,
    steps: [
      'Open the driver door all the way. Wipe the seats and straighten the floor mat.',
      'Kneel on one knee in the doorway, close to the open door.',
      'Keep your back straight and stay outside the car. Don’t climb in.',
      'Hold the phone in portrait at eye level, pointed straight in at the driver seat.',
    ],
    checks: [
      'Driver seat in front, steering wheel and dashboard behind',
      'Seat belt tucked away, no loose items',
      'Cabin light on if it’s dim',
    ],
    avoid: 'Leaving keys, phones, papers or air fresheners in the shot.',
  },
  {
    slot: 'REAR_SEATS',
    number: 8,
    title: 'Rear seats',
    side: 'Through the open rear door',
    purpose: 'Shows rear legroom and seat condition. Family buyers look for this.',
    pose: 'kneelAtDoor',
    height: AT_SEAT,
    distance: { value: 'At the door', note: 'kneeling in the open doorway' },
    hold: PORTRAIT_WIDE,
    steps: [
      'Close the front door and open the rear door all the way.',
      'Kneel on one knee in the open rear doorway, back straight.',
      'Hold the phone just inside the door frame so the frame stays out of the picture.',
      'Hold the phone in portrait, aimed at the far rear door, so the whole bench is in frame.',
    ],
    checks: [
      'Whole rear bench and far window in frame',
      'Headrests up and straight',
      'Floor clear and mats in place',
    ],
    avoid: 'Shooting from too far back. The door frame blocks half the picture.',
  },
  {
    slot: 'DASHBOARD',
    number: 9,
    title: 'Dashboard',
    side: 'From the middle of the rear seat',
    purpose:
      'Shows the whole dashboard, infotainment screen and both front seats in one honest picture.',
    pose: 'sitInBack',
    height: { value: '1.1 m', note: 'between the front headrests' },
    distance: { value: 'Rear seat', note: 'middle of the bench' },
    hold: LANDSCAPE_WIDE,
    steps: [
      'Close all the doors. Sit in the middle of the rear seat.',
      'Slide forward to the edge of the cushion and lean forward.',
      'Hold the phone in landscape between the two front headrests, level with them.',
      'Line the rear-view mirror up with the top-centre of the screen.',
    ],
    checks: [
      'Steering wheel, centre screen and both air vents in frame',
      'Mirror centred at the top',
      'Phone level, not tilted',
    ],
    avoid:
      'Shooting through the gap from too far back. The headrests fill both sides of the picture.',
  },
  {
    slot: 'ODOMETER',
    number: 10,
    title: 'Odometer',
    side: 'From the driver seat',
    purpose:
      'Proves the kilometres in the listing. A clear, readable odometer builds more trust than any other photo.',
    pose: 'sitInDriverSeat',
    height: { value: '1.0 m', note: 'level with the cluster' },
    distance: { value: '≈ 30 cm', note: 'from the cluster' },
    hold: LANDSCAPE,
    steps: [
      'Sit in the driver seat. Turn the ignition ON (engine running is fine) so the cluster lights up.',
      'Wait for any warning lights to go out.',
      'Hold the phone in landscape about 30 cm from the cluster, looking through the top of the steering wheel.',
      'Tap the odometer on screen to focus, then take the photo.',
    ],
    checks: [
      'Kilometre reading sharp and readable',
      'Matches the km you entered in the listing',
      'No glare or reflection of the phone',
    ],
    avoid: 'Shooting with the ignition off. A dark cluster proves nothing.',
  },
];
