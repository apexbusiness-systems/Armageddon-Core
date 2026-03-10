/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
        serverComponentsExternalPackages: ['@temporalio/client', '@temporalio/worker', '@temporalio/activity'],
    },
};

module.exports = nextConfig;
