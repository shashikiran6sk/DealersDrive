'use client';
import { createContext, useContext, type ReactNode } from 'react';
const LegalContext = createContext(false);
export function LegalProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <LegalContext.Provider value={enabled}>{children}</LegalContext.Provider>;
}
export function useLegalEnabled(): boolean {
  return useContext(LegalContext);
}
