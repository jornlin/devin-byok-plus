'use strict';

function esc(arg0) {
  const tmp1 = String(arg0 ?? "");
  return tmp1.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatUptime(arg0) {
  const tmp1 = Math.floor(arg0 / 1000);
  if (tmp1 < 60) {
    return tmp1 + "s";
  }
  const tmp2 = Math.floor(tmp1 / 60);
  if (tmp2 < 60) {
    return tmp2 + "m";
  }
  return Math.floor(tmp2 / 60) + "h" + tmp2 % 60 + "m";
}

module.exports = {
  esc,
  formatUptime
};
