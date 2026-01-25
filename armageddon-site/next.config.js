/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        domains: [],
        unoptimized: false,
    },
    // Vercel Edge optimization
    experimental: {
        serverActions: {
            allowedOrigins: ['armageddon.icu', 'localhost:3000'],
        },
    },
};

module.exports = nextConfig;
