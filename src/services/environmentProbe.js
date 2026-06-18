'use strict';

/**
 * 环境探测：无状态 I/O 工具（进程命令行、端口占用、产品信息、模型流探测）
 *
 * 从 sidebarProvider.js 抽离。均不依赖 Provider 实例状态：
 * 需要 vscode 的函数通过参数注入。实现逐字保留，保证行为不变。
 */

const net = require('net');
const https = require('https');
const http = require('http');
const path = require('path');
const child_process_1 = require('child_process');
const { ensureGatewayUrl } = require('../utils/gatewayUrl');
const diagnostics = require('./diagnostics');

/**
 * 执行外部命令并返回 stdout 文本
 */
function execFileText(file, args, timeout) {
  return new Promise((resolve, reject) => {
    (0, child_process_1.execFile)(
      file,
      args,
      { timeout, windowsHide: true, maxBuffer: 1048576 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr ? err.message + ': ' + stderr : err.message));
          return;
        }
        resolve(String(stdout || ''));
      }
    );
  });
}

/**
 * 检测端口是否空闲
 */
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

/**
 * 读取与 Devin/Windsurf 相关的进程命令行
 */
async function readWindsurfProcessCommandLines() {
  let out = '';
  if (process.platform === 'win32') {
    const ps =
      "$self=$PID; Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $self -and $_.CommandLine -match '(?i)(devin|windsurf|codeium|language_server)' } | ForEach-Object { $_.CommandLine }";
    try {
      out = await execFileText(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
        3500
      );
    } catch {
      out = await execFileText('wmic.exe', ['process', 'get', 'CommandLine'], 3500);
    }
  } else {
    out = await execFileText('ps', ['-ax', '-o', 'command='], 3500);
  }
  return out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) =>
      /(devin|windsurf|codeium|language_server|devin-server|windsurf-server)/i.test(l)
    )
    .filter((l) => !/Get-CimInstance Win32_Process|wmic\.exe process get CommandLine/i.test(l));
}

/**
 * 读取 Windsurf/IDE 的 product.json 信息
 * @param {object} vscode - 注入的 vscode 模块
 */
function readWindsurfProductInfo(vscode) {
  const appRoot = vscode.env.appRoot || '';
  if (!appRoot) {
    return {
      path: '',
      nameShort: vscode.env.appName || '',
      version: vscode.version || '',
      commit: '',
      quality: '',
    };
  }
  const candidates = [
    path.join(appRoot, 'product.json'),
    path.join(path.dirname(appRoot), 'product.json'),
    path.join(path.dirname(path.dirname(appRoot)), 'product.json'),
  ];
  const seen = new Set();
  for (const c of candidates) {
    const norm = path.normalize(c);
    if (seen.has(norm)) {
      continue;
    }
    seen.add(norm);
    const info = diagnostics.readJsonObject(norm);
    if (info) {
      return {
        path: norm,
        nameShort: String(info.nameShort || info.nameLong || ''),
        version: String(info.version || info.codeVersion || vscode.version || ''),
        commit: String(info.commit || ''),
        quality: String(info.quality || ''),
      };
    }
  }
  return {
    path: '',
    nameShort: vscode.env.appName || '',
    version: vscode.version || '',
    commit: '',
    quality: '',
  };
}

/**
 * 列出占用指定端口的监听进程
 */
async function getPortListeners(port) {
  if (!port) {
    return [];
  }
  try {
    if (process.platform === 'win32') {
      const ps =
        '$ids=Get-NetTCPConnection -LocalPort ' +
        port +
        ' -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($ownerPid in $ids) { $proc=Get-CimInstance Win32_Process -Filter "ProcessId=$ownerPid"; if ($proc) { "$ownerPid $($proc.Name) $($proc.CommandLine)" } else { "$ownerPid" } }';
      const out = await execFileText(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
        3500
      );
      return out
        .split(/\r?\n/)
        .map((l) => diagnostics.sanitizeDiagnosticText(l.trim()))
        .filter(Boolean);
    }
    const out = await execFileText('lsof', ['-nP', '-iTCP:' + port, '-sTCP:LISTEN'], 3500);
    return out
      .split(/\r?\n/)
      .map((l) => diagnostics.sanitizeDiagnosticText(l.trim()))
      .filter(Boolean);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return ['读取监听进程失败：' + diagnostics.sanitizeDiagnosticText(msg)];
  }
}

/**
 * 用配置的默认模型对上游发起一次流式探测，判断首包/链路是否正常
 */
async function probeConfiguredModelStream(config) {
  const requested = String(config.DEFAULT_MODEL || '').trim();
  const model = requested.replace(/-thinking$/i, '');
  const apiKey = config.ANTHROPIC_API_KEY || config.OPENAI_API_KEY || '';
  if (!model) {
    return { ok: false, model: requested || '--', detail: '未设置默认模型' };
  }
  if (!apiKey) {
    return { ok: false, model, detail: '未配置 API Key' };
  }
  if (/^(gpt-|MODEL_GPT)/i.test(model)) {
    return {
      ok: false,
      model,
      detail: '当前探测先覆盖 Claude/Opus 流式链路，请切换默认模型后再测',
    };
  }
  const host = config.ANTHROPIC_API_HOST || '';
  const url = new URL(ensureGatewayUrl(host).replace(/\/+$/, ''));
  const isHttp = url.protocol === 'http:';
  const apiPath = config.ANTHROPIC_API_PATH || '/v1/messages';
  const payload = JSON.stringify({
    model,
    messages: [{ role: 'user', content: 'ping' }],
    stream: true,
    max_tokens: 1,
  });
  const startedAt = Date.now();
  return new Promise((resolve) => {
    let settled = false;
    let firstByteMs;
    let buf = '';
    let req;
    const finish = (ok, detail) => {
      if (settled) {
        return;
      }
      settled = true;
      req.destroy();
      resolve({ ok, model, detail });
    };
    const lib = isHttp ? http : https;
    req = lib.request(
      {
        hostname: url.hostname,
        port: url.port ? Number(url.port) : isHttp ? 80 : 443,
        path: apiPath,
        method: 'POST',
        timeout: 25000,
        rejectUnauthorized: !isHttp && (!url.port || url.port === '443'),
        headers: {
          'content-type': 'application/json',
          accept: 'text/event-stream',
          'anthropic-version': '2023-06-01',
          'x-api-key': apiKey,
          'content-length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          if (firstByteMs === undefined) {
            firstByteMs = Date.now() - startedAt;
          }
          buf += chunk;
          if (buf.length > 4000) {
            buf = buf.slice(-4000);
          }
          if (res.statusCode && res.statusCode !== 200) {
            return;
          }
          const sseErr = diagnostics.classifyProbeSseError(buf);
          if (sseErr) {
            finish(false, sseErr + '；首包 ' + firstByteMs + 'ms，总耗时 ' + (Date.now() - startedAt) + 'ms');
            return;
          }
          if (/event:\s*message_stop|event:\s*content_block_delta|data:\s*\[DONE\]/i.test(buf)) {
            finish(true, 'HTTP 200，首包 ' + firstByteMs + 'ms，总耗时 ' + (Date.now() - startedAt) + 'ms');
          }
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode !== 200) {
            finish(false, diagnostics.classifyProbeHttpStatus(res.statusCode, buf));
            return;
          }
          const sseErr = diagnostics.classifyProbeSseError(buf);
          if (sseErr) {
            finish(false, sseErr);
            return;
          }
          finish(
            firstByteMs !== undefined,
            firstByteMs !== undefined
              ? 'HTTP 200，首包 ' + firstByteMs + 'ms，流已结束'
              : 'HTTP 200，但未收到流式数据，可能被网关转成非 SSE 响应或上游无首包'
          );
        });
      }
    );
    req.on('error', (e) => {
      if (!settled) {
        finish(false, diagnostics.classifyProbeNetworkError(e));
      }
    });
    req.on('timeout', () =>
      finish(
        false,
        '请求超时，' +
          (Date.now() - startedAt) +
          'ms 内未完成；可能是上游首包过慢、模型排队或网络链路阻塞'
      )
    );
    req.end(payload);
  });
}

module.exports = {
  execFileText,
  isPortFree,
  readWindsurfProcessCommandLines,
  readWindsurfProductInfo,
  getPortListeners,
  probeConfiguredModelStream,
};


