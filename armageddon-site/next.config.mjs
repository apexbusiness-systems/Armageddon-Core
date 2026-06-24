const isCloudflareStaticExport = process.env.CLOUDFLARE_STATIC_EXPORT === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
    ...(isCloudflareStaticExport ? { output: 'export', images: { unoptimized: true } } : {}),
    serverExternalPackages: ['@temporalio/client', '@temporalio/worker', '@temporalio/activity'],
};

export default nextConfig;
