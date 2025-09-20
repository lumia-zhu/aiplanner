import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 优化开发体验
  experimental: {
    // 减少 Fast Refresh 的频率
    optimizePackageImports: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
  },
  
  // 优化编译性能
  swcMinify: true,
  
  // 减少不必要的重新编译
  onDemandEntries: {
    // 页面在内存中保持的时间（毫秒）
    maxInactiveAge: 60 * 1000,
    // 同时保持在内存中的页面数
    pagesBufferLength: 2,
  },

  // 优化图片和资源
  images: {
    domains: [],
  },

  // 减少控制台噪音
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

export default nextConfig;
