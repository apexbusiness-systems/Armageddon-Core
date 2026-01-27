import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'APEX ARMAGEDDON',
        short_name: 'APEX L7',
        description: 'Adversarial Defense Console // Level 7 Clearance',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
            {
                src: '/icon.svg', // Source Vector
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'maskable'
            },
            {
                src: '/icon.svg', // Fallback (In prod, replace with pngs)
                sizes: '192x192',
                type: 'image/svg+xml',
            },
            {
                src: '/icon.svg', // Fallback
                sizes: '512x512',
                type: 'image/svg+xml',
            },
        ],
    };
}
