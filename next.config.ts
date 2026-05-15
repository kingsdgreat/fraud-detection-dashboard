import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serverless-friendly settings for Vercel deployment
  serverExternalPackages: ['@neondatabase/serverless'],

  // Optimize production builds
  experimental: {
    // Enable server actions for future form handling
    serverActions: {
      bodySizeLimit: '10mb', // For CSV uploads
    },
  },

  // Environment variable validation at build time
  env: {
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE || 'true',
  },
};

export default nextConfig;
