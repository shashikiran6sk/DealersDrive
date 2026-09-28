'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { SAVE_PARAM, withoutSaveParam } from './saved.constants';

export interface SaveFromUrlProps {
  ready: boolean;
  onIntent: (slug: string) => void;
}

export function SaveFromUrl({ ready, onIntent }: SaveFromUrlProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    const wanted = search.get(SAVE_PARAM);
    if (!wanted || !ready || handled.current) return;
    handled.current = true;
    router.replace(withoutSaveParam(pathname, search.toString()), { scroll: false });
    onIntent(wanted);
  }, [onIntent, pathname, ready, router, search]);

  return null;
}
