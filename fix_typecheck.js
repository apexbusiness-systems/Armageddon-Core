const fs = require('fs');
const file = 'armageddon-core/src/temporal/activities.ts';
let content = fs.readFileSync(file, 'utf8');

// I need to add B14 to type WorkflowState
content = content.replace(
    "    runBattery13_SupplyChain,\n    runBattery14_IndirectInjection,\n    generateReport,",
    "    runBattery13_SupplyChain,\n    runBattery14_IndirectInjection,\n    generateReport,"
);

fs.writeFileSync(file, content);
