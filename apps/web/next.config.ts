import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /** Workspace packages ship TypeScript-adjacent ESM; let Next compile them. */
  transpilePackages: ['@dealers-drive/contracts'],

  /** A type error must fail the build, in CI and locally. */
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true }, // lint runs as its own turbo task
};

export default nextConfig;
