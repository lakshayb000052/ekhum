const { execSync } = require('child_process');

function getProcessesOnPortWindows(port) {
  try {
    const stdout = execSync(`netstat -ano -p tcp`).toString();
    const pids = new Set();
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes(`:${port}`) && line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && pid !== process.pid.toString()) {
          pids.add(pid);
        }
      }
    }
    return Array.from(pids);
  } catch (err) {
    return [];
  }
}

function getProcessesOnPortUnix(port) {
  try {
    const stdout = execSync(`lsof -ti:${port}`).toString();
    return stdout.trim().split('\n').filter(Boolean);
  } catch (err) {
    return [];
  }
}

function freePort(port) {
  const pids = process.platform === 'win32' ? getProcessesOnPortWindows(port) : getProcessesOnPortUnix(port);
  for (const pid of pids) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      } else {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
      }
      console.log(`[DanaPro Port Manager] Freed port ${port} (terminated PID ${pid})`);
    } catch (e) {
      // Ignored
    }
  }
}

const args = process.argv.slice(2).map(Number).filter(n => !isNaN(n));
const targetPorts = args.length > 0 ? args : [3000, 5000, 8080];

for (const port of targetPorts) {
  freePort(port);
}
