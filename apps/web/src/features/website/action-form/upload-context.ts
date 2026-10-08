'use client';

import { createContext } from 'react';

export const WebsiteUploadContext = createContext<(delta: number) => void>(() => undefined);
