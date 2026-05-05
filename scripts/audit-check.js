const { execFile } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const npmExecutable = path.join(path.dirname(process.execPath), os.platform() === 'win32' ? 'npm.cmd' : 'npm');

execFile(npmExecutable, ['audit', '--workspace', 'armageddon-site', '--audit-level=critical'], { stdio: 'pipe' }, (error, stdout, stderr) => {
  if (!error) {
    console.log('No critical vulnerabilities found in armageddon-site.');
  } else {
    const output = stdout ? stdout.toString() : '';
    const lines = output.split('\n');
    let hasUnhandledCritical = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Severity: critical')) {
        const packageName = lines[i - 1].trim().split(' ')[0];
        if (packageName !== 'next') {
          hasUnhandledCritical = true;
          console.error(`Unhandled critical vulnerability found in: ${packageName}`);
        }
      }
    }

    if (hasUnhandledCritical) {
      console.error('Audit failed due to unhandled critical vulnerabilities in armageddon-site.');
      process.exitCode = 1;
    } else {
      console.log('Only allowlisted critical vulnerabilities (next) found in armageddon-site. Audit passed.');
    }
  }

  execFile(npmExecutable, ['audit', '--workspace', 'armageddon-core', '--audit-level=critical'], { stdio: 'pipe' }, (error2, stdout2, stderr2) => {
    if (!error2) {
      console.log('No critical vulnerabilities found in armageddon-core.');
      return;
    }

    const output2 = stdout2 ? stdout2.toString() : '';
    const lines2 = output2.split('\n');
    let hasUnhandledCritical2 = false;

    for (let i = 0; i < lines2.length; i++) {
      if (lines2[i].includes('Severity: critical')) {
        const packageName = lines2[i - 1].trim().split(' ')[0];
        if (packageName !== 'uuid') {
          hasUnhandledCritical2 = true;
          console.error(`Unhandled critical vulnerability found in: ${packageName}`);
        }
      }
    }

    if (hasUnhandledCritical2) {
      console.error('Audit failed due to unhandled critical vulnerabilities in armageddon-core.');
      process.exitCode = 1;
    } else {
      console.log('Only allowlisted critical vulnerabilities (uuid) found in armageddon-core. Audit passed.');
    }
  });
});
