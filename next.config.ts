import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/tannent', destination: '/tenant', permanent: false },
      { source: '/tannent/:tenantId', destination: '/tenant/:tenantId/chat', permanent: false },
      {
        source: '/tannent/:tenantId/chat',
        destination: '/tenant/:tenantId/chat',
        permanent: false,
      },
      {
        source: '/tenant/:tenantId/accounts',
        destination: '/tenant/:tenantId/contacts',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/embed/chat',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: 'frame-ancestors https: http://localhost:* http://127.0.0.1:*',
          },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
