import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
    dest: "public",
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    reloadOnOnline: true,
    swcMinify: true,
    disable: process.env.NODE_ENV === "development",
    workboxOptions: {
        disableDevLogs: true,
    },
});

const isCloudflareStaticExport = process.env.CLOUDFLARE_STATIC_EXPORT === 'true';

// Security headers applied on all routes when running as a Node.js server.
// In Cloudflare static-export mode these are omitted because the edge
// (Workers / Pages) is responsible for setting headers.
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

/** @type {import('next').NextConfig} */
const nextConfig = {
    ...(isCloudflareStaticExport ? { output: 'export', images: { unoptimized: true } } : {}),
    experimental: {
        serverComponentsExternalPackages: ['@temporalio/client', '@temporalio/worker', '@temporalio/activity'],
    },
    ...(isCloudflareStaticExport
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

export default withPWA(nextConfig);
