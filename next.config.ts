import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { authInterrupts: true },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Не раскрываем стек в заголовке X-Powered-By (TLS и остальные заголовки — на reverse-proxy).
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
