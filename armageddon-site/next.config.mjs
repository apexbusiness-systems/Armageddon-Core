/** @type {import('next').NextConfig} */

const CLOUDFLARE_STATIC_EXPORT = process.env.CLOUDFLARE_STATIC_EXPORT === 'true';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig = {
  output: CLOUDFLARE_STATIC_EXPORT ? 'export' : undefined,
  trailingSlash: CLOUDFLARE_STATIC_EXPORT ? true : false,
  images: {
    unoptimized: CLOUDFLARE_STATIC_EXPORT,
  },
  // Security headers only apply in Node.js server mode.
  // Cloudflare Workers static export handles headers at the edge.
  ...(CLOUDFLARE_STATIC_EXPORT
    ? {}
    : {
        async headers() {
          return [
            {
              source: '/:path*',
              headers: securityHeaders,
            },
          ];
        },
      }),
};

export default nextConfig;
