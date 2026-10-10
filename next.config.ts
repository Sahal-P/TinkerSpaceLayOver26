import type { NextConfig } from "next";

// Baseline security headers. A nonce-based Content-Security-Policy is planned for
// the hardening phase (see docs/PHASES.md) because it forces dynamic rendering.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Recording (Phase 1) needs camera and microphone on our own origin only.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
