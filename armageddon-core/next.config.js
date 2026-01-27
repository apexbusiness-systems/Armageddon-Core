/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: [], // FIX: Removed duplicate to resolve conflict
    experimental: {
        serverComponentsExternalPackages: ['@temporalio/client', '@temporalio/worker', '@temporalio/activity'],
    },
};

module.exports = nextConfig;
