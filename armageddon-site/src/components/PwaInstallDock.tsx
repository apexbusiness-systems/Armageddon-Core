'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    prompt(): Promise<void>;
}

type DockState = 'ready' | 'installed' | 'ios-help' | 'unsupported';

function detectIos(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

export default function PwaInstallDock() {
    const [dockState, setDockState] = useState<DockState>('unsupported');
    const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        // Async IIFE to satisfy react-hooks/set-state-in-effect (setState inside callback)
        void (async () => {
            if (window.matchMedia('(display-mode: standalone)').matches) {
                setDockState('installed');
                return;
            }
            if (detectIos()) {
                setDockState('ios-help');
            }
        })();

        const handler = (e: Event) => {
            e.preventDefault();
            setPromptEvent(e as BeforeInstallPromptEvent);
            setDockState('ready');
        };

        window.addEventListener('beforeinstallprompt', handler);
        window.addEventListener('appinstalled', () => setDockState('installed'));

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    async function handleInstall() {
        if (!promptEvent) return;
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
            setDockState('installed');
        }
        setPromptEvent(null);
    }

    const buttonLabel =
        dockState === 'ready'
            ? 'INSTALL ATS'
            : dockState === 'installed'
              ? 'INSTALLED'
              : dockState === 'ios-help'
                ? 'ADD TO HOME'
                : 'PWA READY';

    const isActionable = dockState === 'ready';

    return (
        <div
            role="region"
            aria-label="PWA Install"
            className={[
                'fixed bottom-4 left-4 z-[20000]',
                'pb-[env(safe-area-inset-bottom,0px)]',
                'pl-[env(safe-area-inset-left,0px)]',
                'w-44',
            ].join(' ')}
            style={{ fontFamily: 'var(--font-mono)' }}
        >
            <div
                className={[
                    'bg-[var(--void)]/95 backdrop-blur-sm',
                    'border border-[var(--aerospace)]/60',
                    'shadow-[0_0_16px_var(--aerospace-glow)]',
                    'p-3 flex flex-col gap-2',
                ].join(' ')}
            >
                {/* Header */}
                <span
                    className="text-[9px] uppercase tracking-widest text-[var(--aerospace)] font-bold"
                    aria-hidden="true"
                >
                    PWA_DOCK
                </span>

                {/* Install / status button */}
                <button
                    type="button"
                    onClick={isActionable ? handleInstall : undefined}
                    disabled={!isActionable}
                    aria-label={
                        dockState === 'ready'
                            ? 'Install Armageddon Test Suite as app'
                            : dockState === 'installed'
                              ? 'App is installed'
                              : dockState === 'ios-help'
                                ? 'Add to Home Screen via Share menu'
                                : 'Install via browser menu'
                    }
                    aria-pressed={dockState === 'installed' ? true : undefined}
                    className={[
                        'w-full text-[9px] uppercase tracking-widest py-1.5',
                        'border transition-colors duration-150',
                        dockState === 'installed'
                            ? 'border-[var(--safe)]/40 text-[var(--safe)]/80 cursor-default'
                            : dockState === 'ready'
                              ? 'border-[var(--aerospace)]/60 text-[var(--aerospace)] hover:bg-[var(--aerospace)]/10 cursor-pointer'
                              : 'border-[var(--tungsten-light)] text-[var(--signal-dim)] cursor-default',
                    ].join(' ')}
                >
                    {buttonLabel}
                </button>

                {/* Contextual helper text */}
                {dockState === 'ios-help' && (
                    <p className="text-[8px] text-[var(--signal-dim)] tracking-wide leading-snug">
                        Share → Add to Home Screen
                    </p>
                )}
                {dockState === 'unsupported' && (
                    <p className="text-[8px] text-[var(--signal-dim)] tracking-wide leading-snug">
                        Use your browser menu to install this app
                    </p>
                )}
            </div>
        </div>
    );
}
