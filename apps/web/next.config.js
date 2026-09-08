/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: 'apps/mobile/dist',
  transpilePackages: ['@medisync/shared'],
  experimental: {
    optimizePackageImports: ['@medisync/shared'],
  },
};

module.exports = nextConfig;
