import { spawn } from 'node:child_process';
import path from 'node:path';

const isWin = process.platform === 'win32';
const viteCmd = path.resolve(process.cwd(), 'node_modules', '.bin', 'vite.cmd');
const viteBin = path.resolve(process.cwd(), 'node_modules', '.bin', 'vite');

function spawnVite(args) {
  if (isWin) {
    return spawn('cmd.exe', ['/c', viteCmd, ...args], {
      stdio: 'inherit',
      env: process.env,
      windowsHide: false,
    });
  }

  return spawn(viteBin, args, {
    stdio: 'inherit',
    env: process.env,
  });
}

const dev = spawnVite([]);
const buildWatch = spawnVite(['build', '--watch']);

function shutdown(code) {
  try {
    dev.kill('SIGINT');
  } catch {
    // ignore
  }
  try {
    buildWatch.kill('SIGINT');
  } catch {
    // ignore
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

dev.on('exit', (code) => {
  if (typeof code === 'number' && code !== 0) shutdown(code);
});

buildWatch.on('exit', (code) => {
  if (typeof code === 'number' && code !== 0) shutdown(code);
});
