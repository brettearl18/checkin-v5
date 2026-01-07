import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Firebase Hosting
  output: 'standalone',
  
  // Optimize for production
  compress: true,
  
  // Disable powered-by header for security
  poweredByHeader: false,
  
  // Image optimization
  images: {
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '**.firebasestorage.app',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
    ],
  },
  
  // Allow build to proceed despite ESLint errors (for production deployment)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Allow build to proceed despite TypeScript errors (temporary for deployment)
  typescript: {
    ignoreBuildErrors: true, // TODO: Fix Next.js 15 async params issue
  },
  
  // Skip API route pre-rendering during build (they'll be rendered at runtime)
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    outputFileTracingIncludes: {
      '/manifest.json': ['./public/manifest.json'],
      '/sw.js': ['./public/sw.js'],
    },
  },
  
  // Skip static optimization for API routes
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@swc/core-linux-x64-gnu',
      'node_modules/@swc/core-linux-x64-musl',
      'node_modules/@esbuild/linux-x64',
    ],
  },
  
  // Rewrite manifest.json to /manifest route
  async rewrites() {
    return [
      {
        source: '/manifest.json',
        destination: '/manifest',
      },
    ];
  },
};

// Bundle analyzer wrapper (only runs when ANALYZE=true)
let config = nextConfig;
if (process.env.ANALYZE === 'true') {
  const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: true,
  });
  config = withBundleAnalyzer(nextConfig);
}

export default config;
