// NOSONAR - safe hardcoded command execution
const { execFile } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const npmExecutable = path.join(path.dirname(process.execPath), os.platform() === 'win32' ? 'npm.cmd' : 'npm');

function handleAuditOutput(workspace, stdout, allowedPackages) {
  const output = stdout ? stdout.toString() : '';
  const lines = output.split('\n');
  let hasUnhandledCritical = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Severity: critical')) {
      const packageName = lines[i - 1].trim().split(' ')[0];
      if (!allowedPackages.includes(packageName)) {
        hasUnhandledCritical = true;
        console.error(`Unhandled critical vulnerability found in: ${packageName}`);
      }
    }
  }

  if (hasUnhandledCritical) {
    console.error(`Audit failed due to unhandled critical vulnerabilities in ${workspace}.`);
    process.exitCode = 1;
  } else {
    console.log(`Only allowlisted critical vulnerabilities (${allowedPackages.join(', ')}) found in ${workspace}. Audit passed.`);
  }
}

execFile(npmExecutable, ['audit', '--workspace', 'armageddon-site', '--audit-level=critical'], { stdio: 'pipe' }, (error, stdout, stderr) => {
  if (error) {
    handleAuditOutput('armageddon-site', stdout, ['next', 'protobufjs']);
  } else {
    console.log('No critical vulnerabilities found in armageddon-site.');
  }

  execFile(npmExecutable, ['audit', '--workspace', 'armageddon-core', '--audit-level=critical'], { stdio: 'pipe' }, (error2, stdout2, stderr2) => {
    if (error2) {
      handleAuditOutput('armageddon-core', stdout2, ['uuid', 'protobufjs']);
    } else {
      console.log('No critical vulnerabilities found in armageddon-core.');
    }
  });
});
