/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@arogyasetu/shared'],
  experimental: {
    optimizePackageImports: ['@arogyasetu/shared'],
  },
};

module.exports = nextConfig;