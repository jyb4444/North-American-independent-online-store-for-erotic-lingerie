import { spawn } from 'node:child_process';

function run(command, args, env = process.env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env, stdio: 'inherit' });
    child.once('error', () => resolve(1));
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 128 : 1)));
  });
}

let resetPromise;
function restoreDatabase() {
  resetPromise ??= run('supabase', ['db', 'reset']);
  return resetPromise;
}

let interruptedSignal;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    interruptedSignal = signal;
    const resetStatus = await restoreDatabase();
    if (resetStatus !== 0) console.error('Local database reset failed after interruption.');
    process.exit(resetStatus === 0 ? (signal === 'SIGINT' ? 130 : 143) : resetStatus);
  });
}

let testStatus = 1;
try {
  const fixtureStatus = await run('python3', ['tests/migrations/verify.py', '--legacy-api']);
  if (fixtureStatus !== 0) testStatus = fixtureStatus;
  else {
    testStatus = await run('npx', ['playwright', 'test'], {
      ...process.env,
      E2E_SCHEMA_MODE: 'legacy',
    });
  }
} finally {
  if (!interruptedSignal) {
    const resetStatus = await restoreDatabase();
    if (resetStatus !== 0) {
      console.error('Local database reset failed after the legacy compatibility run.');
      testStatus = resetStatus;
    }
  }
}

process.exit(testStatus);
