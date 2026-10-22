import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PUBLIC_PORTFOLIO } from '../../mocks/portfolio';

import { type GalleryPhoto, PhotoGallery } from '@/components/ui/photo-gallery';

const SHADES = ['1f2937', '374151', '4b5563', '0f172a', '1e293b', '334155', '475569', '111827'];
const DEALER = 'Sri Lakshmi Motors';
const DEALER_HERO_STAGE = 'h-[440px] max-lg:h-[340px] max-md:h-auto max-md:aspect-video';
const YARD_FALLBACK = {
  src: '/brand/dealer-directory-cover.svg',
  alt: `Dealers-Drive illustration of a dealership yard, shown until ${DEALER} publishes photographs`,
};
const BROKEN_URL = 'https://media.invalid/by-media/missing/1600.webp';
const STUDIO_TITLE = '2019 Ford Endeavour Titanium 3.2 4x4 AT';

function studioPhoto(label: string, size: string): GalleryPhoto {
  return {
    url: `https://placehold.co/${size}/f6f6f6/3b2a20.png?text=${label}`,
    alt: `${STUDIO_TITLE}, ${label.replaceAll('+', ' ').toLowerCase()}`,
  };
}

const STUDIO_PHOTOS: GalleryPhoto[] = [
  studioPhoto('Front', '1704x1446'),
  studioPhoto('Front+three-quarter', '1868x1444'),
  { url: '/images/home-hero.webp', alt: `${STUDIO_TITLE}, a photograph off the studio backdrop` },
];

function images(count: number, size = '1200x900'): GalleryPhoto[] {
  return Array.from({ length: count }, (_, index) => ({
    url: `https://placehold.co/${size}/${SHADES[index % SHADES.length] ?? '1f2937'}/e5e7eb.png?text=Photo+${index + 1}`,
    alt: `2023 Hyundai Creta SX(O), photograph ${index + 1} of ${count}`,
  }));
}

function dealerPhotos(count: number): GalleryPhoto[] {
  return Array.from({ length: count }, (_, index) => {
    const photo = PUBLIC_PORTFOLIO[index % PUBLIC_PORTFOLIO.length];
    const caption = photo?.caption ?? null;
    return {
      url: photo?.url ?? '/images/home-hero.webp',
      alt: caption ? `${DEALER} — ${caption}` : `${DEALER} dealership, photo ${index + 1}`,
      caption,
    };
  });
}

const meta = {
  title: 'Primitives/PhotoGallery',
  component: PhotoGallery,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720, margin: '24px auto' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    startIndex: { control: { type: 'number', min: 0 } },
    strip: { control: 'boolean' },
    stageClassName: { control: 'text' },
    emptyLabel: { control: 'text' },
    fallback: { control: 'object' },
    variant: { control: 'inline-radio', options: ['cover', 'studio'] },
  },
  args: { title: '2023 Hyundai Creta SX(O)', photos: images(8), startIndex: 0, strip: true },
} satisfies Meta<typeof PhotoGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const StartNotFirst: Story = { args: { startIndex: 3 } };

export const WideHero: Story = {
  args: {
    title: DEALER,
    photos: dealerPhotos(5),
    strip: false,
    stageClassName: DEALER_HERO_STAGE,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1280, margin: '24px auto' }}>
        <Story />
      </div>
    ),
  ],
};

export const WithCaptions: Story = {
  args: { title: DEALER, photos: dealerPhotos(3), strip: true },
};

export const OnePhoto: Story = { args: { photos: images(1) } };

export const NoPhotos: Story = { args: { photos: [] } };

export const EmptyWideHero: Story = {
  args: {
    title: DEALER,
    photos: [],
    strip: false,
    stageClassName: DEALER_HERO_STAGE,
    emptyLabel: 'Dealership photographs coming soon',
    fallback: YARD_FALLBACK,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1280, margin: '24px auto' }}>
        <Story />
      </div>
    ),
  ],
};

export const EmptyWideHeroPhone: Story = {
  ...EmptyWideHero,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 375, margin: '0 auto' }}>
        <Story />
      </div>
    ),
  ],
};

export const BrokenPhotoFallsBack: Story = {
  args: {
    ...EmptyWideHero.args,
    photos: [{ url: BROKEN_URL, alt: `${DEALER} dealership, photo 1` }],
  },
  decorators: EmptyWideHero.decorators,
};

export const BrokenThumbnail: Story = {
  args: {
    photos: images(6).map((photo, index) => (index === 2 ? { ...photo, url: BROKEN_URL } : photo)),
  },
};

export const FallbackImageFails: Story = {
  args: {
    ...EmptyWideHero.args,
    fallback: { ...YARD_FALLBACK, src: '/brand/missing-fallback.svg' },
  },
  decorators: EmptyWideHero.decorators,
};

export const Twenty: Story = { args: { photos: images(20) } };

export const Portrait: Story = { args: { photos: images(6, '900x1200') } };

export const Phone: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360, margin: '0 auto' }}>
        <Story />
      </div>
    ),
  ],
};

export const StudioBackdrop: Story = {
  args: { title: STUDIO_TITLE, photos: STUDIO_PHOTOS, variant: 'studio' },
};

export const StudioBackdropNotStudioFirst: Story = {
  args: { ...StudioBackdrop.args, startIndex: 2 },
};

export const StudioBackdropPhone: Story = {
  ...StudioBackdrop,
  parameters: Phone.parameters,
  decorators: Phone.decorators,
};
