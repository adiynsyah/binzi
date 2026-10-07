import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // forbidden() 403 interrupts (card A-12) — still experimental in
    // Next 16.3.7 (docs: 03-api-reference/05-config/01-next-config-js/authInterrupts).
    authInterrupts: true,
  },
};

export default nextConfig;
