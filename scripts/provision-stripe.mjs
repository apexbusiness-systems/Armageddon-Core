import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is required');
    process.exit(1);
}

const headers = {
    'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
};

async function stripeReq(endpoint, data) {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(data)) {
        if (v !== undefined && v !== null) {
            body.append(k, v);
        }
    }
    const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
        method: 'POST',
        headers,
        body: body.toString(),
    });
    const json = await res.json();
    if (!res.ok) {
        console.error(`Stripe error on ${endpoint}:`, json);
        throw new Error(json.error?.message || 'Stripe API error');
    }
    return json;
}

const plans = [
    { id: 'pro', name: 'Pro Tier', amount: 2900, interval: 'month', envVar: 'NEXT_PUBLIC_STRIPE_LINK_PRO_MONTHLY' },
    { id: 'team', name: 'Team Tier', amount: 7900, interval: 'month', envVar: 'NEXT_PUBLIC_STRIPE_LINK_TEAM_MONTHLY' },
    { id: 'verified', name: 'Verified Evidence Review', amount: 49900, interval: null, envVar: 'NEXT_PUBLIC_STRIPE_LINK_VERIFIED_REVIEW' },
    { id: 'certified', name: 'Certified Release Gate', amount: 149900, interval: null, envVar: 'NEXT_PUBLIC_STRIPE_LINK_CERTIFIED_GATE' },
    { id: 'enterprise', name: 'Enterprise Assurance', amount: 499900, interval: 'year', envVar: 'NEXT_PUBLIC_STRIPE_LINK_ENTERPRISE_DEPOSIT' },
];

async function main() {
    let envAdditions = '\n# Auto-provisioned Stripe Payment Links\n';
    
    for (const plan of plans) {
        console.log(`Provisioning ${plan.name}...`);
        
        // 1. Create Product
        const product = await stripeReq('products', {
            name: `Armageddon ${plan.name}`,
            description: `Automated testing and certification for ${plan.name}`,
        });
        
        // 2. Create Price
        const priceData = {
            product: product.id,
            currency: 'cad',
            unit_amount: plan.amount,
        };
        if (plan.interval) {
            priceData['recurring[interval]'] = plan.interval;
        }
        const price = await stripeReq('prices', priceData);
        
        // 3. Create Payment Link
        const link = await stripeReq('payment_links', {
            'line_items[0][price]': price.id,
            'line_items[0][quantity]': 1,
        });
        
        console.log(`-> Created Payment Link: ${link.url}`);
        envAdditions += `${plan.envVar}=${link.url}\n`;
    }
    
    const envPath = path.join(__dirname, '../armageddon-site/.env.local');
    fs.appendFileSync(envPath, envAdditions, 'utf8');
    console.log('Successfully appended URLs to armageddon-site/.env.local');
}

try {
    await main();
} catch (e) {
    console.error(e);
    process.exit(1);
}
