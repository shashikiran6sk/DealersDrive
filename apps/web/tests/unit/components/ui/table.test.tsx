import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Table } from '@/components/ui/table';
describe('table scroll guidance', () => {
  it('keeps its named keyboard-focusable region and table caption when hints are enabled', () => {
    render(
      <Table scrollHint caption="Dealer applications" columns={[{ key: 'name', label: 'Dealer' }]}>
        <tr>
          <td>Synthetic dealership</td>
        </tr>
      </Table>,
    );
    expect(screen.getByRole('region', { name: 'Dealer applications' })).toHaveAttribute(
      'tabindex',
      '0',
    );
    expect(screen.getByRole('table', { name: 'Dealer applications' })).toBeInTheDocument();
    expect(screen.getByText('Swipe left or right to see every column.')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.getByRole('table')).not.toHaveAttribute('scrollHint');
  });
  it('preserves existing consumers without opt-in guidance', () => {
    render(
      <Table columns={[{ key: 'name', label: 'Dealer' }]}>
        <tr>
          <td>Synthetic dealership</td>
        </tr>
      </Table>,
    );
    expect(screen.queryByText('Swipe left or right to see every column.')).toBeNull();
    expect(screen.getByRole('region', { name: 'Scrollable records' })).toHaveAttribute(
      'tabindex',
      '0',
    );
  });
});
