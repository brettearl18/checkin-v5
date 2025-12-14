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
    domains: [],
  },
};

export default nextConfig;
