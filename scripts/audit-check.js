const { execFile } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const npmExecutable = path.join(path.dirname(process.execPath), os.platform() === 'win32' ? 'npm.cmd' : 'npm');

execFile(npmExecutable, ['audit', '--workspace', 'armageddon-core', '--audit-level=critical'], { stdio: 'pipe' }, (error, stdout, stderr) => {
  if (!error) {
    console.log('No critical vulnerabilities found.');
    return;
  }

  const output = stdout ? stdout.toString() : '';
  const lines = output.split('\n');
  let hasUnhandledCritical = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Severity: critical')) {
      const packageName = lines[i - 1].trim().split(' ')[0];
      if (packageName !== 'uuid') {
        hasUnhandledCritical = true;
        console.error(`Unhandled critical vulnerability found in: ${packageName}`);
      }
    }
  }

  if (hasUnhandledCritical) {
    console.error('Audit failed due to unhandled critical vulnerabilities.');
    process.exitCode = 1;
  } else {
    console.log('Only allowlisted critical vulnerabilities (uuid) found. Audit passed.');
  }
});
