/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'utfs.io',
      },
      {
        protocol: 'https',
        hostname: 'uploadthing.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      }
    ],
  },
  // UploadThing için gerekli ayarlar
  experimental: {
    serverComponentsExternalPackages: ["uploadthing"],
  }
};

module.exports = nextConfig;
