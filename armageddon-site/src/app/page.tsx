'use client';

import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import TiersPricing from '@/components/TiersPricing';
import Footer from '@/components/Footer';

export default function Home() {
    return (
        <main className="relative bg-[var(--void)] min-h-screen">
            <Hero />
            <HowItWorks />
            <TiersPricing />
            <Footer />
        </main>
    );
}
