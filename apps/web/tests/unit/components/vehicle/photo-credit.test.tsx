import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PhotoCredit } from '@/components/vehicle/photo-credit';

const DEALER = 'Sri Lakshmi Motors';

describe('PhotoCredit', () => {
  it('credits the Dealers-Drive team when it took every photograph', () => {
    render(<PhotoCredit credit="DEALERS_DRIVE" dealerName={DEALER} />);
    expect(screen.getByText('Photographed by Dealers-Drive')).toBeInTheDocument();
    expect(screen.getByText('Taken by our team at the dealership.')).toBeInTheDocument();
  });

  it('says the dealership supplied them and Dealers-Drive reviewed them', () => {
    render(<PhotoCredit credit="DEALER" dealerName={DEALER} />);
    expect(screen.getByText('Dealer photos · Reviewed by Dealers-Drive')).toBeInTheDocument();
    expect(
      screen.getByText(`Supplied by ${DEALER} and checked against our photo standard.`),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Photographed by Dealers-Drive/)).not.toBeInTheDocument();
  });

  it('names both when both took some', () => {
    render(<PhotoCredit credit="MIXED" dealerName={DEALER} />);
    expect(screen.getByText(`Photos by Dealers-Drive and ${DEALER}`)).toBeInTheDocument();
  });

  it('claims no photographer while the credit is unrecorded', () => {
    render(<PhotoCredit credit={null} dealerName={DEALER} />);
    expect(
      screen.getByText('Every photograph is checked against the Dealers-Drive photo standard.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Photographed by|Dealer photos|Photos by/)).not.toBeInTheDocument();
  });

  it('is the label alone, with no disclosure or list under it', () => {
    const { container } = render(<PhotoCredit credit="DEALER" dealerName={DEALER} />);
    expect(container.querySelector('details, summary, ul')).toBeNull();
    expect(container.querySelectorAll('p')).toHaveLength(2);
  });
});
