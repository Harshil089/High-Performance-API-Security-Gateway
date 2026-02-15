/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  output: 'standalone',
  env: {
    GATEWAY_URL: process.env.GATEWAY_URL || 'http://localhost:8080',
  },
};

export default nextConfig;
