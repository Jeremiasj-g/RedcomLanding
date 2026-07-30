/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  webpack(config) {
    // `ws` tries to load these native accelerators when they are available.
    // They are optional and are not required by the browser/server features used here.
    // Resolving them to false avoids noisy/failing module-resolution attempts in Vercel.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      bufferutil: false,
      'utf-8-validate': false,
    };

    return config;
  },
};

module.exports = nextConfig;
