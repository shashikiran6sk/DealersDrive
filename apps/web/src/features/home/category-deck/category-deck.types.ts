import type { VehicleCardDto } from '@dealers-drive/contracts';
import type { ReactNode } from 'react';

import type { HomeCategory, HomeCategoryIcon } from '../home.constants';

export interface HomeCategoryView extends HomeCategory {
  href: string;
  cars: readonly VehicleCardDto[];
}

export interface CategoryDeckProps {
  categories: readonly HomeCategoryView[];
}

export interface CategoryCardProps {
  category: HomeCategoryView;
  position: number;
  total: number;
}

export interface CategoryCarsProps {
  category: HomeCategoryView;
}

export interface CategoryIconProps {
  icon: HomeCategoryIcon;
  className?: string;
}

export interface DeckStackProps {
  children: ReactNode;
  className?: string;
}

export interface DeckEdge {
  top: number;
  height: number;
}
