import { render, screen } from '@testing-library/react-native';
import type * as ReactNative from 'react-native';
import { SvgXml } from 'react-native-svg';

import vectors from '../src/assets/brand/vectors.json';
import { Brand, BrandSymbol, BrandWordmark } from '../src/components/brand';

jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual<typeof ReactNative>('react-native');
  return { SvgXml: jest.fn((props: React.ComponentProps<typeof SvgXml>) => <View {...props} />) };
});

it('uses the exact black symbol on light surfaces and preserves its aspect ratio', async () => {
  await render(<BrandSymbol height={24} />);
  expect(screen.getByRole('image', { name: 'Dealers-Drive' })).toBeOnTheScreen();
  const svg = jest.mocked(SvgXml).mock.calls.at(-1)?.[0];
  expect(svg?.xml).toBe(vectors['dd-icon-black']);
  expect(Number(svg?.width) / Number(svg?.height)).toBeCloseTo(651 / 424);
});

it('selects the approved white geometry on dark surfaces', async () => {
  const view = await render(<BrandSymbol surface="dark" />);
  expect(jest.mocked(SvgXml).mock.calls.at(-1)?.[0].xml).toBe(vectors['dd-icon-white']);
  await view.rerender(<BrandWordmark surface="dark" width={136} />);
  const svg = jest.mocked(SvgXml).mock.calls.at(-1)?.[0];
  expect(svg?.xml).toBe(vectors['dealersdrive-wordmark-white']);
  expect(Number(svg?.width) / Number(svg?.height)).toBeCloseTo(1092 / 145);
});

it('keeps symbol and wordmark independent with one accessible lockup label', async () => {
  await render(<Brand />);
  expect(screen.getAllByRole('image', { name: 'Dealers-Drive' })).toHaveLength(1);
  expect(jest.mocked(SvgXml).mock.calls.map(([props]) => props.xml)).toEqual([
    vectors['dd-icon-black'],
    vectors['dealersdrive-wordmark-black'],
  ]);
  expect(screen.queryByText('Dealers-Drive')).toBeNull();
});
