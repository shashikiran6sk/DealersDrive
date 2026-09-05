import type { YardPhotoDto } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { YardPhotoUploader } from '@/features/auth/yard-photo-uploader';

/**
 * DESIGN-SPEC §3.10 step 3 — the yard photograph (C041b).
 *
 * The hero of the dealership's public portfolio, and the reason it is a
 * separate component rather than a fourth row of the KYC checklist: a document
 * row is a tick, this is the image a buyer sees first, and the dealer has to be
 * shown it at a size where they can tell whether it is any good.
 *
 * **The instruction text is the component.** A dealer asked for "a photo" sends
 * a phone snap of a car; a dealer told what the image is *for* — straight on,
 * daylight, the whole frontage, not a logo — sends the shot of the entrance
 * they already have. The cost of that sentence is one line. The cost of not
 * having it is a moderator rejecting the application and a day of round-trip,
 * which is why it is worth looking at rather than reading past.
 *
 * The upload is presign → PUT straight to storage → commit, the same pipeline
 * the documents use, with one difference at the far end: the photograph it
 * replaces is discarded on **commit**, not on presign. A dealer who opens the
 * file picker and changes their mind still has the picture they had before.
 * There is no network in the sandbox, so pressing Upload opens a picker and
 * then fails at `fetch` — honest rather than useful, and the same limit the
 * document stories carry. The two refusals that *are* reachable are the ones
 * checked before anything is signed: a file over 10 MB, or one that is not a
 * JPEG, PNG or WebP. Pick a PDF to see the second.
 *
 * One thing worth knowing while reading the stories: the component keys off
 * `url`, not `mediaId`. The API signs a read whenever the media row exists —
 * unconditionally, not only for `READY` — so the two cannot disagree, and
 * there is no state where a photograph is on file but the frame reads empty.
 */
function photo(overrides: Partial<YardPhotoDto> = {}): YardPhotoDto {
  return {
    mediaId: null,
    status: null,
    fileName: null,
    url: null,
    uploadedAt: null,
    ...overrides,
  };
}

const meta = {
  title: 'Forms/YardPhotoUploader',
  component: YardPhotoUploader,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560, margin: '24px auto', background: '#fff', padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: { photo: { control: 'object' } },
  args: { photo: photo() },
} satisfies Meta<typeof YardPhotoUploader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * Nothing uploaded — where every dealership starts, and the state the
 * instruction text has to carry on its own. Note that there is no Delete
 * button: there is nothing to delete, and a disabled one would be furniture.
 */
export const Empty: Story = { args: { photo: photo() } };

/**
 * Uploaded. The preview is served through a short-lived signed URL rather than
 * a public path, because the dealership is not approved yet and its portfolio
 * is not public until it is.
 *
 * Replace and Delete both appear here. Replace is the same pipeline as a first
 * upload; the displaced image is removed from storage when the new one commits.
 */
export const Uploaded: Story = {
  args: {
    photo: photo({
      mediaId: '00000000-0000-4000-8000-0000000000ff',
      status: 'READY',
      fileName: 'yard-frontage.jpg',
      url: 'https://placehold.co/1200x675/1f2937/e5e7eb.png?text=Yard+frontage',
      uploadedAt: '2026-09-02T09:15:00.000Z',
    }),
  },
};

/**
 * A wide photograph in the same slot. Worth checking by eye: dealers send
 * whatever their phone produced, and the frame has to hold a panorama and a
 * near-square without either one deciding the height of the step.
 */
export const WidePhotograph: Story = {
  args: {
    photo: photo({
      mediaId: '00000000-0000-4000-8000-0000000000fe',
      status: 'READY',
      fileName: 'signboard-panorama.jpg',
      url: 'https://placehold.co/2400x800/0f172a/e2e8f0.png?text=Signboard',
      uploadedAt: '2026-09-02T09:15:00.000Z',
    }),
  },
};
