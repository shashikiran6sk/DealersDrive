export interface BrandAssetProps {
  surface?: 'light' | 'dark';
  decorative?: boolean;
}

export interface BrandSymbolProps extends BrandAssetProps {
  height?: number;
}

export interface BrandWordmarkProps extends BrandAssetProps {
  width?: number;
}
