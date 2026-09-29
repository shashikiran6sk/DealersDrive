import { INTERIORS, paintFor } from './colors.mjs';
import {
  bootShot,
  dashboardShot,
  frontSeatsShot,
  infotainmentShot,
  rearSeatsShot,
  steeringShot,
} from './interior.mjs';
import { rngFor } from './rng.mjs';
import {
  PHOTO_H,
  PHOTO_W,
  faceShot,
  lampDetail,
  sideShot,
  wheelDetail,
  yardContextShot,
} from './shots.mjs';

const GRILLE_BY_MAKE = {
  'Maruti Suzuki': 'chrome',
  Hyundai: 'mesh',
  Tata: 'mesh',
  Mahindra: 'slats',
  Honda: 'chrome',
  Toyota: 'wide',
  Kia: 'slats',
  Renault: 'mesh',
  Skoda: 'slats',
  Volkswagen: 'wide',
  MG: 'chrome',
  Nissan: 'chrome',
};

const SCREEN_ACCENTS = ['#2f7df6', '#11a3a3', '#e0663a', '#7b5cf0', '#2ea06b'];

export function carTraits(vehicle) {
  const rng = rngFor(`car:${vehicle.id}`);
  const body = vehicle.body ?? 'SUV';
  const premium = body === 'LUXURY' || vehicle.pricePaise >= 150_000_000;
  const themes = premium
    ? ['studioDark', 'studioLight', 'studioCool']
    : ['studioLight', 'studioLight', 'studioCool', 'studioWarm'];
  return {
    body,
    paint: paintFor(vehicle.color ?? 'WHITE', rng.next),
    wheelStyle: rng.pick(
      vehicle.budget ? ['cover', 'ten', 'multi'] : ['five', 'ten', 'multi', 'five'],
    ),
    wheelTone: rng.pick(['silver', 'silver', 'dark']),
    grilleStyle: GRILLE_BY_MAKE[vehicle.make] ?? rng.pick(['slats', 'mesh', 'chrome', 'wide']),
    lampStyle: rng.pick(['slim', 'big']),
    interior: INTERIORS[rng.int(0, INTERIORS.length - 1)],
    theme: rng.pick(themes),
    facing: rng.chance(0.5) ? 'left' : 'right',
    accent: rng.pick(SCREEN_ACCENTS),
  };
}

export const FEATURED_SHOTS = [
  'hero',
  'front',
  'side-opposite',
  'rear',
  'dashboard',
  'front-seats',
  'rear-seats',
  'infotainment',
  'steering',
  'boot',
  'wheel',
  'headlamp',
  'tail-lamp',
  'at-the-yard',
];

export const STANDARD_SHOTS = ['hero', 'front', 'rear', 'dashboard', 'rear-seats'];

export const SHOT_LABELS = {
  hero: 'Side profile',
  front: 'Front',
  'side-opposite': 'Opposite side profile',
  rear: 'Rear',
  dashboard: 'Dashboard',
  'front-seats': 'Front seats',
  'rear-seats': 'Rear seats',
  infotainment: 'Infotainment',
  steering: 'Steering wheel and instruments',
  boot: 'Boot',
  wheel: 'Wheel and tyre',
  headlamp: 'Headlamp detail',
  'tail-lamp': 'Tail-lamp detail',
  'at-the-yard': 'At the dealership',
};

export function shotsFor(vehicle) {
  return vehicle.tier === 'featured' ? FEATURED_SHOTS : STANDARD_SHOTS;
}

export function renderShot(vehicle, shot) {
  const car = carTraits(vehicle);
  const opposite = car.facing === 'left' ? 'right' : 'left';
  const size = { width: PHOTO_W, height: PHOTO_H };
  switch (shot) {
    case 'hero':
      return { ...size, svg: sideShot({ car, facing: car.facing, theme: car.theme }).svg };
    case 'side-opposite':
      return { ...size, svg: sideShot({ car, facing: opposite, theme: car.theme }).svg };
    case 'front':
      return { ...size, svg: faceShot({ car, view: 'front', theme: car.theme }).svg };
    case 'rear':
      return { ...size, svg: faceShot({ car, view: 'rear', theme: car.theme }).svg };
    case 'dashboard':
      return { ...size, svg: dashboardShot({ interior: car.interior, accent: car.accent }) };
    case 'front-seats':
      return { ...size, svg: frontSeatsShot({ interior: car.interior }) };
    case 'rear-seats':
      return { ...size, svg: rearSeatsShot({ interior: car.interior }) };
    case 'infotainment':
      return {
        ...size,
        svg: infotainmentShot({ interior: car.interior, accent: car.accent, variant: 'map' }),
      };
    case 'steering':
      return { ...size, svg: steeringShot({ interior: car.interior, accent: car.accent }) };
    case 'boot':
      return {
        ...size,
        svg: bootShot({ paint: car.paint, interior: car.interior, body: car.body }),
      };
    case 'wheel':
      return {
        ...size,
        svg: wheelDetail(sideShot({ car, facing: car.facing, theme: car.theme }), 'front'),
      };
    case 'headlamp':
      return { ...size, svg: lampDetail(faceShot({ car, view: 'front', theme: car.theme })) };
    case 'tail-lamp':
      return { ...size, svg: lampDetail(faceShot({ car, view: 'rear', theme: car.theme })) };
    case 'at-the-yard':
      return {
        ...size,
        svg: yardContextShot({
          car,
          dealerKey: vehicle.dealerSlug,
          state: vehicle.state,
          facing: car.facing,
        }),
      };
    default:
      throw new Error(`Unknown shot "${shot}"`);
  }
}
