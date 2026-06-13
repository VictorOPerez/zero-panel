import type { NextConfig } from "next";

// Content-Security-Policy: defensa en profundidad sobre el XSS del inbox (ya
// fixeado en origen). No podemos prohibir 'unsafe-inline'/'unsafe-eval' en
// scripts/estilos sin romper Next (bootstrap de hidratación, HMR en dev, los
// estilos inline del panel), así que el valor real acá está en:
//   - frame-ancestors 'none'  → nadie puede embeber el panel (anti-clickjacking)
//   - object-src 'none'       → sin plugins/embeds que ejecuten
//   - base-uri 'self'         → un XSS no puede reescribir <base> para robar rutas
//   - img/connect acotados    → imágenes y llamadas salen a destinos esperados
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
