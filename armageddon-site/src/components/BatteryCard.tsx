'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Battery } from '@armageddon/shared';

interface BatteryCardProps {
    battery: Battery;
    index: number;
    isExpanded: boolean;
    isHovered: boolean;
    onToggle: () => void;
    onHoverChange: (hovered: boolean) => void;
    isLarge: boolean;
}

export default function BatteryCard({
    battery,
    index,
    isExpanded,
    isHovered,
    onToggle,
    onHoverChange,
    isLarge
}: Readonly<BatteryCardProps>) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.05 }}
            onClick={onToggle}
            onMouseEnter={() => onHoverChange(true)}
            onMouseLeave={() => onHoverChange(false)}
            className={`
                card-panel cursor-pointer
                ${battery.godMode ? 'card-highlight' : ''}
                ${isLarge ? 'lg:col-span-2 lg:max-w-[calc(50%-0.5rem)] lg:mx-auto' : ''}
            `}
        >
            {/* God Mode badge */}
            {battery.godMode && (
                <div className="absolute -top-px -right-px bg-[var(--aerospace)] px-2 py-0.5 z-10">
                    <span className="mono-small text-white text-[9px]">GOD MODE</span>
                </div>
            )}

            {/* Main content */}
            <div className={`flex items-center gap-5 p-5 ${battery.godMode ? 'pr-24' : ''}`}>
                {/* Status light */}
                <div className={`status-light ${battery.godMode ? 'amber' : 'green'}`} />

                {/* Battery ID */}
                <span className="mono-data text-[var(--aerospace)] w-8">
                    {battery.id}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h3 className="display-medium text-signal tracking-wider mb-2">
                        {battery.name}
                    </h3>
                    <p className="mono-small text-signal/50 truncate">
                        {battery.description}
                    </p>
                </div>

                {/* Expand indicator */}
                <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    className="text-signal/30"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 9l6 6 6-6" />
                    </svg>
                </motion.div>
            </div>

            {/* Expanded terminal */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-5">
                            <div className="bg-black/60 border border-[var(--tungsten-light)] p-4 font-mono text-sm">
                                <span className="text-[var(--safe)]">{battery.attackVector}</span>
                                <span className="animate-pulse ml-1">_</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hover glow line */}
            <motion.div
                className="absolute bottom-0 left-0 h-[2px] bg-[var(--aerospace)]"
                initial={{ width: 0 }}
                animate={{ width: isHovered ? '100%' : 0 }}
                transition={{ duration: 0.3 }}
            />
        </motion.div>
    );
}
