import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow external images from these domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'scontent.fpnh11-1.fna.fbcdn.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'scontent.fpnh12-1.fna.fbcdn.net',
        pathname: '/**',
      },
      // Add more CDN domains as needed
      // {
      //   protocol: 'https',
      //   hostname: 'your-cdn-domain.com',
      //   pathname: '/**',
      // },
    ],
    // Image optimization settings
    formats: ['image/avif', 'image/webp'],
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // Image sizes for different breakpoints
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Minimum cache time (in seconds)
    minimumCacheTTL: 60,
  },
};

export default nextConfig;
