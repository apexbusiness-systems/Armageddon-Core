const fs = require('fs');
const file = 'armageddon-site/src/components/DestructionConsole.tsx';
let content = fs.readFileSync(file, 'utf8');

// I need to change `.channel(\`events-\${runId}\`)` to `.channel(\`run_telemetry_\${runId}\`)` so that it matches what reporter.ts emits.
content = content.replace(
    /channel\(\`events-\$\{runId\}\`\)/g,
    "channel(`run_telemetry_${runId}`)"
);

fs.writeFileSync(file, content);
