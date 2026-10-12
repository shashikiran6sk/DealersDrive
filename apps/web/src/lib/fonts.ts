import localFont from 'next/font/local';

export const manrope = localFont({
  src: './fonts/manrope-variable.woff2',
  weight: '400 800',
  style: 'normal',
  display: 'swap',
  variable: '--font-manrope',
});
