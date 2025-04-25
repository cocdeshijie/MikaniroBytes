/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '*',
        port: '8000',
        pathname: '/previews/**',
      },
    ],
  },
};

export default nextConfig;