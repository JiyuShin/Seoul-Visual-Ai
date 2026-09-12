/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };

    if (!isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        webgazer: 'webgazer',
        '@mediapipe/face_mesh': '@mediapipe/face_mesh',
      });
    }

    return config;
  },
};

module.exports = nextConfig;
