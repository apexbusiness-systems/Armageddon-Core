const fs = require('fs');
const file = 'armageddon-core/src/temporal/workflows.ts';
let content = fs.readFileSync(file, 'utf8');

// The instructions require:
// 1. Modify workflows.ts to filter executed batteries exactly to config.batteries.
// 2. Implement BatteryChildWorkflow and utilize executeChild in ArmageddonLevel7Workflow to isolate each battery's execution, bounding history size for high-iteration runs.

// Add executeChild import
content = content.replace(
    "import { proxyActivities, defineSignal, setHandler } from '@temporalio/workflow';",
    "import { proxyActivities, defineSignal, setHandler, executeChild } from '@temporalio/workflow';"
);

// Add B14
content = content.replace(
    "B13: 'B13_SUPPLY_CHAIN',",
    "B13: 'B13_SUPPLY_CHAIN',\n    B14: 'B14_INDIRECT_INJECTION',"
);

// We need to write BatteryChildWorkflow and replace the loop in ArmageddonLevel7Workflow

// Since modifying via simple string replacement might be too fragile for this rewrite,
// let's do a complete rewrite of the file.
