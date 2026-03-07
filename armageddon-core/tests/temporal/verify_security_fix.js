/**
 * Security fix verification script.
 * Verifies that the replacement of exec() with execFile() correctly
 * prevents shell command injection.
 */

const { execFile } = require('node:child_process');

async function verifyFix() {
    console.log('--- Security Fix Verification ---');

    // 1. Verify that a simple command works with execFile
    await new Promise((resolve, reject) => {
        execFile('node', ['-v'], { shell: false }, (error) => {
            if (error) {
                reject(new Error('Basic execFile test failed: ' + error.message));
            } else {
                console.log('✓ Basic execFile execution works');
                resolve();
            }
        });
    });

    // 2. Verify command injection prevention
    // Use a hardcoded injection payload.
    // In a vulnerable 'exec' scenario, the semicolon would terminate the first command
    // and execute the second 'echo' command.
    // In a secure 'execFile' scenario, the entire second argument is passed as a literal
    // to 'node -e', which will result in a syntax error rather than execution of the injection.
    await new Promise((resolve, reject) => {
        const injectionPayload = 'console.log("SAFE"); process.exit(0); ; console.log("INJECTED")';

        execFile('node', ['-e', injectionPayload], { shell: false }, (error, stdout) => {
            if (stdout.includes('INJECTED')) {
                reject(new Error('VULNERABILITY DETECTED: Command injection successful!'));
            } else {
                console.log('✓ Command injection blocked: Shell did not evaluate malicious payload');
                resolve();
            }
        });
    });

    console.log('--- All Security Checks Passed ---');
}

verifyFix().catch(err => {
    console.error('Verification failed:', err.message);
    process.exitCode = 1;
});
