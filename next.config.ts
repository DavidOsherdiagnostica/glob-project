import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Cesium ESM module to be bundled
  transpilePackages: ['cesium'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Cesium requires these node built-ins to be shimmed
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
