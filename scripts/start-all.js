/**
 * Single Unified Runner for Doctor Consultation Platform
 * Starts both Backend API (Port 3000) and Frontend Portal (Port 5173) concurrently.
 */
const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.resolve(rootDir, 'careflow-frontend');

console.log('\n======================================================================');
console.log('🩺 OTP HEALTHCARE PLATFORM — UNIFIED SYSTEM LAUNCHER');
console.log('======================================================================');
console.log('🚀 Starting Backend Server (http://localhost:3000)...');
console.log('💻 Starting OTP Frontend (http://localhost:5173)...');
console.log('======================================================================\n');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

// 1. Spawn Backend
const backend = spawn(npmCmd, ['run', 'dev'], {
  cwd: rootDir,
  shell: isWin,
  stdio: 'pipe',
  env: { ...process.env, FORCE_COLOR: '1' },
});

// 2. Spawn Frontend
const frontend = spawn(npmCmd, ['run', 'dev'], {
  cwd: frontendDir,
  shell: isWin,
  stdio: 'pipe',
  env: { ...process.env, FORCE_COLOR: '1' },
});

function pipeOutput(proc, prefix, colorCode) {
  const reset = '\x1b[0m';
  const tag = `${colorCode}[${prefix}]${reset} `;

  proc.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim().length > 0) {
        console.log(`${tag}${line}`);
      }
    });
  });

  proc.stderr.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim().length > 0) {
        console.error(`${tag}${line}`);
      }
    });
  });
}

pipeOutput(backend, 'BACKEND', '\x1b[36m');   // Cyan
pipeOutput(frontend, 'FRONTEND', '\x1b[32m'); // Green

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n🛑 Shutting down backend and frontend services...');

  if (isWin) {
    try { spawn('taskkill', ['/pid', backend.pid, '/f', '/t']); } catch (_) {}
    try { spawn('taskkill', ['/pid', frontend.pid, '/f', '/t']); } catch (_) {}
  } else {
    backend.kill('SIGINT');
    frontend.kill('SIGINT');
  }

  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
backend.on('exit', (code) => {
  if (!shuttingDown && code !== 0) {
    console.error(`\x1b[31m[BACKEND] exited with code ${code}\x1b[0m`);
  }
});
frontend.on('exit', (code) => {
  if (!shuttingDown && code !== 0) {
    console.error(`\x1b[31m[FRONTEND] exited with code ${code}\x1b[0m`);
  }
});
