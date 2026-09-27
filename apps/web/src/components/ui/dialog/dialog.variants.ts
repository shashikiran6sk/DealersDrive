export type DialogVariant = 'card' | 'fullscreen';

export interface DialogVariantClasses {
  overlay: string;
  content: string;
  header: string;
  title: string;
  description: string;
  close: string;
  body: string;
}

export const DIALOG_VARIANTS: Record<DialogVariant, DialogVariantClasses> = {
  card: {
    overlay: 'dialog-backdrop',
    content:
      'fixed top-1/2 left-1/2 z-71 max-w-[calc(100vw-28px)] -translate-x-1/2 -translate-y-1/2 dialog max-h-[calc(100svh-28px)] gap-0 overflow-hidden p-0',
    header:
      'flex items-start justify-between gap-4 border-b border-(--color-divider) px-[18px] py-[14px]',
    title: '',
    description: 'mt-[2px] text-[13px] ink-muted',
    close: 'btn btn-secondary h-9 w-9 flex-none border-transparent p-0 text-[15px]',
    body: 'min-h-0 flex-1 overflow-y-auto px-[18px] py-[16px]',
  },
  fullscreen: {
    overlay: 'fixed inset-0 z-70 bg-[#0d1017]',
    content: 'fixed inset-0 z-71 flex h-dvh w-screen flex-col bg-[#0d1017] text-white',
    header:
      'flex h-[54px] flex-none items-center justify-between gap-4 border-b border-white/15 px-4',
    title: 'truncate text-[15px] text-white',
    description: 'text-[12px] text-white/60 tnum',
    close:
      'btn btn-secondary h-10 w-10 flex-none border-white/35 bg-transparent p-0 text-[15px] text-white hover:bg-white/10',
    body: 'relative flex min-h-0 flex-1 overflow-hidden',
  },
};
