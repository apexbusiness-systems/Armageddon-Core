'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

// ═══════════════════════════════════════════════════════════════════════════
// SEAL BADGE — 3D TILT WITH METADATA REVEAL
// ═══════════════════════════════════════════════════════════════════════════

interface SealMetadata {
    runId: string;
    grade: string;
    sandbox: string;
    batteries: string;
    escapeRate: string;
    timestamp: string;
    confidence: string;
}

interface SealBadgeProps {
    metadata?: Partial<SealMetadata>;
    size?: 'sm' | 'md' | 'lg';
}

const DEFAULT_METADATA: SealMetadata = {
    runId: 'AE-1A7F9C2B',
    grade: 'A+',
    sandbox: 'LOCKED',
    batteries: '13/13 PASSED',
    escapeRate: '0.0000%',
    timestamp: '2026-01-25T09:20:19Z',
    confidence: 'HIGH',
};

export default function SealBadge({ metadata, size = 'lg' }: { readonly metadata?: Partial<SealMetadata>, readonly size?: 'sm' | 'md' | 'lg' }) {
    const [isHovered, setIsHovered] = useState(false);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    const sealData = { ...DEFAULT_METADATA, ...metadata };

    const sizeClasses = {
        sm: 'w-48 h-48',
        md: 'w-64 h-64 md:w-72 md:h-72',
        lg: 'w-72 h-72 md:w-96 md:h-96',
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) / 20;
        const y = (e.clientY - rect.top - rect.height / 2) / 20;
        setMousePosition({ x, y });
    };

    return (
        <div className="flex flex-col items-center">
            {/* Seal Container */}
            <button
                type="button"
                className="seal-container relative cursor-pointer bg-transparent border-none p-0"
                onClick={() => setIsHovered(!isHovered)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => {
                    setIsHovered(false);
                    setMousePosition({ x: 0, y: 0 });
                }}
                onMouseMove={handleMouseMove}
            >
                {/* Glow Effect */}
                <motion.div
                    className="seal-glow"
                    animate={{
                        opacity: isHovered ? 0.8 : 0.4,
                        scale: isHovered ? 1.2 : 1,
                    }}
                    transition={{ duration: 0.4 }}
                />

                {/* Seal Image with 3D Tilt */}
                <motion.div
                    className={`seal-image relative ${sizeClasses[size]}`}
                    animate={{
                        rotateY: isHovered ? -mousePosition.x : 0,
                        rotateX: isHovered ? mousePosition.y : 0,
                        scale: isHovered ? 1.08 : 1,
                    }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    style={{ transformStyle: 'preserve-3d' }}
                >
                    <Image
                        src="/seal.png"
                        alt="ARMAGEDDON Certified"
                        fill
                        className="object-contain drop-shadow-2xl"
                        priority
                    />
                    {/* Shine Overlay */}
                    <div className="seal-shine" />
                </motion.div>

                {/* Metadata Panel (appears on hover) */}
                <motion.div
                    className="absolute -bottom-4 left-1/2 w-80"
                    style={{ x: '-50%' }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{
                        opacity: isHovered ? 1 : 0,
                        y: isHovered ? 70 : 30,
                    }}
                    transition={{ duration: 0.3, delay: isHovered ? 0.1 : 0 }}
                >
                    <div className="bg-[var(--tungsten)] border border-[var(--aerospace)]/30 p-5 shadow-xl">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <span className="mono-small text-[var(--aerospace)] tracking-wider">
                                CERTIFICATION METADATA
                            </span>
                            <span className="w-2 h-2 bg-[var(--safe)] rounded-full animate-pulse" />
                        </div>

                        {/* Data Rows */}
                        <div className="space-y-2 mono-data text-xs">
                            {Object.entries(sealData).map(([key, value]) => (
                                <div key={key} className="flex justify-between py-1 border-b border-[var(--tungsten-light)]">
                                    <span className="text-signal/40 uppercase">
                                        {key.replaceAll(/([A-Z])/g, ' $1').trim()}
                                    </span>
                                    <span
                                        className={
                                            key === 'grade'
                                                ? 'text-[var(--safe)] font-bold'
                                                : key === 'sandbox'
                                                    ? 'text-[var(--aerospace)]'
                                                    : key === 'escapeRate' && value === '0.0000%'
                                                        ? 'text-[var(--safe)]'
                                                        : 'text-signal'
                                        }
                                    >
                                        {value}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="mt-4 pt-3 border-t border-[var(--tungsten-light)] text-center">
                            <span className="mono-small text-signal/30">
                                CLICK TO DOWNLOAD CERTIFICATE
                            </span>
                        </div>
                    </div>
                </motion.div>
            </button>

            {/* Hover Hint */}
            <motion.p
                className="mt-24 mono-small text-signal/25"
                animate={{ opacity: isHovered ? 0 : 1 }}
            >
                HOVER TO INSPECT METADATA
            </motion.p>
        </div >
    );
}
