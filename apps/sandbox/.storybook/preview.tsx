import type { Preview } from '@storybook/nextjs-vite';

// The real token sheet, not a copy — reached through `preview.css`, which adds
// the two `@source` roots Tailwind cannot infer from here. If F007's @theme
// block stops rendering outside Next, this is where it shows up.
import '../src/preview.css';

/**
 * Viewport presets are the four widths the product's own class names break at,
 * read off `apps/web/src` rather than invented.
 */
const preview: Preview = {
  parameters: {
    layout: 'centered',
    viewport: {
      options: {
        mobile: { name: 'Mobile 375', styles: { width: '375px', height: '780px' } },
        tablet: { name: 'Tablet 768', styles: { width: '768px', height: '1024px' } },
        laptop: { name: 'Laptop 1024', styles: { width: '1024px', height: '768px' } },
        desktop: { name: 'Desktop 1280', styles: { width: '1280px', height: '900px' } },
      },
    },
  },
};

export default preview;
