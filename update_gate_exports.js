const fs = require('fs');
const file = 'packages/shared/src/gate.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('export const DEFAULT_BATTERIES')) {
    content = content.replace(
        "const TIER_FEATURES",
        "export const DEFAULT_BATTERIES = ['B10', 'B11', 'B12', 'B13', 'B14'];\n\nconst TIER_FEATURES"
    );
    
    content = content.replace(
        "const defaultBatteries = ['B10', 'B11', 'B12', 'B13', 'B14'];",
        "const defaultBatteries = DEFAULT_BATTERIES;"
    );
    
    fs.writeFileSync(file, content);
}
