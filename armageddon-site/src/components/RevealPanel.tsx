'use client';

import { motion } from 'framer-motion';
import type { PropsWithChildren } from 'react';

type RevealPanelProps = PropsWithChildren<Readonly<{
    className: string;
    delay?: number;
}>>;

export default function RevealPanel({ children, className, delay = 0.2 }: RevealPanelProps) {
    return (
        <motion.div
            className={className}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay }}
        >
            {children}
        </motion.div>
    );
}
