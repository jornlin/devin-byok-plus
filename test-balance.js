// 余额端点诊断脚本 - 运行: node test-balance.js
const fs = require('fs'), https = require('https'), os = require('os'), path = require('path');

const d = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.devin-byok-plus/profiles.json')));
const activeProfile = d.profiles.find(p => p.id === d.activeId) || d.profiles[0];
const b1 = activeProfile.byok1 || {};
const host = (b1.host || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const apiKey = b1.key || '';
const balanceToken = activeProfile.balanceToken || '';
const userId = activeProfile.userId || '';

console.log('=== 诊断信息 ===');
console.log('Host:', host);
console.log('ApiKey:', apiKey.slice(0, 8) + '...');
console.log('BalanceToken:', balanceToken.slice(0, 8) + '...');
console.log('UserId:', userId);
console.log('');

const base = 'https://' + host;

const tests = [
  ['userId-方案', '/api/user/self', { 'Authorization': 'Bearer ' + apiKey, 'New-Api-User': userId }],
  ['token-无Bearer', '/api/user/self', { 'Authorization': balanceToken }],
  ['token-有Bearer', '/api/user/self', { 'Authorization': 'Bearer ' + balanceToken }],
  ['apikey-user-info', '/api/user/info', { 'Authorization': 'Bearer ' + apiKey, 'New-Api-User': userId }],
  ['apikey-v1-balance', '/v1/user/balance', { 'Authorization': 'Bearer ' + apiKey }],
];

let i = 0;
function next() {
  if (i >= tests.length) { console.log('\n=== 完成 ==='); return; }
  const [label, ep, hdrs] = tests[i++];
  const req = https.request({
    hostname: host.split(':')[0],
    port: host.includes(':') ? parseInt(host.split(':')[1]) : 443,
    path: ep,
    method: 'GET',
    rejectUnauthorized: false,
    timeout: 8000,
    headers: { ...hdrs, 'Content-Type': 'application/json' },
  }, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      console.log(`[${label}] HTTP${res.statusCode} ${ep}`);
      try {
        const j = JSON.parse(body);
        console.log('  响应:', JSON.stringify(j).slice(0, 300));
      } catch {
        console.log('  响应(raw):', body.slice(0, 200));
      }
      console.log('');
      next();
    });
  });
  req.on('error', e => { console.log(`[${label}] ERROR: ${e.message}\n`); next(); });
  req.on('timeout', () => { req.destroy(); console.log(`[${label}] TIMEOUT\n`); next(); });
  req.end();
}
next();
