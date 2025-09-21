/** @type {import('next').NextConfig} */
const nextConfig = {
  // Resolve workspace root warning
  outputFileTracingRoot: __dirname,
  
  // Server external packages
  serverExternalPackages: ['libsodium-wrappers'],
  
  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Handle libsodium-wrappers properly
    if (!isServer) {
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

module.exports = nextConfig;
