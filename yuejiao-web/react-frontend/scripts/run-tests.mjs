import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 规范化路径为标准大写盘符，根治 Windows CMD/PowerShell 盘符大小写不一致导致的 Vitest 双实例 Bug (Vitest Issue #10692, #11011)
const rootDir = fileURLToPath(new URL('..', import.meta.url));
const canonicalCwd = process.platform === 'win32'
  ? rootDir.replace(/^[a-z]:/i, (m) => m.toUpperCase())
  : rootDir;

const vitestCli = path.join(canonicalCwd, 'node_modules', 'vitest', 'vitest.mjs');
const args = ['run', ...process.argv.slice(2)];

const child = spawn(process.execPath, [vitestCli, ...args], {
  cwd: canonicalCwd,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
