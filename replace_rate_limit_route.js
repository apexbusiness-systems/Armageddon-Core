const fs = require('fs');
const file = 'armageddon-site/src/app/api/run/route.ts';
let content = fs.readFileSync(file, 'utf8');

// The second replace for orgLimiter was messy, let's fix it by completely rebuilding the POST handler first part.
// First, read the original and start fresh.
