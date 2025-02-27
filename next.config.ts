/** @type {import('next').NextConfig} */
const nextConfig: import('next').NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {}, // Change from `true` to `{}` (empty object)
  },

  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/sw.js",
        destination: "/sw.js",
      },
    ];
  },
};

module.exports = nextConfig;
