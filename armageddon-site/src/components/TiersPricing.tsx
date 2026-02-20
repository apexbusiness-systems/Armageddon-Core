'use client';

import { motion } from 'framer-motion';

export default function TiersPricing() {
    const features = [
        { name: 'DRY Simulation Runs', self: true, verified: true, certified: true },
        { name: 'Evidence Bundle', self: true, verified: true, certified: true },
        { name: 'APEX Review', self: false, verified: '$2,500/run', certified: true },
        { name: 'Signed Certificate', self: false, verified: true, certified: true },
        { name: 'Destruction-Grade', self: false, verified: 'Add-on', certified: 'Included' },
        { name: 'Re-test Schedule', self: false, verified: false, certified: 'Quarterly' },
        { name: 'Executive Readout', self: false, verified: false, certified: true },
    ];

    return (
        <section className="py-24 bg-[var(--void)] relative">
            <div className="max-w-7xl mx-auto px-4">
                <h2 className="display-medium text-4xl mb-16 text-center text-signal">
                    TIERS
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse border border-[var(--tungsten)]">
                        <thead>
                            <tr className="bg-[var(--deep-space)]">
                                <th className="p-6 text-signal mono-medium">Feature</th>
                                <th className="p-6 text-signal mono-medium text-center">Self-Serve</th>
                                <th className="p-6 text-signal mono-medium text-center">Verified</th>
                                <th className="p-6 text-[var(--aerospace)] mono-medium text-center bg-[var(--aerospace)]/10">Certified</th>
                            </tr>
                        </thead>
                        <tbody>
                            {features.map((f, i) => (
                                <tr key={i} className="border-t border-[var(--tungsten)] hover:bg-[var(--aerospace)]/5 transition-colors">
                                    <td className="p-4 pl-6 text-signal/80 mono-small">{f.name}</td>

                                    <td className="p-4 text-center mono-small text-signal/60">
                                        {f.self === true ? '✅ Free' : f.self === false ? '❌' : f.self}
                                    </td>

                                    <td className="p-4 text-center mono-small text-signal/60">
                                        {f.verified === true ? '✅' : f.verified === false ? '❌' : f.verified}
                                    </td>

                                    <td className="p-4 text-center mono-small text-[var(--aerospace)] bg-[var(--aerospace)]/5 font-bold">
                                        {f.certified === true ? '✅' : f.certified === false ? '❌' : f.certified}
                                    </td>
                                </tr>
                            ))}

                            {/* Price Row */}
                            <tr className="border-t-2 border-[var(--aerospace)] bg-[var(--aerospace)]/10">
                                <td className="p-6 text-[var(--aerospace)] mono-medium">STARTING PRICE</td>
                                <td className="p-6 text-center text-signal mono-medium">FREE</td>
                                <td className="p-6 text-center text-signal mono-medium">$2,500 / run</td>
                                <td className="p-6 text-center text-[var(--aerospace)] mono-medium">$25,000 / year</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
