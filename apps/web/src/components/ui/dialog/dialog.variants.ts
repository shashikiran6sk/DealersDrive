export type DialogVariant = 'card' | 'fullscreen' | 'sheet' | 'drawer';

export interface DialogVariantClasses {
  overlay: string;
  content: string;
  header: string;
  title: string;
  description: string;
  close: string;
  body: string;
  closeShowsLabel: boolean;
}

export const DIALOG_VARIANTS: Record<DialogVariant, DialogVariantClasses> = {
  drawer: {
    overlay: 'fixed inset-0 z-70 bg-black/45 md:hidden',
    content:
      'fixed inset-y-0 left-0 z-71 flex w-[min(320px,calc(100vw-32px))] flex-col overflow-hidden bg-white shadow-lg md:hidden dd-mobile-drawer',
    header:
      'flex flex-none items-center justify-between gap-3 border-b border-(--color-divider) p-4',
    title: 'text-[18px]',
    description: 'text-[13px] ink-muted',
    close: 'btn btn-secondary size-11 flex-none rounded-full border-transparent p-0 text-[15px]',
    body: 'min-h-0 flex-1 overflow-y-auto overscroll-contain p-4',
    closeShowsLabel: false,
  },
  card: {
    overlay: 'dialog-backdrop',
    content:
      'fixed top-1/2 left-1/2 z-71 max-w-[calc(100vw-28px)] -translate-x-1/2 -translate-y-1/2 dialog max-h-[calc(100svh-28px)] gap-0 overflow-hidden p-0',
    header:
      'flex items-start justify-between gap-4 border-b border-(--color-divider) px-[22px] py-[16px]',
    title: '',
    description: 'mt-[2px] text-[13px] ink-muted',
    close: 'btn btn-secondary h-9 w-9 flex-none rounded-full border-transparent p-0 text-[15px]',
    body: 'min-h-0 flex-1 overflow-y-auto px-[22px] py-[18px]',
    closeShowsLabel: false,
  },
  fullscreen: {
    overlay: 'fixed inset-0 z-70 bg-[#0d1017]',
    content: 'fixed inset-0 z-71 flex h-dvh w-screen flex-col bg-[#0d1017] text-white',
    header:
      'flex h-[54px] flex-none items-center justify-between gap-4 border-b border-white/15 px-4',
    title: 'truncate text-[15px] text-white',
    description: 'text-[12px] text-white/60 tnum',
    close:
      'btn btn-secondary h-10 flex-none gap-[6px] border-white/35 bg-transparent px-3 text-[14px] text-white hover:bg-white/10',
    body: 'relative flex min-h-0 flex-1 overflow-hidden',
    closeShowsLabel: true,
  },
  sheet: {
    overlay: 'fixed inset-0 z-70 bg-[rgb(20_23_28/0.45)] dd-sheet-backdrop',
    content:
      'fixed inset-x-0 bottom-0 z-71 flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-[20px] bg-white dd-sheet',
    header:
      'flex flex-none items-center justify-between gap-4 border-b border-(--color-divider) px-[18px] py-[12px]',
    title: 'text-[19px]',
    description: 'mt-[2px] text-[13px] ink-muted',
    close: 'btn btn-secondary h-11 w-11 flex-none rounded-full border-transparent p-0 text-[15px]',
    body: 'min-h-0 flex-1 overflow-y-auto px-[18px] py-[16px]',
    closeShowsLabel: false,
  },
};
