'use strict';

const https = require('https');

const REPO_SLUG = 'jornlin/devin-byok-plus';
const GITHUB_API_URL = `https://api.github.com/repos/${REPO_SLUG}/releases/latest`;
// 兜底：只打了 tag 但没建 Release 时，/releases/latest 拿不到新版本，
// 需要回退到 tag 列表（见 fetchLatestTag）。
const GITHUB_TAGS_URL = `https://api.github.com/repos/${REPO_SLUG}/tags?per_page=50`;
const REPO_HTML_URL = `https://github.com/${REPO_SLUG}`;
const RELEASES_HTML_URL = `${REPO_HTML_URL}/releases`;
const CHECK_INTERVAL_MS = 3600000;
const LAST_CHECK_KEY = 'devin-byok-plus.lastVersionCheck';
const DISMISSED_VERSION_KEY = 'devin-byok-plus.dismissedVersion';
const CACHED_LATEST_VERSION_KEY = 'devin-byok-plus.cachedLatestVersion';
const CACHED_LATEST_URL_KEY = 'devin-byok-plus.cachedLatestReleaseUrl';

/** 语义化版本号（允许 v 前缀、允许 -beta 之类后缀），用于过滤非版本 tag */
const SEMVER_TAG_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

class VersionChecker {
  constructor(context, currentVersion) {
    this.context = context;
    this.currentVersion = currentVersion;
    // 从 globalState 恢复上次检查到的最新版本信息，避免 IDE 重启后一小时内无法显示更新提示
    this.latestVersion = context.globalState.get(CACHED_LATEST_VERSION_KEY) || null;
    this.latestReleaseUrl = context.globalState.get(CACHED_LATEST_URL_KEY) || null;
    this.checkTimer = null;
    /** 最近一次检查是否失败（网络/限流），用于在 UI 上区分"已是最新"和"查不到" */
    this.lastError = null;
    this.checking = false;
    /** 检查完成后的回调，让侧栏能在后台检查结束时刷新（不必等下一次 getStatus） */
    this.onDidChange = null;
  }

  /** 仓库主页，供「插件信息」卡片直接跳转 */
  getRepoUrl() {
    return REPO_HTML_URL;
  }

  start() {
    this.checkForUpdates();
    this.checkTimer = setInterval(() => {
      this.checkForUpdates();
    }, CHECK_INTERVAL_MS);
  }

  stop() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * 检查更新。
   * @param {boolean} force 用户手动点「检查更新」时传 true，跳过 1 小时节流。
   *   之前手动检查也走节流，导致刚发版时用户主动点按钮却什么都不会发生。
   */
  async checkForUpdates(force = false) {
    const lastCheck = this.context.globalState.get(LAST_CHECK_KEY);
    const now = Date.now();

    if (!force && lastCheck && now - lastCheck < CHECK_INTERVAL_MS) {
      return this.getUpdateInfo();
    }

    this.checking = true;
    try {
      const resolved = await this.resolveLatestVersion();

      if (resolved && resolved.version) {
        this.latestVersion = resolved.version;
        this.latestReleaseUrl = resolved.url;
        this.lastError = null;

        // 持久化最新版本信息到 globalState，重启后仍能在一小时内显示更新提示
        await this.context.globalState.update(CACHED_LATEST_VERSION_KEY, this.latestVersion);
        await this.context.globalState.update(CACHED_LATEST_URL_KEY, this.latestReleaseUrl);
        await this.context.globalState.update(LAST_CHECK_KEY, now);
      }
    } catch (error) {
      this.lastError = error.message;
      console.error('[Version Checker] Failed to check for updates:', error.message);
    } finally {
      this.checking = false;
    }

    const info = this.getUpdateInfo();
    try {
      this.onDidChange?.(info);
    } catch (err) {
      console.error('[Version Checker] onDidChange handler failed:', err.message);
    }
    return info;
  }

  /**
   * 解析远端最新版本。
   * 先查 Release，再用 tag 列表兜底——发版时如果只 `git push --tags` 而没有在
   * GitHub 上创建 Release，`/releases/latest` 会一直返回上一个版本。
   * @returns {Promise<{version:string,url:string}|null>}
   */
  async resolveLatestVersion() {
    let releaseVersion = null;
    let releaseUrl = null;
    let releaseError = null;

    try {
      const releaseData = await this.fetchJson(GITHUB_API_URL);
      if (releaseData && releaseData.tag_name && SEMVER_TAG_RE.test(releaseData.tag_name)) {
        releaseVersion = this.normalizeVersion(releaseData.tag_name);
        releaseUrl = releaseData.html_url || RELEASES_HTML_URL;
      }
    } catch (error) {
      releaseError = error;
    }

    // tag 兜底：取语义化版本里最大的那个
    let tagVersion = null;
    try {
      tagVersion = await this.fetchLatestTag();
    } catch {
      // tag 查询失败不致命，只要 Release 拿到了就继续用 Release
    }

    if (!releaseVersion && !tagVersion) {
      throw releaseError || new Error('No release or tag found');
    }

    // tag 比 Release 更新（= 只打了 tag 没建 Release）时以 tag 为准，
    // 但链接指向 releases 列表页，避免跳到一个不存在的 Release 详情页。
    if (tagVersion && (!releaseVersion || this.compareVersions(tagVersion, releaseVersion) > 0)) {
      return { version: tagVersion, url: RELEASES_HTML_URL };
    }

    return { version: releaseVersion, url: releaseUrl || RELEASES_HTML_URL };
  }

  /** 拉 tag 列表并返回最大的语义化版本号（不含 v 前缀） */
  async fetchLatestTag() {
    const tags = await this.fetchJson(GITHUB_TAGS_URL);
    if (!Array.isArray(tags)) return null;

    let best = null;
    for (const tag of tags) {
      const name = tag && tag.name;
      if (typeof name !== 'string' || !SEMVER_TAG_RE.test(name)) continue;
      const version = this.normalizeVersion(name);
      if (!best || this.compareVersions(version, best) > 0) {
        best = version;
      }
    }
    return best;
  }

  normalizeVersion(tag) {
    return String(tag).trim().replace(/^v/i, '');
  }

  /** 兼容旧调用点 */
  fetchLatestRelease() {
    return this.fetchJson(GITHUB_API_URL);
  }

  fetchJson(url, redirectsLeft = 3) {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'devin-byok-plus-vscode-extension',
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 10000
      };

      const req = https.get(url, options, (res) => {
        // GitHub API 偶尔 301/302 到规范化路径
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
          res.resume();
          this.fetchJson(res.headers.location, redirectsLeft - 1).then(resolve, reject);
          return;
        }

        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(data);
              resolve(json);
            } catch (err) {
              reject(new Error('Failed to parse release data'));
            }
          } else if (res.statusCode === 403 && res.headers['x-ratelimit-remaining'] === '0') {
            reject(new Error('GitHub API 速率限制，请稍后重试'));
          } else {
            reject(new Error(`GitHub API returned status ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(n => parseInt(n) || 0);
    const parts2 = v2.split('.').map(n => parseInt(n) || 0);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    
    return 0;
  }

  hasUpdate() {
    if (!this.latestVersion) {
      return false;
    }
    
    const dismissedVersion = this.context.globalState.get(DISMISSED_VERSION_KEY);
    if (dismissedVersion === this.latestVersion) {
      return false;
    }
    
    return this.compareVersions(this.latestVersion, this.currentVersion) > 0;
  }

  getUpdateInfo() {
    return {
      hasUpdate: this.hasUpdate(),
      currentVersion: this.currentVersion,
      latestVersion: this.latestVersion,
      releaseUrl: this.latestReleaseUrl || RELEASES_HTML_URL,
      repoUrl: REPO_HTML_URL,
      releasesUrl: RELEASES_HTML_URL,
      checking: this.checking,
      error: this.lastError,
      // 已忽略当前最新版：卡片上仍要显示"有新版本"，只是不弹顶部横幅
      dismissed:
        !!this.latestVersion &&
        this.context.globalState.get(DISMISSED_VERSION_KEY) === this.latestVersion,
      isNewer:
        !!this.latestVersion &&
        this.compareVersions(this.latestVersion, this.currentVersion) > 0
    };
  }

  async dismissUpdate() {
    if (this.latestVersion) {
      await this.context.globalState.update(DISMISSED_VERSION_KEY, this.latestVersion);
    }
  }

  async clearDismissed() {
    await this.context.globalState.update(DISMISSED_VERSION_KEY, undefined);
  }
}

exports.VersionChecker = VersionChecker;
