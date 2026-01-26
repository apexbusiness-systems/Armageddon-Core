'use client';

import DestructionConsole from '@/components/DestructionConsole';

export default function ConsolePage() {
    return (
        <main className="relative bg-[var(--void)] min-h-screen">
            <DestructionConsole standalone={true} />
        </main>
    );
}
