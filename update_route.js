const fs = require('fs');
const file = 'armageddon-site/src/app/api/run/route.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace imports
content = content.replace(
    "import { checkMembershipResponse, getRunAndVerifyAccess } from '@/lib/auth';",
    "import { checkMembershipResponse, getRunAndVerifyAccess } from '@/lib/auth';\nimport { DEFAULT_BATTERIES } from '@armageddon/shared';"
);

// Remove the in-memory rate limiters definition
content = content.replace(
    /\/\/ ═══════════════════════════════════════════════════════════════════════════\n\/\/ RATE LIMITERS \(MODULE-LEVEL SINGLETONS\)\n\/\/ ═══════════════════════════════════════════════════════════════════════════\n\nconst ipLimiter = new RateLimiter\(\{[\s\S]*?\}\);\n\nconst orgLimiter = new RateLimiter\(\{[\s\S]*?\}\);\n\n/,
    ""
);

content = content.replace(
    "import { RateLimiter } from '@/lib/rate-limit';",
    "import { dbRateLimit } from '@/lib/db-rate-limit';"
);

// Replace default validated batteries
content = content.replace(
    "let validatedBatteries: string[] = ['B10', 'B11', 'B12', 'B13']; // Default: all batteries",
    "let validatedBatteries: string[] = DEFAULT_BATTERIES;"
);

// Replace regex pattern
content = content.replace(
    "const validPattern = /^B1[0-3]$/;",
    "const validPattern = /^B1[0-4]$/;"
);

// Replace error message
content = content.replace(
    "Allowed: B10, B11, B12, B13`",
    "Allowed: ${DEFAULT_BATTERIES.join(', ')}`"
);

// IP Limiter block
const ipLimiterOriginal = `        // Securely identify client IP via Next.js request.ip (handles trusted proxies)
        const ip = request.ip || 'unknown';
        if (!ipLimiter.check(ip)) {
            console.warn(\`[Security] Rate limit exceeded for IP: \${ip}\`);
            return NextResponse.json(
                { success: false, error: 'Too many requests. Please try again in a minute.' },
                { status: 429 }
            );
        }`;

const ipLimiterNew = `        // Securely identify client IP via Next.js request.ip (handles trusted proxies)
        const ip = request.ip || 'unknown';
        const ipLimitResult = await dbRateLimit({ scope: 'ip', key: ip, limit: 10, windowMs: 60 * 1000 });
        if (!ipLimitResult.allowed) {
            console.warn(\`[Security] Rate limit exceeded for IP: \${ip}\`);
            return NextResponse.json(
                { success: false, error: 'Too many requests. Please try again in a minute.' },
                { status: 429 }
            );
        }`;
content = content.replace(ipLimiterOriginal, ipLimiterNew);

// Org Limiter block
const orgLimiterOriginal = `        // 3. Organization-based Rate Limiting
        if (organizationId && !orgLimiter.check(organizationId)) {
            console.warn(\`[Security] Rate limit exceeded for Organization: \${organizationId}\`);
            return NextResponse.json(
                { success: false, error: 'Organization rate limit exceeded. Please try again in a minute.' },
                { status: 429 }
            );
        }`;

const orgLimiterNew = `        // 3. Organization-based Rate Limiting
        if (organizationId) {
            const orgLimitResult = await dbRateLimit({ scope: 'org', key: organizationId, limit: 5, windowMs: 60 * 1000 });
            if (!orgLimitResult.allowed) {
                console.warn(\`[Security] Rate limit exceeded for Organization: \${organizationId}\`);
                return NextResponse.json(
                    { success: false, error: 'Organization rate limit exceeded. Please try again in a minute.' },
                    { status: 429 }
                );
            }
        }`;
content = content.replace(orgLimiterOriginal, orgLimiterNew);

fs.writeFileSync(file, content);
