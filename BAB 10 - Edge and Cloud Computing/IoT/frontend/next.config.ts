import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Proxy /api/* to the backend (server-side only, uses INTERNAL_API_URL build arg)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.INTERNAL_API_URL || 'http://localhost:8000'}/api/:path*`,
      },
    ];
  },
  // Output configuration for Docker
  output: 'standalone',
};

export default nextConfig;
