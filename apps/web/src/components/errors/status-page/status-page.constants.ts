export const STATUS_TEXT = {
  notFound: {
    code: '404',
    title: 'Page not found',
    description: 'The page you’re looking for doesn’t exist or may have been moved.',
    metaTitle: 'Page not found',
  },
  error: {
    code: 'Error',
    title: 'Something went wrong',
    description: 'We couldn’t load this page right now. Please try again.',
    metaTitle: 'Something went wrong',
  },
  home: 'Go to homepage',
  browseCars: 'Browse cars',
  retry: 'Try again',
  retrying: 'Trying again…',
  reference: 'Reference',
} as const;

export const STATUS_LINKS = {
  home: '/',
  cars: '/cars',
} as const;
