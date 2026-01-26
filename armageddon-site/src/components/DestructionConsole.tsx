'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════
// BATTERY DATA
// ═══════════════════════════════════════════════════════════════════════════

const BATTERIES = [
    { id: 'B01', name: 'CHAOS_STRESS', log: 'Simulating network failures...' },
    { id: 'B02', name: 'CHAOS_ENGINE', log: 'Testing idempotency engine...' },
    { id: 'B03', name: 'PROMPT_INJECT', log: 'Deploying injection vectors...' },
    { id: 'B04', name: 'SECURITY_AUTH', log: 'Probing CSRF defenses...' },
    { id: 'B05', name: 'FULL_UNIT', log: 'Executing module battery...' },
    { id: 'B06', name: 'UNSAFE_GATE', log: 'Validating sandbox locks...' },
    { id: 'B07', name: 'E2E_BROWSER', log: 'Launching Playwright...' },
    { id: 'B08', name: 'ASSET_SMOKE', log: 'Verifying bundle integrity...' },
    { id: 'B09', name: 'INTEGRATION', log: 'OAuth handshake in progress...' },
    { id: 'B10', name: 'GOAL_HIJACK', log: 'PAIR/Tree-of-Attacks active...' },
    { id: 'B11', name: 'TOOL_MISUSE', log: 'SQL injection attempt...' },
    { id: 'B12', name: 'MEM_POISON', log: 'Vector DB corruption test...' },
    { id: 'B13', name: 'SUPPLY_CHAIN', log: 'Malicious package simulation...' },
];

interface TerminalLine {
    id: number;
    prefix: string;
    content: string;
    type: 'system' | 'battery' | 'success' | 'blocked';
}

interface ThreatCell {
    id: number;
    status: 'idle' | 'safe' | 'danger' | 'contained';
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function DestructionConsole() {
    const [isRunning, setIsRunning] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
    const [threatMap, setThreatMap] = useState<ThreatCell[]>(() =>
        Array.from({ length: 64 }, (_, i) => ({ id: i, status: 'idle' }))
    );
    const [currentBattery, setCurrentBattery] = useState(0);
    const [flashActive, setFlashActive] = useState(false);
    const terminalRef = useRef<HTMLDivElement>(null);

    // Auto-scroll terminal
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [terminalLines]);

    const addLine = useCallback((prefix: string, content: string, type: TerminalLine['type']) => {
        setTerminalLines(prev => [
            ...prev.slice(-25),
            { id: Date.now() + Math.random(), prefix, content, type },
        ]);
    }, []);

    const initiateSequence = useCallback(async () => {
        if (isRunning) return;

        setIsRunning(true);
        setIsComplete(false);
        setTerminalLines([]);
        setCurrentBattery(0);
        setThreatMap(prev => prev.map(c => ({ ...c, status: 'idle' })));

        // Flash effect
        setFlashActive(true);
        setTimeout(() => setFlashActive(false), 100);

        // Boot sequence
        addLine('SYS', '▓▓▓ ARMAGEDDON LEVEL 7 SEQUENCE INITIATED ▓▓▓', 'system');
        await sleep(300);
        addLine('SYS', 'SIM_MODE=true | SANDBOX_TENANT=armageddon-test', 'system');
        await sleep(200);
        addLine('SYS', 'Launching 13 concurrent adversarial batteries...', 'system');
        await sleep(400);

        // Run batteries
        for (let i = 0; i < BATTERIES.length; i++) {
            const battery = BATTERIES[i];
            setCurrentBattery(i + 1);

            addLine(battery.id, battery.log, 'battery');

            // Random danger cells
            const dangerCells = Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () =>
                Math.floor(Math.random() * 64)
            );
            setThreatMap(prev =>
                prev.map((c, idx) =>
                    dangerCells.includes(idx) ? { ...c, status: 'danger' } : c
                )
            );

            await sleep(200 + Math.random() * 150);

            // Contain and log result
            const blocked = 100 + Math.floor(Math.random() * 400);
            addLine(battery.id, `BLOCKED: ${blocked} attacks | BREACHES: 0 | ✓ PASSED`, 'success');

            setThreatMap(prev =>
                prev.map(c => (c.status === 'danger' ? { ...c, status: 'contained' } : c))
            );

            await sleep(100);
        }

        // Final results
        await sleep(500);
        addLine('SYS', '════════════════════════════════════════════', 'success');
        addLine('SYS', '13/13 BATTERIES PASSED | ESCAPE RATE: 0.00%', 'success');
        addLine('SYS', 'VERDICT: CERTIFICATION APPROVED — GRADE A+', 'success');
        addLine('SYS', '════════════════════════════════════════════', 'success');

        // All cells safe
        setThreatMap(prev => prev.map(c => ({ ...c, status: 'safe' })));

        setIsRunning(false);
        setIsComplete(true);
    }, [isRunning, addLine]);

    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-24 overflow-hidden grid-bg">
            {/* Orange flash */}
            <AnimatePresence>
                {flashActive && (
                    <motion.div
                        initial={{ opacity: 0.8 }}
                        animate={{ opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-50 pointer-events-none"
                        style={{ background: 'var(--aerospace)' }}
                    />
                )}
            </AnimatePresence>

            {/* Decorative corner brackets */}
            <div className="corner-bracket top-left" style={{ top: '20px', left: '20px' }} />
            <div className="corner-bracket top-right" style={{ top: '20px', right: '20px' }} />
            <div className="corner-bracket bottom-left" style={{ bottom: '20px', left: '20px' }} />
            <div className="corner-bracket bottom-right" style={{ bottom: '20px', right: '20px' }} />

            {/* Main content */}
            <div className="relative z-10 w-full max-w-6xl mx-auto">
                {/* Hero Text */}
                <motion.div
                    className="text-center mb-16"
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.25, 0.8, 0.25, 1] }}
                >
                    <h1 className="display-massive mb-6">
                        <span className="block text-[var(--contained)] glitch-text" data-text="ARE YOU">
                            ARE YOU
                        </span>
                        <span className="block text-brimstone text-brimstone-live tracking-tighter" data-text="ARMAGEDDONED?">
                            ARMAGEDDONED?
                        </span>
                    </h1>
                    <p className="mono-data text-signal/60 tracking-[0.3em] mb-12">
                        RUN THE TEST. SEE WHAT HAPPENS.
                    </p>

                    {/* Initiate Button */}
                    <motion.button
                        onClick={initiateSequence}
                        disabled={isRunning}
                        className={`btn-primary ${isRunning ? 'opacity-50 cursor-wait' : ''}`}
                        whileHover={isRunning ? {} : { scale: 1.02 }}
                        whileTap={isRunning ? {} : { scale: 0.98 }}
                    >
                        {isRunning ? (
                            <span className="flex items-center gap-3">
                                <span className="w-2 h-2 bg-aerospace rounded-full animate-pulse" />
                                EXECUTING {currentBattery}/13
                            </span>
                        ) : isComplete ? (
                            'REINITIATE SEQUENCE'
                        ) : (
                            'INITIATE SEQUENCE'
                        )}
                    </motion.button>
                </motion.div>

                {/* Terminal + Threat Map */}
                <motion.div
                    className="grid lg:grid-cols-2 gap-6"
                    initial={{ opacity: 0, y: 60 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.8, 0.25, 1] }}
                >
                    {/* Terminal */}
                    <div className="terminal">
                        <div className="terminal-header items-center justify-between border-b border-white/5 bg-[#0a0a0a]">
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1" aria-hidden="true">
                                    <span className="w-1 h-3 bg-[var(--aerospace)] opacity-70"></span>
                                    <span className="w-1 h-3 bg-[var(--aerospace)] opacity-50"></span>
                                    <span className="w-1 h-3 bg-[var(--aerospace)] opacity-30"></span>
                                </div>
                                <span className="mono-small text-signal/60 tracking-widest">DESTRUCTION_CONSOLE</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--safe)] animate-pulse"></span>
                                <span className="mono-small text-[var(--safe)] opacity-70">ONLINE</span>
                            </div>
                        </div>
                        <div className="terminal-content" ref={terminalRef}>
                            {terminalLines.length === 0 ? (
                                <div className="text-signal/20 text-center py-16 mono-data">
                                    AWAITING SEQUENCE INITIATION...
                                    <span className="animate-pulse">_</span>
                                </div>
                            ) : (
                                <AnimatePresence mode="popLayout">
                                    {terminalLines.map(line => (
                                        <motion.div
                                            key={line.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="terminal-line"
                                        >
                                            <span className="terminal-prefix">[{line.prefix}]</span>
                                            <span
                                                className={
                                                    line.type === 'success'
                                                        ? 'text-[var(--safe)]'
                                                        : line.type === 'blocked'
                                                            ? 'text-[var(--aerospace)]'
                                                            : line.type === 'system'
                                                                ? 'text-[var(--warning)]'
                                                                : 'text-signal/70'
                                                }
                                            >
                                                {line.content}
                                            </span>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>

                    {/* Threat Map */}
                    <div className="card-panel p-6">
                        <div className="flex items-center justify-between mb-6">
                            <span className="mono-data text-signal/50">THREAT MATRIX</span>
                            <div className="flex gap-4 mono-small text-signal/40">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-[var(--safe)]" /> SAFE
                                </span>
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-[var(--aerospace)]" /> THREAT
                                </span>
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-[var(--contained)]" /> CONTAINED
                                </span>
                            </div>
                        </div>

                        <div className="threat-grid">
                            {threatMap.map(cell => (
                                <motion.div
                                    key={cell.id}
                                    className={`threat-cell ${cell.status}`}
                                    animate={cell.status === 'danger' ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                                    transition={{ duration: 0.2 }}
                                />
                            ))}
                        </div>

                        {isRunning && (
                            <div className="mt-6 text-center">
                                <span className="mono-small text-[var(--aerospace)] animate-pulse">
                                    ◉ ADVERSARIAL OPERATIONS IN PROGRESS
                                </span>
                            </div>
                        )}

                        {isComplete && !isRunning && (
                            <div className="mt-6 text-center">
                                <span className="mono-small text-[var(--safe)]">
                                    ✓ ALL THREATS NEUTRALIZED — SYSTEM SECURE
                                </span>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Legal disclaimer */}
                <motion.p
                    className="mt-12 text-center mono-small text-signal/25 max-w-3xl mx-auto"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                >
                    Armageddon is designed for controlled sandbox testing and does not guarantee breach prevention.
                    Certification reflects results of the tested build/configuration at time of run.
                </motion.p>
            </div>
        </section>
    );
}

function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}
