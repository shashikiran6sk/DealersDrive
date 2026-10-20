declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';
  const source: ImageSourcePropType;
  export default source;
}

declare module '*.ttf' {
  const source: number;
  export default source;
}

declare module '*.webp' {
  const source: number;
  export default source;
}
declare module '*.svg' {
  const source: number;
  export default source;
}
