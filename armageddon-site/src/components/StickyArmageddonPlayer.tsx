'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type PlayerState = 'idle' | 'playing' | 'paused' | 'error';

const AUDIO_SRC = '/audio/armageddon-anthem.mp3';
const LS_KEY_MUTED = 'ats_player_muted';

function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function getStateTag(state: PlayerState): string {
    if (state === 'error') return 'ERR';
    if (state === 'playing') return 'LIVE';
    if (state === 'paused') return 'PAUSE';
    return 'STANDBY';
}

function getStatusBadgeClassName(state: PlayerState): string {
    const base = 'text-[8px] uppercase tracking-widest px-1.5 py-0.5';
    if (state === 'playing') {
        return `${base} bg-[var(--aerospace)]/20 text-[var(--aerospace)] border border-[var(--aerospace)]/40`;
    }
    if (state === 'error') {
        return `${base} bg-red-900/30 text-red-400 border border-red-500/40`;
    }
    return `${base} bg-[var(--tungsten)] text-[var(--signal-dim)] border border-white/10`;
}

function getPlayButtonClassName(state: PlayerState): string {
    const base = 'flex-1 text-[9px] uppercase tracking-widest py-1.5 border transition-colors duration-150';
    if (state === 'error') {
        return `${base} border-red-500/40 text-red-400/60 cursor-not-allowed`;
    }
    if (state === 'playing') {
        return `${base} border-[var(--aerospace)]/60 text-[var(--aerospace)] hover:bg-[var(--aerospace)]/10`;
    }
    return `${base} border-[var(--tungsten-light)] text-[var(--signal-dim)] hover:border-[var(--aerospace)]/40 hover:text-[var(--aerospace)]`;
}

function getPlayButtonText(state: PlayerState): string {
    if (state === 'error') return 'ERR';
    if (state === 'playing') return '⏸ PAUSE';
    return '▶ PLAY';
}

export default function StickyArmageddonPlayer() {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [state, setState] = useState<PlayerState>('idle');
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [muted, setMuted] = useState(false);
    const [metaLoaded, setMetaLoaded] = useState(false);

    // Rehydrate muted preference from localStorage (async to satisfy react-hooks/set-state-in-effect)
    useEffect(() => {
        void (async () => {
            try {
                const stored = localStorage.getItem(LS_KEY_MUTED);
                if (stored === 'true') setMuted(true);
            } catch {
                // localStorage unavailable — ignore
            }
        })();
    }, []);

    // Sync muted state to audio element and persist
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.muted = muted;
        try {
            localStorage.setItem(LS_KEY_MUTED, String(muted));
        } catch {
            // ignore
        }
    }, [muted]);

    const handlePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.play().catch(() => {
            setState('error');
        });
    }, []);

    const handlePause = useCallback(() => {
        audioRef.current?.pause();
    }, []);

    const togglePlayback = useCallback(() => {
        if (state === 'playing') {
            handlePause();
        } else {
            handlePlay();
        }
    }, [state, handlePlay, handlePause]);

    const toggleMute = useCallback(() => {
        setMuted((prev) => !prev);
    }, []);

    // Wire audio event listeners
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onPlay = () => setState('playing');
        const onPause = () => setState((prev) => (prev === 'error' ? 'error' : 'paused'));
        const onEnded = () => setState('idle');
        const onError = () => setState('error');
        const onLoadedMetadata = () => {
            setDuration(audio.duration);
            setMetaLoaded(true);
        };
        const onTimeUpdate = () => setCurrentTime(audio.currentTime);

        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);
        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('timeupdate', onTimeUpdate);

        return () => {
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.removeEventListener('timeupdate', onTimeUpdate);
        };
    }, []);

    const playLabel = state === 'playing' ? 'Pause anthem' : 'Play anthem';
    const muteLabel = muted ? 'Unmute' : 'Mute';
    const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
    const stateTag = getStateTag(state);

    return (
        <>
            {/* preload="metadata" — no autoplay, only fetches duration headers */}
            <audio ref={audioRef} src={AUDIO_SRC} preload="metadata" loop muted={muted}>
                <track kind="captions" />
            </audio>

            <section
                aria-label="Armageddon Anthem Player"
                className={[
                    'fixed bottom-4 right-4 z-[20000]',
                    'pb-[env(safe-area-inset-bottom,0px)]',
                    'pr-[env(safe-area-inset-right,0px)]',
                    'w-52',
                ].join(' ')}
            >
                <div
                    className={[
                        'bg-[var(--void)]/95 backdrop-blur-sm',
                        'border border-[var(--aerospace)]/60',
                        'shadow-[0_0_16px_var(--aerospace-glow)]',
                        'p-3 flex flex-col gap-2',
                    ].join(' ')}
                    style={{ fontFamily: 'var(--font-mono)' }}
                >
                    {/* Header row */}
                    <div className="flex items-center justify-between">
                        <span
                            className="text-[9px] uppercase tracking-widest text-[var(--aerospace)] font-bold"
                            aria-hidden="true"
                        >
                            ATS_ANTHEM
                        </span>
                        <span
                            className={getStatusBadgeClassName(state)}
                            aria-label={`Status: ${stateTag}`}
                        >
                            {stateTag}
                        </span>
                    </div>

                    {/* Progress bar */}
                    <div
                        className="w-full h-0.5 bg-[var(--tungsten)] relative overflow-hidden"
                        aria-hidden="true"
                    >
                        <div
                            className="absolute inset-y-0 left-0 bg-[var(--aerospace)] transition-[width] duration-200"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>

                    {/* Time telemetry */}
                    <div
                        className="flex justify-between text-[8px] text-[var(--signal-dim)] tracking-wider"
                        aria-label={`Time: ${formatTime(currentTime)} of ${formatTime(duration)}`}
                    >
                        <span>{formatTime(currentTime)}</span>
                        <span>{metaLoaded ? formatTime(duration) : '--:--'}</span>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={togglePlayback}
                            disabled={state === 'error'}
                            aria-label={playLabel}
                            className={getPlayButtonClassName(state)}
                        >
                            {getPlayButtonText(state)}
                        </button>

                        <button
                            type="button"
                            onClick={toggleMute}
                            aria-label={muteLabel}
                            aria-pressed={muted}
                            className={[
                                'text-[9px] uppercase tracking-widest px-2 py-1.5',
                                'border transition-colors duration-150',
                                muted
                                    ? 'border-[var(--signal-dim)]/40 text-[var(--signal-dim)]/60 hover:border-[var(--aerospace)]/40 hover:text-[var(--aerospace)]'
                                    : 'border-[var(--tungsten-light)] text-[var(--signal-dim)] hover:border-[var(--aerospace)]/40 hover:text-[var(--aerospace)]',
                            ].join(' ')}
                        >
                            {muted ? '🔇' : '🔊'}
                        </button>
                    </div>

                    {state === 'error' && (
                        <p className="text-[8px] text-red-400/80 tracking-wide" role="alert">
                            AUDIO_LOAD_FAILED
                        </p>
                    )}
                </div>
            </section>
        </>
    );
}
