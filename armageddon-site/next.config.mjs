const isCloudflareStaticExport = process.env.CLOUDFLARE_STATIC_EXPORT === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
    ...(isCloudflareStaticExport ? { output: 'export', images: { unoptimized: true } } : {
        async headers() {
            return [
                {
                    source: '/(.*)',
                    headers: [
                        { key: 'X-Frame-Options', value: 'DENY' },
                        { key: 'X-Content-Type-Options', value: 'nosniff' },
                        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
                        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
                    ],
                },
            ];
        },
    }),
    serverExternalPackages: ['@temporalio/client', '@temporalio/worker', '@temporalio/activity'],
};

export default nextConfig;
