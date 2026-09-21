import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function start(script) {
  if (process.platform === 'win32') {
    return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm run ${script}`], { cwd: repoRoot, stdio: 'inherit' });
  }
  return spawn('npm', ['run', script], { cwd: repoRoot, stdio: 'inherit' });
}

const children = [
  start('dev:backend'),
  start('dev:web'),
];

let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.killed || !child.pid) continue;
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }
  process.exitCode = exitCode;
}

for (const child of children) {
  child.on('error', error => {
    console.error('[FinSight dev] Unable to start a development process:', error.message);
    stop(1);
  });
  child.on('exit', code => {
    if (!stopping && code && code !== 0) stop(code);
  });
}

// Windows sends Ctrl+C to the whole console process group. Let the backend receive
// it directly so PGlite can flush and close instead of immediately forcing the
// npm/cmd process tree down with taskkill /F.
if (process.platform !== 'win32') {
  process.on('SIGINT', () => stop());
  process.on('SIGTERM', () => stop());
}
