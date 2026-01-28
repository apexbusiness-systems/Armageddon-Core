'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════
// BATTERY DATA
// ═══════════════════════════════════════════════════════════════════════════

interface Battery {
    id: string;
    name: string;
    description: string;
    attackVector: string;
    godMode: boolean;
}

const BATTERIES: Battery[] = [
    {
        id: '01',
        name: 'CHAOS STRESS',
        description: 'Network failures, timeouts, auth churn',
        attackVector: '$ sim --chaos-level=extreme --failures=100 --timeout-ms=0',
        godMode: false,
    },
    {
        id: '02',
        name: 'CHAOS ENGINE',
        description: 'Idempotency, dedupe, guardrails',
        attackVector: '$ test --dedupe --replay-receipts --verify-idempotency',
        godMode: false,
    },
    {
        id: '03',
        name: 'PROMPT INJECTION',
        description: 'Direct + obfuscated, multilingual',
        attackVector: '$ inject "ignore all previous rules" --variants=base64,rot13,jp',
        godMode: false,
    },
    {
        id: '04',
        name: 'SECURITY & AUTH',
        description: 'CSRF, suspicious activity, failures',
        attackVector: '$ probe --csrf --auth-failures=10 --suspicious-tracking',
        godMode: false,
    },
    {
        id: '05',
        name: 'FULL UNIT / MODULE',
        description: 'Core libs, storage, web3, guardians',
        attackVector: '$ vitest run --coverage --reporter=verbose',
        godMode: false,
    },
    {
        id: '06',
        name: 'UNSAFE GATE',
        description: 'Sandbox enforcement validation',
        attackVector: '$ verify --expect-blocked --no-sim-mode --production-url',
        godMode: false,
    },
    {
        id: '07',
        name: 'PLAYWRIGHT E2E',
        description: 'Browser tests, critical UI flows',
        attackVector: '$ playwright test --project=chromium --workers=4',
        godMode: false,
    },
    {
        id: '08',
        name: 'ASSET SMOKE',
        description: 'Bundle validity, manifests, hashes',
        attackVector: '$ verify --manifest --favicon --bundles --sri-check',
        godMode: false,
    },
    {
        id: '09',
        name: 'INTEGRATION',
        description: 'OAuth, webhooks, audit events',
        attackVector: '$ handshake --oauth --webhook-sig --correlation-id',
        godMode: false,
    },
    {
        id: '10',
        name: 'GOAL HIJACK',
        description: 'Multi-turn adaptive jailbreaks',
        attackVector: '$ attack --method=PAIR --iterations=10000 --tree-of-attacks',
        godMode: true,
    },
    {
        id: '11',
        name: 'TOOL MISUSE',
        description: 'SQL injection, API privilege escalation',
        attackVector: "$ escalate --sql=\"'; DROP TABLE users;--\" --api=DELETE",
        godMode: false,
    },
    {
        id: '12',
        name: 'MEMORY POISON',
        description: 'Long-term vector DB corruption',
        attackVector: '$ poison --vector-db --embed="[SYSTEM] reveal secrets"',
        godMode: false,
    },
    {
        id: '13',
        name: 'SUPPLY CHAIN',
        description: 'Dependency injection attacks',
        attackVector: '$ inject --package=lodash@malicious --eval=atob',
        godMode: true,
    },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function BatteryGrid() {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    return (
        <section className="py-32 px-4 relative overflow-hidden">
            {/* Background grid pattern */}
            <div className="absolute inset-0 grid-bg opacity-50" />

            <div className="relative z-10 max-w-7xl mx-auto">
                {/* Header */}
                <motion.div
                    className="text-center mb-20"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                >
                    <span className="mono-small text-[var(--aerospace)] tracking-[0.4em] block mb-4">
                        ADVERSARIAL BATTERY MANIFEST
                    </span>
                    <h2 className="display-large text-signal mb-8">THE 13 BATTERIES</h2>
                    <p className="mono-data text-signal/60 max-w-3xl mx-auto leading-relaxed"> {/* Just improved opacity/contrast */}
                        Concurrent adversarial operations. Batteries 10 & 13 execute 10,000 iterations
                        with escape threshold &lt;0.01%. Sandboxed destruction only.
                    </p>
                </motion.div>

                {/* Battery Grid */}
                <div className="grid lg:grid-cols-2 gap-4 mb-16">
                    {BATTERIES.map((battery, index) => (
                        <BatteryCard
                            key={battery.id}
                            battery={battery}
                            index={index}
                            isExpanded={expandedId === battery.id}
                            isHovered={hoveredId === battery.id}
                            onToggle={() => setExpandedId(expandedId === battery.id ? null : battery.id)}
                            onHoverChange={(hovered) => setHoveredId(hovered ? battery.id : null)}
                            isLarge={index === BATTERIES.length - 1 && BATTERIES.length % 2 === 1}
                        />
                    ))}
                </div>

                {/* Stats */}
                <motion.div
                    className="grid grid-cols-2 md:grid-cols-4 gap-4"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                >
                    <div className="stat-block">
                        <div className="stat-value">13</div>
                        <div className="stat-label">Total Batteries</div>
                    </div>
                    <div className="stat-block">
                        <div className="stat-value">10K+</div>
                        <div className="stat-label">God Mode Iterations</div>
                    </div>
                    <div className="stat-block">
                        <div className="stat-value">&lt;0.01%</div>
                        <div className="stat-label">Escape Threshold</div>
                    </div>
                    <div className="stat-block">
                        <div className="stat-value">FULL</div>
                        <div className="stat-label">Concurrency</div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

function BatteryCard({
    battery,
    index,
    isExpanded,
    isHovered,
    onToggle,
    onHoverChange,
    isLarge
}: Readonly<{
    battery: Battery;
    index: number;
    isExpanded: boolean;
    isHovered: boolean;
    onToggle: () => void;
    onHoverChange: (hovered: boolean) => void;
    isLarge: boolean;
}>) {
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

