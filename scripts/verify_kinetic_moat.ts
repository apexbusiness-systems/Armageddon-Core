
import { createPythonExecutor } from '../armageddon-core/src/infrastructure/python/python-bridge.js';
import * as path from 'path';

async function main() {
    console.log('🔒 Verifying Kinetic IP Moat (Python Bridge)...');
    
    const executor = createPythonExecutor();
    
    try {
        console.log('▶️  Executing bridge test...');
        // Simple python command to verify execution
        const result = await executor.execute({
            args: ['-c', 'print("Kinetic Engine Active")'],
            timeoutMs: 5000
        });

        if (result.exitCode === 0 && result.stdout.includes('Kinetic Engine Active')) {
            console.log('✅ Kinetic Engine Verified: Bridge is functional.');
            console.log('   Stdout:', result.stdout.trim());
        } else {
            console.error('❌ Bridge Test Failed');
            console.error('   Exit:', result.exitCode);
            console.error('   Stdout:', result.stdout);
            console.error('   Stderr:', result.stderr);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Bridge Exception:', error);
        process.exit(1);
    }
}

main();
