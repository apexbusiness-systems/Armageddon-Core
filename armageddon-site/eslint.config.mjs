import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
    ...nextVitals,
    {
        ignores: [
            '.next/**',
            'next-env.d.ts',
            'node_modules/**',
            'out/**',
            'public/sw.js',
            'tsconfig.tsbuildinfo',
        ],
    },
];

export default config;
