import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/tenant/:tenantId/accounts',
        destination: '/tenant/:tenantId/contacts',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
