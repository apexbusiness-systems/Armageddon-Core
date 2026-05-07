const fs = require('fs');
const file = 'packages/shared/src/gate.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /const defaultBatteries = \['B10', 'B11', 'B12', 'B13'\];/g,
    "const defaultBatteries = ['B10', 'B11', 'B12', 'B13', 'B14'];"
);

fs.writeFileSync(file, content);
