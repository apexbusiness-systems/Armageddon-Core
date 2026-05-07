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

/** @type {import('next').NextConfig} */
const nextConfig = {
    ...(isCloudflareStaticExport ? { output: 'export', images: { unoptimized: true } } : {}),
    experimental: {
        serverComponentsExternalPackages: ['@temporalio/client', '@temporalio/worker', '@temporalio/activity'],
    },
};

export default withPWA(nextConfig);
