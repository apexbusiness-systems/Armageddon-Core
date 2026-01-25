/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ['@temporalio/client'],
    experimental: {
        serverComponentsExternalPackages: ['@temporalio/client', '@temporalio/worker', '@temporalio/activity'],
    },
};

module.exports = nextConfig;
