/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@medisync/shared'],
  experimental: {
    optimizePackageImports: ['@medisync/shared'],
  },
};

module.exports = nextConfig;