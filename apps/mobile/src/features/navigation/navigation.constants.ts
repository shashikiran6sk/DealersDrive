export const TAB_TEXT = Object.freeze({
  home: 'Home',
  cars: 'Cars',
  dealers: 'Dealers',
  saved: 'Saved',
  profile: 'Profile',
});

export const SHELL_TEXT = Object.freeze({
  homeTitle: 'Find your next car',
  homeDescription:
    'Used cars from independent dealerships, photographed by Dealers-Drive and reviewed before they go live.',
  exploreTitle: 'Explore',
  exploreDescription: 'Discover cars and independent dealerships.',
  savedTitle: 'Saved cars',
  savedDescription: 'Cars you have saved, on any device you sign in on.',
  profileTitle: 'Your account',
  profileDescription: 'Your saved cars, enquiries and support requests.',
  browse: 'Explore cars and dealers',
});

export const CUSTOMER_TABS = [
  { route: 'index', label: TAB_TEXT.home, icon: 'home' },
  { route: 'cars', label: TAB_TEXT.cars, icon: 'cars' },
  { route: 'dealers', label: TAB_TEXT.dealers, icon: 'dealers' },
  { route: 'saved', label: TAB_TEXT.saved, icon: 'saved' },
  { route: 'profile', label: TAB_TEXT.profile, icon: 'profile' },
] as const;
