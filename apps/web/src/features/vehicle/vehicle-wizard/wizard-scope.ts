import { createContext, useContext } from 'react';

import type { WizardScope } from './vehicle-wizard.types';

export const DEALER_SCOPE: WizardScope = { kind: 'dealer' };

export const WizardScopeContext = createContext<WizardScope>(DEALER_SCOPE);

export function useWizardScope(): WizardScope {
  return useContext(WizardScopeContext);
}
