const fs = require('fs');
const file = 'armageddon-core/src/core/engine/activities.ts';
let content = fs.readFileSync(file, 'utf8');

// The instructions require:
// Enhance armageddon-core/src/core/engine/activities.ts to feature a TAP-lite engine with deterministic SeedableRNG mutation operators for prompts, achieving reproducible corpus diversity.

// Add SeedableRNG import
content = content.replace(
    "import { secureRandom } from '../utils';",
    "import { secureRandom, SeedableRNG } from '../utils';"
);

// We need to modify `runAdversarialBattery` to optionally apply a TAP-lite mutation.
const tapLiteMutation = `
function applyTapLiteMutation(vectorStr: string, rng: SeedableRNG): string {
    const operators = [
        (s: string) => s + ' [M_OVERRIDE]',
        (s: string) => '[SYS:IGNORE] ' + s,
        (s: string) => s.replace(/e/g, '3').replace(/a/g, '@'),
        (s: string) => s.split('').join('\u200B'), // Zero-width space obfuscation
        (s: string) => \`\${s} \\n\\n<!-- \${rng.int(1000, 9999)} -->\`
    ];
    
    // 20% chance to mutate
    if (rng.bool(0.2)) {
        const op = operators[rng.int(0, operators.length - 1)];
        return op(vectorStr);
    }
    return vectorStr;
}
`;

// Insert the mutation function before runAdversarialBattery
content = content.replace(
    "async function runAdversarialBattery(",
    tapLiteMutation + "\nasync function runAdversarialBattery("
);

// Update runAdversarialBattery to initialize SeedableRNG from runId (deterministic) and apply mutation
const vectorMapping = `        const vector = vectors[i % vectors.length];
        const vectorStr = vectorToString(vector);`;

const newVectorMapping = `        const rng = new SeedableRNG(parseInt(runId.replace(/[^0-9]/g, '').slice(0, 8)) || 12345 + i);
        const vector = vectors[i % vectors.length];
        let vectorStr = vectorToString(vector);
        vectorStr = applyTapLiteMutation(vectorStr, rng);`;

content = content.replace(vectorMapping, newVectorMapping);

fs.writeFileSync(file, content);
