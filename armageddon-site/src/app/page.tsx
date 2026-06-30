'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DestructionConsole from '@/components/DestructionConsole';
import BatteryGrid from '@/components/BatteryGrid';
import CertificationSeal from '@/components/CertificationSeal';
import Footer from '@/components/Footer';
import type { Status } from '@/components/social/LeaderboardWidget';
import { getSupabase } from '@/lib/supabase';

export default function Home() {
    const [simStatus, setSimStatus] = useState<Status>('idle');
    const [authState, setAuthState] = useState<'loading' | 'anonymous' | 'authenticated'>('loading');
    const router = useRouter();

    useEffect(() => {
        let cancelled = false;
        const sb = getSupabase();
        if (!sb) {
            queueMicrotask(() => {
                if (!cancelled) setAuthState('anonymous');
            });
            return;
        }
        sb.auth.getUser().then(({ data }) => {
            if (cancelled) return;
            const next = data.user ? 'authenticated' : 'anonymous';
            setAuthState(next);
            if (next === 'authenticated') router.replace('/console');
        });
        const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
            const next = session?.user ? 'authenticated' : 'anonymous';
            setAuthState(next);
            if (next === 'authenticated') router.replace('/console');
        });
        return () => {
            cancelled = true;
            subscription.unsubscribe();
        };
    }, [router]);

    if (authState === 'loading' || authState === 'authenticated') {
        return (
            <main className="relative bg-[var(--void)] min-h-screen grid-bg flex items-center justify-center">
                <p className="mono-small text-signal/70 tracking-widest uppercase">Loading Armageddon workspace…</p>
            </main>
        );
    }

    return (
        <main className="relative bg-[var(--void)] min-h-screen">
            <div className="relative">
                <DestructionConsole standalone onStatusChange={setSimStatus} status={simStatus} />
            </div>
            <div className="section-divider" />
            <BatteryGrid />
            <div className="section-divider" />
            <CertificationSeal />
            <div className="section-divider" />
            <Footer />
        </main>
    );
}
