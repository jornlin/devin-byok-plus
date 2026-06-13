/**
 * Proxy 进程管理
 * 处理进程的启动、停止、监控和端口管理
 */

'use strict';

const { exec, execSync } = require('child_process');
const net = require('net');

/**
 * 获取占用指定端口的进程 PID 列表
 */
function getListeningPids(port) {
  const pids = [];

  try {
    if (process.platform === 'win32') {
      // Windows: netstat
      const output = execSync(`netstat -ano | findstr :${port}`, {
        encoding: 'utf-8',
        timeout: 3000,
        windowsHide: true,
      });

      for (const line of output.split(/\r?\n/)) {
        const match = line.match(/LISTENING\s+(\d+)/);
        if (match) {
          pids.push(Number(match[1]));
        }
      }
    } else {
      // Unix/Linux/macOS: lsof
      const output = execSync(`lsof -ti tcp:${port}`, {
        encoding: 'utf-8',
        timeout: 3000,
      });

      for (const line of output.split(/\r?\n/)) {
        const pid = Number(line.trim());
        if (pid > 0) {
          pids.push(pid);
        }
      }
    }
  } catch (error) {
    // 命令失败可能是端口未被占用
  }

  return Array.from(new Set(pids)); // 去重
}

/**
 * 获取占用端口的进程详情
 */
function getPortOccupantDetail(port) {
  const pids = getListeningPids(port);
  if (pids.length === 0) {
    return null;
  }

  const details = [];
  for (const pid of pids) {
    try {
      let cmdline = '';
      if (process.platform === 'win32') {
        cmdline = execSync(`wmic process where processid=${pid} get commandline /format:list`, {
          encoding: 'utf-8',
          timeout: 2000,
          windowsHide: true,
        }).trim();
      } else {
        cmdline = execSync(`ps -p ${pid} -o command=`, {
          encoding: 'utf-8',
          timeout: 2000,
        }).trim();
      }

      details.push({ pid, cmdline });
    } catch (error) {
      details.push({ pid, cmdline: '<unknown>' });
    }
  }

  return details;
}

/**
 * 杀死进程树（父进程和所有子进程）
 */
async function killProcessTree(pid, signal = 'SIGTERM') {
  if (!pid || pid <= 0) {
    return false;
  }

  try {
    if (process.platform === 'win32') {
      // Windows: taskkill /F /T /PID
      execSync(`taskkill /F /T /PID ${pid}`, {
        timeout: 5000,
        windowsHide: true,
      });
    } else {
      // Unix: kill -TERM -<pgid>（进程组）
      try {
        process.kill(-pid, signal);
      } catch (error) {
        // 如果进程组不存在，尝试直接杀进程
        process.kill(pid, signal);
      }
    }

    return true;
  } catch (error) {
    console.error(`[ProcessManager] Failed to kill process ${pid}:`, error.message);
    return false;
  }
}

/**
 * 杀死占用指定端口的所有进程
 */
async function killListeningPort(port, signal = 'SIGTERM') {
  const pids = getListeningPids(port);
  if (pids.length === 0) {
    return { killed: 0, failed: 0 };
  }

  let killed = 0;
  let failed = 0;

  for (const pid of pids) {
    const success = await killProcessTree(pid, signal);
    if (success) {
      killed++;
    } else {
      failed++;
    }
  }

  // 等待进程退出
  await new Promise((resolve) => setTimeout(resolve, 500));

  return { killed, failed };
}

/**
 * 检查端口是否被占用
 */
function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(false);
    });

    server.listen(port, host);
  });
}

/**
 * 等待端口可用
 */
async function waitForPortAvailable(port, host = '127.0.0.1', timeoutMs = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const inUse = await isPortInUse(port, host);
    if (!inUse) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return false;
}

/**
 * 等待端口被占用（进程启动完成）
 */
async function waitForPortInUse(port, host = '127.0.0.1', timeoutMs = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const inUse = await isPortInUse(port, host);
    if (inUse) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return false;
}

/**
 * 检测外部代理（其他窗口启动的代理）
 */
async function detectExternalProxy(port, host = '127.0.0.1') {
  try {
    const inUse = await isPortInUse(port, host);
    if (!inUse) {
      return false;
    }

    const pids = getListeningPids(port);
    return pids.length > 0;
  } catch (error) {
    return false;
  }
}

module.exports = {
  getListeningPids,
  getPortOccupantDetail,
  killProcessTree,
  killListeningPort,
  isPortInUse,
  waitForPortAvailable,
  waitForPortInUse,
  detectExternalProxy,
};
