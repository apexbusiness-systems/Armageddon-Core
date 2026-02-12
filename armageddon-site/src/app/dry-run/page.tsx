'use client';

import DestructionConsole from '@/components/DestructionConsole';
import Footer from '@/components/Footer';

export default function DryRunPage() {
    return (
        <main className="relative bg-[var(--void)] min-h-screen">
            <DestructionConsole standalone />
            <Footer />
        </main>
    );
}
