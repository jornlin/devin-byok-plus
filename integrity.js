'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEVICE_ID_KEY = 'windsurf-byok-bridge.deviceId';

function generateDeviceId() {
  const seed = [os.hostname(), os.platform(), os.arch(), os.cpus()[0]?.model ?? '', os.userInfo().username, os.homedir()].join('|');
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 32);
}

function getDeviceId(context) {
  let id = context.globalState.get(DEVICE_ID_KEY);
  if (!id) {
    id = generateDeviceId();
    context.globalState.update(DEVICE_ID_KEY, id);
  }
  return id;
}

function getClientVersion(extensionPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(extensionPath, 'package.json'), 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

exports.getDeviceId = getDeviceId;
exports.getClientVersion = getClientVersion;
