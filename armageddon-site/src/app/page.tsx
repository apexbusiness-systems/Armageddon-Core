import DestructionConsole from '@/components/DestructionConsole';
import BatteryGrid from '@/components/BatteryGrid';
import CertificationSeal from '@/components/CertificationSeal';
import Footer from '@/components/Footer';

// ═══════════════════════════════════════════════════════════════════════════
// ARMAGEDDON.ICU — CONTAINMENT FIELD INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

export default function Home() {
    return (
        <main className="relative bg-[var(--void)] min-h-screen">
            {/* HERO: DESTRUCTION CONSOLE */}
            <DestructionConsole />

            {/* DIVIDER */}
            <div className="section-divider" />

            {/* BATTERY GRID */}
            <BatteryGrid />

            {/* DIVIDER */}
            <div className="section-divider" />

            {/* CERTIFICATION SEAL */}
            <CertificationSeal />

            {/* DIVIDER */}
            <div className="section-divider" />

            {/* FOOTER & CTA */}
            <Footer />
        </main>
    );
}
