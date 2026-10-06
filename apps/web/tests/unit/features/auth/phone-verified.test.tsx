import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PhoneVerified } from '@/features/auth/phone-verification/phone-verified';

/**
 * A number proved on a Google-first account may already belong to the same
 * person's customer account. The two are joined server-side; this card is
 * where the person is told, so the saved cars appearing is not a surprise.
 */
describe('PhoneVerified', () => {
  it('says the accounts were joined when the server linked them', () => {
    render(
      <PhoneVerified display="98400 12345" fullName="Ravi" accountsLinked onContinue={vi.fn()} />,
    );

    expect(screen.getByText(/already had a Dealers-Drive account/)).toBeInTheDocument();
  });

  it('says nothing about linking for an ordinary verification', () => {
    render(<PhoneVerified display="98400 12345" fullName="Ravi" onContinue={vi.fn()} />);

    expect(screen.queryByText(/already had a Dealers-Drive account/)).not.toBeInTheDocument();
    expect(screen.getByText('Ravi')).toBeInTheDocument();
  });
});
