import type { ConfigContext } from 'expo/config';
import { buildConfig } from './config/build-config.cjs';

export default ({ config }: ConfigContext) =>
  buildConfig({ name: 'Dealers-Drive', slug: 'dealers-drive-customer', ...config }, process.env);
