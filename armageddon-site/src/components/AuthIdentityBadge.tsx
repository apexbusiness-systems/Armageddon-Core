'use client';

import { motion } from 'framer-motion';
import type { User } from '@supabase/supabase-js';

type AuthIdentityBadgeProps = Readonly<{
    user: User | null;
    direction: 'left' | 'right';
    align: 'left' | 'right';
}>;

export default function AuthIdentityBadge({ user, direction, align }: AuthIdentityBadgeProps) {
    const offset = direction === 'right' ? 20 : -20;
    const operatorId = user?.email?.split('@')[0].toUpperCase() ?? 'OPERATOR';
    const alignmentClass = align === 'right' ? 'text-right' : 'text-left';

    return (
        <motion.div
            initial={{ opacity: 0, x: offset }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: offset }}
            className={`mono-small text-signal/40 text-xs ${alignmentClass} hidden md:block`}
        >
            <div>ID: {operatorId}</div>
            <div className="text-[var(--safe)]">CLEARANCE: LEVEL 8</div>
        </motion.div>
    );
}
