/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['picsum.photos']
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false }
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': __dirname,
    }
    return config
  }
}

module.exports = nextConfig 