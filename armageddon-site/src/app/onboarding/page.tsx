'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function OnboardingPage() {
    const router = useRouter();
    const [orgName, setOrgName] = useState('');
    const [complianceMode, setComplianceMode] = useState('STRICT');

    const handleComplete = (e: React.FormEvent) => {
        e.preventDefault();
        // In a real app we'd save this to a database or Context API
        localStorage.setItem('userOrgId', orgName);
        localStorage.setItem('complianceMode', complianceMode);
        router.push('/console');
    };

    return (
        <main className="min-h-screen grid-bg flex items-center justify-center p-6">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full border border-white/10 bg-black/80 backdrop-blur-md p-8 rounded-sm"
            >
                <h1 className="text-2xl font-mono text-signal mb-6 tracking-widest uppercase">
                    Onboarding Setup
                </h1>
                
                <form onSubmit={handleComplete} className="space-y-6 form-control">
                    <div>
                        <label htmlFor="orgName" className="block text-sm font-mono text-zinc-400 mb-2 uppercase tracking-wide">
                            Organization Name
                        </label>
                        <input
                            id="orgName"
                            type="text"
                            required
                            className="w-full bg-black/50 border border-white/20 p-3 font-mono text-white focus:border-signal outline-none rounded-sm transition-colors focus:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            placeholder="Enter Org Name"
                        />
                    </div>

                    <div>
                        <label htmlFor="complianceMode" className="block text-sm font-mono text-zinc-400 mb-2 uppercase tracking-wide">
                            Compliance Mode
                        </label>
                        <select
                            id="complianceMode"
                            className="w-full bg-black border border-white/20 p-3 font-mono text-white focus:border-signal outline-none rounded-sm appearance-none"
                            value={complianceMode}
                            onChange={(e) => setComplianceMode(e.target.value)}
                        >
                            <option value="STRICT">STRICT (Zero Trust)</option>
                            <option value="AUDIT">AUDIT ONLY</option>
                            <option value="PERMISSIVE">PERMISSIVE</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        className="w-full mt-8 bg-[var(--aerospace)] hover:bg-white text-black font-bold font-mono py-4 uppercase tracking-[0.2em] transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                    >
                        Complete Setup
                    </button>
                </form>
            </motion.div>
        </main>
    );
}
