import type { Metadata } from 'next';
import PrivacyPageClient from './PrivacyPageClient';

// ════════════════════════════════════════════════════════════════════════════
// ARMAGEDDON — PRIVACY POLICY
// Canadian / PIPEDA jurisdiction with GDPR acknowledgment
// ════════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Privacy Policy: ARMAGEDDON Test Suite',
  description: 'ARMAGEDDON Test Suite Privacy Policy. APEX Business Systems Ltd. Canadian jurisdiction (PIPEDA) with GDPR acknowledgment.',
};

export default function PrivacyPage() {
  return <PrivacyPageClient />;
}
