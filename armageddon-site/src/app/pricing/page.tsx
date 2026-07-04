import type { Metadata } from 'next';
import { PRICING_COPY } from '@/lib/pricing';
import PricingPageClient from './PricingPageClient';

export const dynamic = 'force-static';

export const metadata: Metadata = {
    title: 'Pricing: Armageddon Test Suite',
    description: PRICING_COPY.subheadline,
};

export default function PricingPage() {
    return <PricingPageClient />;
}
