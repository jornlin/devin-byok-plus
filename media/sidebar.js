(() => {
  const _0x1bd95a = acquireVsCodeApi();
  let _0x52a72b = "";
  const _0x25b7f6 = new Map();
  let _0xe41ffb = _0x1bd95a.getState() || {};
  const _0xslotState = () => ({
    1: {
      options: Array.isArray(_0xe41ffb.cachedModelOptions1) ? _0xe41ffb.cachedModelOptions1 : [],
      selected: typeof _0xe41ffb.lastSelectedModel1 === "string" ? _0xe41ffb.lastSelectedModel1 : "",
      apiKey: typeof _0xe41ffb.cachedModelApiKey1 === "string" ? _0xe41ffb.cachedModelApiKey1 : ""
    },
    2: {
      options: Array.isArray(_0xe41ffb.cachedModelOptions2) ? _0xe41ffb.cachedModelOptions2 : [],
      selected: typeof _0xe41ffb.lastSelectedModel2 === "string" ? _0xe41ffb.lastSelectedModel2 : "",
      apiKey: typeof _0xe41ffb.cachedModelApiKey2 === "string" ? _0xe41ffb.cachedModelApiKey2 : ""
    }
  });
  function _0xslotId(_0x736c12) {
    return _0x736c12 === 2 ? 2 : 1;
  }
  function _0x358621(_0x736c12) {
    const _0x3f8a12 = _0xslotState();
    if (_0x736c12 === 1 || _0x736c12 === 2) {
      _0xe41ffb = {
        ..._0xe41ffb,
        ["cachedModelOptions" + _0x736c12]: _0x3f8a12[_0x736c12].options,
        ["lastSelectedModel" + _0x736c12]: _0x3f8a12[_0x736c12].selected,
        ["cachedModelApiKey" + _0x736c12]: _0x3f8a12[_0x736c12].apiKey
      };
    } else {
      _0xe41ffb = {
        ..._0xe41ffb,
        cachedModelOptions1: _0x3f8a12[1].options,
        lastSelectedModel1: _0x3f8a12[1].selected,
        cachedModelApiKey1: _0x3f8a12[1].apiKey,
        cachedModelOptions2: _0x3f8a12[2].options,
        lastSelectedModel2: _0x3f8a12[2].selected,
        cachedModelApiKey2: _0x3f8a12[2].apiKey
      };
    }
    _0x1bd95a.setState(_0xe41ffb);
  }
  function _0x1658eb(_0x372911) {
    return document.getElementById(_0x372911);
  }
  function _0x28550f(_0x190cb0, _0x484d48) {
    _0x1bd95a.postMessage(_0x484d48 ? {
      command: _0x190cb0,
      ..._0x484d48
    } : {
      command: _0x190cb0
    });
  }
  function _0x15e097(_0x5dbf0f) {
    return String(_0x5dbf0f == null ? "" : _0x5dbf0f).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function _0x2ddc49(_0x64e7b6, _0x171804, _0x40085d, _0x13d3ad) {
    const _0x4992d5 = _0x1658eb(_0x64e7b6 + "ActionState");
    const _0x4cce16 = _0x1658eb(_0x64e7b6 + "ActionText");
    if (!_0x4992d5 || !_0x4cce16) {
      return;
    }
    if (_0x25b7f6.has(_0x64e7b6)) {
      clearTimeout(_0x25b7f6.get(_0x64e7b6));
      _0x25b7f6.delete(_0x64e7b6);
    }
    _0x4992d5.classList.remove("hidden", "success", "error");
    if (!_0x171804) {
      _0x4992d5.classList.add("hidden");
      _0x4cce16.textContent = "";
      return;
    }
    if (_0x171804 === "success" || _0x171804 === "error") {
      _0x4992d5.classList.add(_0x171804);
      _0x25b7f6.set(_0x64e7b6, setTimeout(() => _0x2ddc49(_0x64e7b6, null, ""), _0x171804 === "success" ? 1600 : 3500));
    } else if (_0x171804 === "busy") {
      _0x25b7f6.set(_0x64e7b6, setTimeout(() => _0x2ddc49(_0x64e7b6, "error", "请求超时，请稍后重试或查看日志"), _0x13d3ad || 30000));
    }
    _0x4cce16.textContent = _0x40085d || "";
  }
  function _0x5b4185(_0x3ac008, _0x511065, _0x296206) {
    if (!_0x3ac008) {
      return;
    }
    _0x3ac008.classList.remove("badge-error");
    _0x3ac008.classList.toggle("badge-ok", !!_0x511065);
    _0x3ac008.classList.toggle("badge-warn", !_0x511065);
    _0x3ac008.textContent = _0x296206 || "";
  }
  function _0x1ef8c2(_0x525ea0, _0x736c12) {
    const _0x5e4f21 = _0xslotId(_0x736c12);
    const _0x3f8a12 = _0xslotState();
    _0x3f8a12[_0x5e4f21].options = [];
    _0x3f8a12[_0x5e4f21].selected = "";
    _0x3f8a12[_0x5e4f21].apiKey = "";
    _0xe41ffb["cachedModelOptions" + _0x5e4f21] = [];
    _0xe41ffb["lastSelectedModel" + _0x5e4f21] = "";
    _0xe41ffb["cachedModelApiKey" + _0x5e4f21] = "";
    const _0x5b0aa7 = _0x1658eb("cfgByok" + _0x5e4f21 + "Model");
    if (_0x5b0aa7) {
      _0x4d1c45(_0x5b0aa7, [], "");
    }
    const _0x36fd04 = _0x1658eb("modelFetchStatus" + _0x5e4f21);
    if (_0x36fd04) {
      _0x36fd04.textContent = _0x525ea0 || "";
      _0x36fd04.style.color = "#fbbf24";
    }
    _0x358621(_0x5e4f21);
    _0x3cef77();
  }
  function _0x544623(_0x736c12) {
    const _0x35711d = _0x1658eb("cfgByok" + _0xslotId(_0x736c12) + "Host");
    return _0x35711d && _0x35711d.value || "";
  }
  function _0x43beee(_0x736c12) {
    const manual = _0x1658eb("cfgByok" + _0xslotId(_0x736c12) + "Key");
    return manual && manual.value || "";
  }
  function _0x199258(_0x597695) {
    if (!_0x597695) {
      return;
    }
    const _0x81ece6 = Array.isArray(_0x597695.patches) ? _0x597695.patches : [];
    const _0x4ea5c4 = _0x81ece6.filter(_0x328edb => _0x328edb && _0x328edb.status === "applied").length;
    const _0x5dc71f = _0x81ece6.length > 0 && _0x4ea5c4 === _0x81ece6.length;
    _0x5b4185(_0x1658eb("patchBadge"), _0x5dc71f, _0x5dc71f ? "已就绪" : "需安装");
    if (_0x597695.path) {
      _0x52a72b = _0x597695.path;
    } else {
      _0x52a72b = "";
    }
    const _0x1a4edb = _0x1658eb("patchPathDisplay");
    if (_0x1a4edb) {
      _0x1a4edb.innerHTML = _0x597695.path ? "<b>补丁路径</b> " + _0x15e097(_0x597695.path) : "<b>补丁路径</b> 自动检测失败；非默认安装请点“选择路径”";
    }
  }
  function _0x1576c2(_0x1d22e5, _0x140b98) {
    const _0x1be11a = _0x1658eb(_0x1d22e5);
    if (!_0x1be11a || document.activeElement === _0x1be11a) {
      return;
    }
    if (_0x1be11a.type === "checkbox") {
      _0x1be11a.checked = _0x140b98 === true || _0x140b98 === "true";
      return;
    }
    _0x1be11a.value = _0x140b98 == null ? "" : String(_0x140b98);
  }
  function _0x5473e3(_0xa7a7ab) {
    return String(_0xa7a7ab || "").trim().toLowerCase().endsWith("-thinking");
  }
  function _0xnormalizeModel(_0xe54acd) {
    return String(_0xe54acd || "").trim().toLowerCase().replace(/-thinking$/, "");
  }
  function _0xdetectProvider(_0xe54acd) {
    const _0x13f797 = _0xnormalizeModel(_0xe54acd);
    if (!_0x13f797) {
      return null;
    }
    if (/^gemini-|^model_google_gemini|^models\/gemini-/.test(_0x13f797)) {
      return "gemini";
    }
    if (/^gpt-|^o[0-9][a-z0-9.-]*|^chatgpt-|^model_gpt/.test(_0x13f797)) {
      return "gpt";
    }
    if (/^claude-|^model_claude/.test(_0x13f797)) {
      return "claude";
    }
    return null;
  }
  const _0xproviderOptions = {
    claude: [["", "关闭 · 不启用思考"], ["low", "低 · budget 5k / adaptive"], ["medium", "中 · 推荐平衡"], ["high", "高 · 复杂分析/代码"], ["xhigh", "极高 · Opus 4.7/4.8"], ["max", "Max · Claude 最深思考"]],
    gpt: [["", "关闭 · 不启用 reasoning"], ["low", "低 · reasoning.effort=low"], ["medium", "中 · reasoning.effort=medium"], ["high", "高 · reasoning.effort=high"], ["xhigh", "极高 · reasoning.effort=xhigh"]],
    gemini: [["", "默认 · medium（API 默认，不覆盖）"], ["minimal", "Minimal · 最低思考 / 最低延迟"], ["low", "Low · 速度优先"], ["medium", "Medium · 推荐平衡"], ["high", "High · 最深推理"]]
  };
  function _0xproviderHint(_0xprovider) {
    if (_0xprovider === "gpt") {
      return "GPT · reasoning.effort";
    }
    if (_0xprovider === "gemini") {
      return "Gemini 3.5 Flash · thinking_level";
    }
    if (_0xprovider === "claude") {
      return "Claude · adaptive / budget_tokens";
    }
    return "思考强度";
  }
  function _0xsupportsThinking(_0xprovider, _0xe54acd) {
    if (!_0xprovider) {
      return false;
    }
    const _0x13f797 = _0xnormalizeModel(_0xe54acd);
    if (_0xprovider === "claude" || _0xprovider === "gpt") {
      return !!_0x13f797;
    }
    if (_0xprovider === "gemini") {
      return /gemini-/.test(_0x13f797);
    }
    return false;
  }
  function _0xsanitizeEffort(_0xprovider, _0xvalue) {
    const _0xnormalized = String(_0xvalue ?? "").trim().toLowerCase();
    if (_0xprovider === "gemini") {
      const _0xlegacy = {
        xhigh: "high",
        max: "high"
      };
      const _0xmapped = _0xlegacy[_0xnormalized] || _0xnormalized;
      const _0xchoices = _0xproviderOptions.gemini;
      return _0xchoices.some(([_0xval]) => _0xval === _0xmapped) ? _0xmapped : "";
    }
    if (_0xprovider === "gpt") {
      const _0xmapped = _0xnormalized === "max" ? "xhigh" : _0xnormalized;
      const _0xchoices = _0xproviderOptions.gpt;
      return _0xchoices.some(([_0xval]) => _0xval === _0xmapped) ? _0xmapped : "";
    }
    const _0xchoices = _0xproviderOptions[_0xprovider] || _0xproviderOptions.claude;
    return _0xchoices.some(([_0xval]) => _0xval === _0xnormalized) ? _0xnormalized : "";
  }
  function _0xrenderThinkingEffort(_0x736c12, _0xmodel, _0xpreserveValue) {
    const _0x5e4f21 = _0xslotId(_0x736c12);
    const _0xrowEl = _0x1658eb("cfgByok" + _0x5e4f21 + "ThinkingEffortRow");
    const _0xselectEl = _0x1658eb("cfgByok" + _0x5e4f21 + "ThinkingEffort");
    const _0xlabelEl = _0x1658eb("cfgByok" + _0x5e4f21 + "ThinkingLabel");
    const _0xprovider = _0xdetectProvider(_0xmodel);
    if (_0xrowEl) {
      _0xrowEl.classList.toggle("hidden", !_0xsupportsThinking(_0xprovider, _0xmodel));
    }
    if (_0xlabelEl) {
      _0xlabelEl.textContent = _0xproviderHint(_0xprovider);
    }
    if (!_0xselectEl || !_0xsupportsThinking(_0xprovider, _0xmodel)) {
      return;
    }
    const _0xcurrent = _0xsanitizeEffort(_0xprovider, _0xpreserveValue !== undefined ? _0xpreserveValue : _0xselectEl.value);
    const _0xchoices = _0xproviderOptions[_0xprovider] || _0xproviderOptions.claude;
    _0xselectEl.innerHTML = _0xchoices.map(([_0xval, _0xlabel]) => "<option value=\"" + _0xval + "\"" + (_0xcurrent === _0xval ? " selected" : "") + ">" + _0xlabel + "</option>").join("");
    _0xselectEl.value = _0xcurrent;
  }
  function _0x3cef77() {
    [1, 2].forEach(_0x736c12 => {
      const _0x5e4f21 = _0xslotId(_0x736c12);
      const _0xmodelEl = _0x1658eb("cfgByok" + _0x5e4f21 + "Model");
      const _0xmodel = _0xmodelEl && _0xmodelEl.value || "";
      _0xrenderThinkingEffort(_0x736c12, _0xmodel);
    });
  }
  function _0x3c921c(_0x113d80) {
    if (typeof _0x113d80 === "string") {
      return _0x113d80.trim();
    }
    return String(_0x113d80 && (_0x113d80.id || _0x113d80.value || _0x113d80.name) || "").trim();
  }
  function _0x405d1e(_0x12a3fa) {
    if (typeof _0x12a3fa === "string") {
      return _0x12a3fa.trim();
    }
    return String(_0x12a3fa && (_0x12a3fa.id || _0x12a3fa.name || _0x12a3fa.value) || "").trim();
  }
  function _0x1d1b2a() {
    const _0x11423b = _0x1658eb("cfgDefaultModelCustom");
    const _0x90afc7 = _0x1658eb("cfgByok1Model");
    const _0x3f8a12 = _0xslotState();
    return _0x11423b && _0x11423b.value.trim() || _0x90afc7 && _0x90afc7.value || _0x3f8a12[1].selected || "";
  }
  function _0xhydrateByokSlot(_0x1a0037, _0x736c12) {
    const _0x5e4f21 = _0xslotId(_0x736c12);
    const _0xprefix = "BYOK" + _0x5e4f21 + "_";
    const _0xhost = _0x1a0037[_0xprefix + "ANTHROPIC_API_HOST"] || (_0x5e4f21 === 1 ? _0x1a0037.ANTHROPIC_API_HOST || "" : "");
    const _0xkey = _0x1a0037[_0xprefix + "ANTHROPIC_API_KEY"] || (_0x5e4f21 === 1 ? _0x1a0037.ANTHROPIC_API_KEY || "" : "");
    const _0xmodel = _0x1a0037[_0xprefix + "MODEL"] || (_0x5e4f21 === 1 ? _0x1a0037.DEFAULT_MODEL || "" : "");
    _0x1576c2("cfgByok" + _0x5e4f21 + "Host", _0xhost);
    _0x1576c2("cfgByok" + _0x5e4f21 + "Key", _0xkey);
    _0x1576c2("cfgByok" + _0x5e4f21 + "ThinkingEffort", _0x1a0037[_0xprefix + "THINKING_EFFORT"] || (_0x5e4f21 === 1 ? _0x1a0037.OPENAI_REASONING_EFFORT || "" : ""));
    _0xrenderThinkingEffort(_0x736c12, _0xmodel, _0x1a0037[_0xprefix + "THINKING_EFFORT"] || (_0x5e4f21 === 1 ? _0x1a0037.OPENAI_REASONING_EFFORT || "" : ""));
    const _0x427647 = _0x43beee(_0x5e4f21);
    const _0x3f8a12 = _0xslotState();
    const _0x1a3538 = !!_0x3f8a12[_0x5e4f21].apiKey && !!_0x427647 && _0x3f8a12[_0x5e4f21].apiKey === _0x427647;
    if (_0x3f8a12[_0x5e4f21].options.length && !_0x1a3538) {
      _0xe41ffb["cachedModelOptions" + _0x5e4f21] = [];
      _0xe41ffb["lastSelectedModel" + _0x5e4f21] = "";
    }
    if (_0xmodel) {
      _0xe41ffb["lastSelectedModel" + _0x5e4f21] = _0xmodel;
    }
    const _0x56e2bb = _0x1658eb("cfgByok" + _0x5e4f21 + "Model");
    const _0x16cfd0 = _0xmodel || (_0x1a3538 && document.activeElement === _0x56e2bb ? _0x56e2bb.value : "");
    if (_0x56e2bb) {
      const _0xopts = _0xslotState()[_0x5e4f21].options;
      _0x4d1c45(_0x56e2bb, _0x1a3538 ? _0xopts : [], _0x16cfd0);
    }
    _0xrenderThinkingEffort(_0x736c12, _0x16cfd0 || _0xmodel, _0x1a0037[_0xprefix + "THINKING_EFFORT"] || (_0x5e4f21 === 1 ? _0x1a0037.OPENAI_REASONING_EFFORT || "" : ""));
  }
  function _0x4ae7f5(_0x1a0037, _0x1758ba) {
    if (_0x1a0037) {
      _0xhydrateByokSlot(_0x1a0037, 1);
      _0xhydrateByokSlot(_0x1a0037, 2);
      _0x1576c2("cfgAnthropicPath", _0x1a0037.BYOK1_ANTHROPIC_API_PATH || _0x1a0037.ANTHROPIC_API_PATH || "");
      _0x1576c2("cfgOpenaiPath", _0x1a0037.BYOK1_OPENAI_API_PATH || _0x1a0037.OPENAI_API_PATH || "");
      _0x1576c2("cfgMaxTokens", _0x1a0037.MAX_TOKENS || "16384");
      _0x1576c2("cfgSysPromptOverride", _0x1a0037.SYSTEM_PROMPT_OVERRIDE === "true" ? "true" : "");
      _0x1576c2("cfgSysPromptPath", _0x1a0037.SYSTEM_PROMPT_PATH || "");
      _0x358621();
    }
    if (_0x1758ba) {
      _0x1576c2("cfgHybridPort", _0x1758ba.hybridPort || "3006");
      _0x1576c2("cfgInferencePort", _0x1758ba.inferencePort || "3001");
      _0x5b4185(_0x1658eb("proxyRunBadge"), !!_0x1758ba.running, _0x1758ba.running ? "运行中" : "已停止");
    }
    _0x3cef77();
  }
  function _0x4d1c45(_0x4f1594, _0x3b51cb, _0x1de17f) {
    if (!_0x4f1594) {
      return;
    }
    const _0xe189dd = String(_0x1de17f || "").trim();
    const _0x17e360 = [];
    const _0x5d613b = new Set();
    for (const _0x4b98a0 of _0x3b51cb || []) {
      const _0x165663 = _0x3c921c(_0x4b98a0);
      if (!_0x165663 || _0x5d613b.has(_0x165663)) {
        continue;
      }
      _0x5d613b.add(_0x165663);
      _0x17e360.push(_0x4b98a0);
    }
    const _0x30d8c9 = _0xe189dd && !_0x5d613b.has(_0xe189dd) ? [{
      id: _0xe189dd,
      name: _0xe189dd
    }].concat(_0x17e360) : _0x17e360;
    const _0x398c63 = Array.from(_0x4f1594.options).map(_0x5ca13b => _0x5ca13b.value + "\0" + (_0x5ca13b.textContent || "")).join("");
    const _0x5baf13 = _0x30d8c9.length ? _0x30d8c9.map(_0x21996b => _0x3c921c(_0x21996b) + "\0" + (_0x405d1e(_0x21996b) || _0x3c921c(_0x21996b))).join("") : (_0xe189dd || "") + "\0" + (_0xe189dd ? _0xe189dd : "请先加载模型列表");
    if (_0x398c63 === _0x5baf13) {
      if (_0xe189dd && _0x4f1594.value !== _0xe189dd) {
        _0x4f1594.value = _0xe189dd;
      }
      return;
    }
    _0x4f1594.innerHTML = "";
    if (!_0x30d8c9.length) {
      const _0x3c5f59 = document.createElement("option");
      _0x3c5f59.value = _0xe189dd || "";
      _0x3c5f59.textContent = _0xe189dd ? _0xe189dd : "请先加载模型列表";
      _0x3c5f59.selected = true;
      _0x4f1594.appendChild(_0x3c5f59);
      return;
    }
    for (const _0x48a084 of _0x30d8c9) {
      const _0x331c42 = document.createElement("option");
      _0x331c42.value = _0x3c921c(_0x48a084);
      _0x331c42.textContent = _0x405d1e(_0x48a084) || _0x331c42.value;
      if (_0x331c42.value === _0xe189dd) {
        _0x331c42.selected = true;
      }
      _0x4f1594.appendChild(_0x331c42);
    }
    if (_0xe189dd) {
      _0x4f1594.value = _0xe189dd;
    }
  }
  function _0xbuildSlotConfig(_0x736c12) {
    const _0x5e4f21 = _0xslotId(_0x736c12);
    const _0x41a930 = _0x43beee(_0x5e4f21);
    const _0x2a50d9 = _0x544623(_0x5e4f21);
    const _0x2de927 = _0x1658eb("cfgByok" + _0x5e4f21 + "Model");
    const _0xmodel = (_0x2de927 || {}).value || "";
    const _0xprefix = "BYOK" + _0x5e4f21 + "_";
    return {
      [_0xprefix + "ANTHROPIC_API_HOST"]: _0x2a50d9,
      [_0xprefix + "ANTHROPIC_API_KEY"]: _0x41a930,
      [_0xprefix + "ANTHROPIC_API_PATH"]: (_0x1658eb("cfgAnthropicPath") || {}).value || "",
      [_0xprefix + "OPENAI_API_HOST"]: _0x2a50d9,
      [_0xprefix + "OPENAI_API_KEY"]: _0x41a930,
      [_0xprefix + "OPENAI_API_PATH"]: (_0x1658eb("cfgOpenaiPath") || {}).value || "",
      [_0xprefix + "MODEL"]: _0xmodel,
      [_0xprefix + "THINKING_EFFORT"]: ((_0x1658eb("cfgByok" + _0x5e4f21 + "ThinkingEffort") || {}).value || "").trim()
    };
  }
  function _0x2abde0() {
    const _0xb1 = _0xbuildSlotConfig(1);
    const _0xb2 = _0xbuildSlotConfig(2);
    return {
      ..._0xb1,
      ..._0xb2,
      ANTHROPIC_API_HOST: _0xb1.BYOK1_ANTHROPIC_API_HOST,
      ANTHROPIC_API_KEY: _0xb1.BYOK1_ANTHROPIC_API_KEY,
      ANTHROPIC_API_PATH: _0xb1.BYOK1_ANTHROPIC_API_PATH,
      OPENAI_API_HOST: _0xb1.BYOK1_OPENAI_API_HOST,
      OPENAI_API_KEY: _0xb1.BYOK1_OPENAI_API_KEY,
      OPENAI_API_PATH: _0xb1.BYOK1_OPENAI_API_PATH,
      DEFAULT_MODEL: _0xb1.BYOK1_MODEL,
      MAX_TOKENS: (_0x1658eb("cfgMaxTokens") || {}).value || "16384",
      COMPLETION_TIMEOUT_MS: (_0x1658eb("cfgCompletionTimeoutMs") || {}).value || "12000",
      HYBRID_PORT: (_0x1658eb("cfgHybridPort") || {}).value || "3006",
      INFERENCE_PORT: (_0x1658eb("cfgInferencePort") || {}).value || "3001",
      SYSTEM_PROMPT_OVERRIDE: (_0x1658eb("cfgSysPromptOverride") || {}).value || "",
      SYSTEM_PROMPT_PATH: (_0x1658eb("cfgSysPromptPath") || {}).value || "",
      OPENAI_REASONING_EFFORT: _0xb1.BYOK1_THINKING_EFFORT || "",
      OPENAI_THINKING_ENABLED: _0xb1.BYOK1_THINKING_EFFORT ? "true" : ""
    };
  }
  function _0x421e16(_0x50895e) {
    const _0x3eb186 = Math.floor((_0x50895e || 0) / 1000);
    if (_0x3eb186 < 60) {
      return _0x3eb186 + "s";
    }
    const _0x20b4b4 = Math.floor(_0x3eb186 / 60);
    if (_0x20b4b4 < 60) {
      return _0x20b4b4 + "m";
    }
    return Math.floor(_0x20b4b4 / 60) + "h" + _0x20b4b4 % 60 + "m";
  }
  function _0x15a0f2(_0x1df59f) {
    const _0x3d7558 = [];
    const _0x2b70d6 = new Set();
    for (const _0xd308cf of _0x1df59f || []) {
      const _0x5dac51 = _0x3c921c(_0xd308cf);
      if (!_0x5dac51 || _0x2b70d6.has(_0x5dac51)) {
        continue;
      }
      _0x3d7558.push(_0xd308cf);
      _0x2b70d6.add(_0x5dac51);
      const _0x28e3f7 = _0x5dac51.toLowerCase();
      const _0xc8d06a = (_0x28e3f7.startsWith("claude-") || _0x28e3f7.startsWith("gemini-")) && !_0x28e3f7.endsWith("-thinking");
      if (_0xc8d06a) {
        const _0x6e245 = _0x5dac51 + "-thinking";
        if (!_0x2b70d6.has(_0x6e245)) {
          const _0x2cc136 = {
            id: _0x6e245,
            name: _0x6e245
          };
          _0x3d7558.push(_0x2cc136);
          _0x2b70d6.add(_0x6e245);
        }
      }
    }
    return _0x3d7558;
  }
  function _0x13760f(_0x4f151c) {
    const _0xb80fdf = _0x4f151c && _0x4f151c.providers || {};
    const _0x325efb = [];
    if (_0xb80fdf.anthropic && Array.isArray(_0xb80fdf.anthropic.models)) {
      _0x325efb.push(..._0xb80fdf.anthropic.models);
    }
    if (_0xb80fdf.openai && Array.isArray(_0xb80fdf.openai.models)) {
      _0x325efb.push(..._0xb80fdf.openai.models);
    }
    if (_0x4f151c && Array.isArray(_0x4f151c.data)) {
      _0x325efb.push(..._0x4f151c.data);
    }
    if (_0x4f151c && Array.isArray(_0x4f151c.models)) {
      _0x325efb.push(..._0x4f151c.models);
    }
    return _0x15a0f2(_0x325efb);
  }
  function _0x489782(_0x736c12) {
    const _0x5e4f21 = _0xslotId(_0x736c12);
    const _0x3ee95a = _0x1658eb("cfgByok" + _0x5e4f21 + "Model");
    const _0x26fab7 = _0x1658eb("modelFetchStatus" + _0x5e4f21);
    const _0x395431 = _0x43beee(_0x5e4f21);
    const _0x3f8a12 = _0xslotState();
    const _0x1d037f = !!_0x3f8a12[_0x5e4f21].apiKey && !!_0x395431 && _0x3f8a12[_0x5e4f21].apiKey === _0x395431;
    const _0x2918e3 = _0x1d037f ? ((_0x3ee95a || {}).value || _0x3f8a12[_0x5e4f21].selected) : "";
    if (_0x2918e3) {
      _0x3f8a12[_0x5e4f21].selected = _0x2918e3;
      _0xe41ffb["lastSelectedModel" + _0x5e4f21] = _0x2918e3;
    }
    if (_0x3ee95a) {
      _0x4d1c45(_0x3ee95a, _0x1d037f ? _0x3f8a12[_0x5e4f21].options : [], _0x2918e3);
    }
    _0x358621(_0x5e4f21);
    if (_0x26fab7) {
      _0x26fab7.textContent = "正在加载模型...";
      _0x26fab7.style.color = "#34d399";
    }
    _0x3cef77();
  }
  function _0x49f726(_0x2bd049, _0x2a4962, _0x736c12) {
    const _0x5e4f21 = _0xslotId(_0x736c12);
    const _0x5b7ed0 = _0x1658eb("cfgByok" + _0x5e4f21 + "Model");
    const _0x1a8585 = _0x1658eb("modelFetchStatus" + _0x5e4f21);
    if (!_0x5b7ed0) {
      return;
    }
    const _0x234f7d = _0x43beee(_0x5e4f21);
    const _0x3f8a12 = _0xslotState();
    const _0x4fd8f1 = !!_0x3f8a12[_0x5e4f21].apiKey && !!_0x234f7d && _0x3f8a12[_0x5e4f21].apiKey === _0x234f7d;
    const _0x406ac1 = (_0x4fd8f1 ? (_0x3f8a12[_0x5e4f21].selected || (_0x5b7ed0 || {}).value) : "") || _0x2bd049 && _0x2bd049.defaultModel || "";
    if (_0x406ac1) {
      _0x3f8a12[_0x5e4f21].selected = _0x406ac1;
      _0xe41ffb["lastSelectedModel" + _0x5e4f21] = _0x406ac1;
    }
    if (_0x2a4962) {
      _0x4d1c45(_0x5b7ed0, _0x4fd8f1 ? _0x3f8a12[_0x5e4f21].options : [], _0x406ac1);
      _0x358621(_0x5e4f21);
      if (_0x1a8585) {
        _0x1a8585.textContent = "加载失败：" + _0x2a4962;
        _0x1a8585.style.color = "#f87171";
      }
      _0x2ddc49("config", "error", "BYOK #" + _0x5e4f21 + " 加载模型失败：" + _0x2a4962);
      return;
    }
    _0x3f8a12[_0x5e4f21].options = _0x13760f(_0x2bd049);
    _0x3f8a12[_0x5e4f21].apiKey = _0x234f7d;
    _0xe41ffb["cachedModelOptions" + _0x5e4f21] = _0x3f8a12[_0x5e4f21].options;
    _0xe41ffb["cachedModelApiKey" + _0x5e4f21] = _0x234f7d;
    _0x4d1c45(_0x5b7ed0, _0x3f8a12[_0x5e4f21].options, _0x406ac1);
    _0x358621(_0x5e4f21);
    const _0x4d702b = _0x3f8a12[_0x5e4f21].options.length;
    if (_0x1a8585) {
      _0x1a8585.textContent = _0x4d702b ? "已加载 " + _0x4d702b + " 个模型" : "未获取到模型列表，请检查 API Key 或网关";
      _0x1a8585.style.color = _0x4d702b ? "#34d399" : "#fbbf24";
    }
    _0x2ddc49("config", _0x4d702b ? "success" : "error", _0x4d702b ? "BYOK #" + _0x5e4f21 + " 已加载 " + _0x4d702b + " 个模型" : "BYOK #" + _0x5e4f21 + " 未获取到模型列表");
    _0x3cef77();
  }
  function _0xbccbb0(_0x15f4c5) {
    const _0xb18ee = _0x1658eb("modelProbeResult");
    if (!_0xb18ee || !_0x15f4c5) {
      return;
    }
    const _0x1c4948 = !!_0x15f4c5.ok;
    _0xb18ee.innerHTML = "<span class=\"badge " + (_0x1c4948 ? "badge-ok" : "badge-error") + "\">" + (_0x1c4948 ? "通过" : "失败") + "</span> " + _0x15e097(_0x15f4c5.model || "--") + " · " + _0x15e097(_0x15f4c5.detail || "");
    _0xb18ee.classList.remove("hidden");
  }
  function _0x15aaa6(_0x2c5bee) {
    const _0x139af0 = _0x1658eb("environmentCheckResult");
    if (!_0x139af0) {
      return;
    }
    if (!_0x2c5bee || !Array.isArray(_0x2c5bee.items)) {
      _0x139af0.classList.add("hidden");
      _0x139af0.innerHTML = "";
      return;
    }
    const _0x526a79 = _0x2c5bee.items;
    const _0x206c28 = _0x526a79.filter(_0x52b3f2 => _0x52b3f2 && _0x52b3f2.status === "error").length;
    const _0x597b03 = _0x526a79.filter(_0x3c88a5 => _0x3c88a5 && _0x3c88a5.status === "warning").length;
    const _0x2d29d3 = _0x526a79.some(_0x223de2 => _0x223de2 && _0x223de2.fixable && _0x223de2.status !== "ok");
    const _0x3f54e5 = _0x206c28 > 0 ? "badge-error" : _0x597b03 > 0 ? "badge-warn" : "badge-ok";
    const _0x1d3483 = _0x206c28 > 0 ? "错误 " + _0x206c28 : _0x597b03 > 0 ? "警告 " + _0x597b03 : "通过";
    const _0x273fac = {
      ok: "正常",
      warning: "警告",
      error: "异常"
    };
    const _0x57bc1e = {
      ok: "badge-ok",
      warning: "badge-warn",
      error: "badge-error"
    };
    const _0x19395b = _0x526a79.map(_0x59c58c => {
      const _0x550c70 = _0x59c58c && _0x59c58c.status || "warning";
      return "<div class=\"env-check-item\">\n        <div class=\"env-check-top\"><span>" + _0x15e097(_0x59c58c && _0x59c58c.name) + "</span><span class=\"badge " + (_0x57bc1e[_0x550c70] || "badge-warn") + "\">" + (_0x273fac[_0x550c70] || "未知") + "</span></div>\n        <div class=\"env-check-detail\">" + _0x15e097(_0x59c58c && _0x59c58c.detail) + "</div>\n        " + (_0x59c58c && _0x59c58c.fixable && _0x550c70 !== "ok" ? "<div class=\"env-check-fix\">可一键修复</div>" : "") + "\n      </div>";
    }).join("");
    const _0x5a65dd = _0x2d29d3 ? "<button type=\"button\" class=\"btn btn-p sm\" data-ws-action=\"repairEnvironment\">一键修复</button>" : "";
    const _0x3a51b8 = "<button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"probeModelLink\">链路探测</button>";
    _0x139af0.innerHTML = "<div class=\"env-check-head\"><span>" + _0x15e097(_0x2c5bee.checkedAt || "") + "</span><span class=\"badge " + _0x3f54e5 + "\">" + _0x1d3483 + "</span></div><div class=\"env-check-list\">" + _0x19395b + "</div><div class=\"env-check-actions\">" + _0x5a65dd + _0x3a51b8 + "</div><div id=\"modelProbeResult\" class=\"env-check-probe hidden\"></div>";
    _0x139af0.classList.remove("hidden");
  }
  function _0x2c405f(_0x1dfcc1) {
    if (!_0x1dfcc1) {
      return;
    }
    const _0x2343cc = _0x1658eb("statPort");
    const _0x5f3c7a = _0x1658eb("statUptime");
    const _0x3a7ecf = _0x1658eb("statRequests");
    const _0x1960f4 = _0x1658eb("proxyControlButtons");
    if (_0x2343cc) {
      _0x2343cc.textContent = String(_0x1dfcc1.hybridPort || "--");
    }
    if (_0x5f3c7a) {
      _0x5f3c7a.textContent = _0x1dfcc1.running ? _0x421e16(_0x1dfcc1.uptime) : "--";
    }
    if (_0x3a7ecf) {
      _0x3a7ecf.textContent = String(_0x1dfcc1.requestCount || 0);
    }
    if (_0x1960f4) {
      const _0x34b807 = (_0x1dfcc1.running ? "<button type=\"button\" class=\"btn btn-d\" data-ws-action=\"stopProxy\">停止代理</button>" : "<button type=\"button\" class=\"btn btn-p\" data-ws-action=\"startProxy\" data-ws-mode=\"both\">一键启动</button>") + "<button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"saveConfig\">仅保存配置</button><button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"maintenanceTools\">维护工具</button>";
      if (_0x1960f4.innerHTML !== _0x34b807) {
        _0x1960f4.innerHTML = _0x34b807;
      }
    }
  }
  function _0x164b82(_0xe17b13) {
    const _0x33c1b5 = _0xe17b13 && _0xe17b13.getAttribute("data-ws-toggle");
    const _0x49636f = _0x33c1b5 ? _0x1658eb(_0x33c1b5) : null;
    if (!_0x49636f) {
      return;
    }
    const _0x3aaba2 = _0x49636f.classList.toggle("hidden");
    _0xe17b13.classList.toggle("collapsed", _0x3aaba2);
  }
  function _0x5ffc0e() {}
  document.addEventListener("click", _0x2ccbf3 => {
    
    const _0xedd9d = _0x2ccbf3.target && _0x2ccbf3.target.closest ? _0x2ccbf3.target.closest("[data-ws-toggle]") : null;
    if (_0xedd9d) {
      _0x164b82(_0xedd9d);
      _0x2ccbf3.preventDefault();
      return;
    }
    const _0x5481f8 = _0x2ccbf3.target.closest("[data-ws-action]");
    if (!_0x5481f8) {
      return;
    }
    const _0x402468 = _0x5481f8.getAttribute("data-ws-action");
    if (_0x402468 === "startProxy") {
      _0x2ddc49("proxy", "busy", "正在启动代理...");
      _0x28550f("startProxy", {
        mode: _0x5481f8.getAttribute("data-ws-mode") || "both",
        config: _0x2abde0()
      });
    } else if (_0x402468 === "stopProxy") {
      _0x2ddc49("proxy", "busy", "正在停止代理...");
      _0x28550f("stopProxy");
    } else if (_0x402468 === "saveConfig") {
      _0x2ddc49("config", "busy", "正在保存配置...");
      _0x28550f("saveConfig", {
        config: _0x2abde0()
      });
    } else if (_0x402468 === "maintenanceTools") {
      _0x2ddc49("config", "busy", "请选择维护操作...");
      _0x28550f("maintenanceTools");
    } else if (_0x402468 === "clearCache") {
      _0x2ddc49("config", "busy", "准备清理缓存...");
      _0x28550f("clearCache");
    } else if (_0x402468 === "forceRestartLanguageServer") {
      _0x2ddc49("config", "busy", "正在强制重启 LS...");
      _0x28550f("forceRestartLanguageServer");
    } else if (_0x402468 === "checkEnvironment") {
      _0x2ddc49("config", "busy", "正在检测环境...");
      _0x28550f("checkEnvironment");
    } else if (_0x402468 === "exportDiagnostics") {
      _0x2ddc49("config", "busy", "正在生成诊断报告...");
      _0x28550f("exportDiagnostics");
    } else if (_0x402468 === "repairEnvironment") {
      _0x2ddc49("config", "busy", "正在修复环境...");
      _0x28550f("repairEnvironment");
    } else if (_0x402468 === "probeModelLink") {
      const _0xd2d414 = _0x1658eb("modelProbeResult");
      if (_0xd2d414) {
        _0xd2d414.textContent = "正在探测当前默认模型链路...";
        _0xd2d414.classList.remove("hidden");
      }
      _0x2ddc49("config", "busy", "正在探测模型链路...");
      _0x28550f("probeModelLink", {
        config: _0x2abde0()
      });
    } else if (_0x402468 === "fetchModels") {
      const _0x736c12 = _0xslotId(Number(_0x5481f8.getAttribute("data-ws-slot") || "1"));
      const _0x478fdb = _0x43beee(_0x736c12).trim();
      const _0x43c493 = _0x544623(_0x736c12).trim();
      if (!_0x478fdb) {
        _0x2ddc49("config", "error", "请先填写 BYOK #" + _0x736c12 + " 的 API Key");
        return;
      }
      _0x489782(_0x736c12);
      _0x2ddc49("config", "busy", "正在加载 BYOK #" + _0x736c12 + " 模型...", 45000);
      const _0xe49392 = {
        slot: _0x736c12,
        apiKey: _0x478fdb,
        baseUrl: _0x43c493
      };
      _0x28550f("fetchModels", _0xe49392);
    } else if (_0x402468 === "openPromptTemplates") {
      _0x2ddc49("config", "busy", "请选择提示词模板...");
      _0x28550f("openPromptTemplates");
    } else if (_0x402468 === "openSystemPrompt") {
      _0x2ddc49("config", "busy", "正在启用并打开自定义提示词...");
      _0x28550f("openSystemPrompt", {
        path: (_0x1658eb("cfgSysPromptPath") || {}).value || ""
      });
    } else if (_0x402468 === "applyPatch") {
      _0x2ddc49("patch", "busy", "正在应用补丁...");
      _0x28550f("applyPatch", {
        apiUrl: (_0x1658eb("patchApiUrl") || {}).value || "",
        inferenceUrl: (_0x1658eb("patchInferenceUrl") || {}).value || "",
        extJsPath: _0x52a72b || undefined
      });
    } else if (_0x402468 === "revertPatch") {
      _0x2ddc49("patch", "busy", "正在还原补丁...");
      _0x28550f("revertPatch");
    } else if (_0x402468 === "refreshPatchStatus") {
      _0x2ddc49("patch", "busy", "正在刷新补丁状态...");
      _0x28550f("refreshPatchStatus");
    } else if (_0x402468 === "locateExtJs") {
      _0x2ddc49("patch", "busy", "请选择 Windsurf 的 extension.js...");
      _0x28550f("locateExtJs");
    } else if (_0x402468 === "clearExtJsPath") {
      _0x52a72b = "";
      _0x2ddc49("patch", "busy", "正在切回自动检测...");
      _0x28550f("clearExtJsPath");
    } else if (_0x402468 === "reloadIdeWindow") {
      _0x28550f("reloadIdeWindow");
    } else if (_0x402468 === "newWindow") {
      _0x28550f("newWindow");
    } else if (_0x402468 === "copyLogs") {
      const _0x28bc95 = _0x1658eb("logBox");
      if (!_0x28bc95) {
        return;
      }
      const _0x25a465 = Array.from(_0x28bc95.querySelectorAll(".log-line")).map(_0x242c97 => _0x242c97.textContent || "").join("\n");
      navigator.clipboard.writeText(_0x25a465).then(() => {
        const _0x2bf88f = _0x1658eb("copyToast");
        if (_0x2bf88f) {
          _0x2bf88f.style.display = "block";
          setTimeout(() => {
            _0x2bf88f.style.display = "none";
          }, 2000);
        }
      });
    }
  });
  document.addEventListener("change", _0xbee4d9 => {
    const _0xf45dbb = _0xbee4d9.target;
    if (!_0xf45dbb) {
      return;
    }
    if (_0xf45dbb.id === "cfgAutoStartProxy") {
      _0x28550f("setAutoStartProxy", {
        value: _0xf45dbb.checked === true
      });
    } else if (_0xf45dbb.id === "cfgByok1Model" || _0xf45dbb.id === "cfgByok2Model" || _0xf45dbb.id === "cfgByok1ThinkingEffort" || _0xf45dbb.id === "cfgByok2ThinkingEffort") {
      const _0x736c12 = /cfgByok2/.test(_0xf45dbb.id) ? 2 : 1;
      if (_0xf45dbb.id.endsWith("Model")) {
        _0xe41ffb["lastSelectedModel" + _0x736c12] = _0xf45dbb.value || "";
        _0x358621(_0x736c12);
      }
      _0x3cef77();
    } else if (_0xf45dbb.id === "cfgByok1Host" || _0xf45dbb.id === "cfgByok2Host") {
      _0x1ef8c2("Base URL 已修改，请重新加载模型", _0xf45dbb.id === "cfgByok2Host" ? 2 : 1);
    } else if (_0xf45dbb.id === "cfgByok1Key" || _0xf45dbb.id === "cfgByok2Key") {
      _0x1ef8c2("API Key 已修改，请重新加载模型", _0xf45dbb.id === "cfgByok2Key" ? 2 : 1);
    }
  });
  document.addEventListener("input", _0x48d44c => {
    const _0x299b76 = _0x48d44c.target;
    if (_0x299b76 && (_0x299b76.id === "cfgDefaultModelCustom" || /cfgByok[12]Model/.test(_0x299b76.id))) {
      _0x3cef77();
    }
  });
  window.addEventListener("message", _0x21278f => {
    const _0x50358a = _0x21278f.data || {};
    if (_0x50358a.type === "status") {
      _0x2c405f(_0x50358a.proxy);
      _0x4ae7f5(_0x50358a.config, _0x50358a.proxy);
      _0x199258(_0x50358a.patch);
    } else if (_0x50358a.type === "actionState" && _0x50358a.section) {
      _0x2ddc49(_0x50358a.section, _0x50358a.state === "error" ? "error" : "success", _0x50358a.message || "完成");
    } else if (_0x50358a.type === "modelList") {
      const _0x736c12 = _0xslotId(_0x50358a.slot);
      if (_0x50358a.loading) {
        _0x489782(_0x736c12);
      } else {
        _0x49f726(_0x50358a.data, _0x50358a.error, _0x736c12);
      }
    } else if (_0x50358a.type === "modelProbeResult") {
      _0xbccbb0(_0x50358a.result);
    } else if (_0x50358a.type === "environmentCheck") {
      _0x15aaa6(_0x50358a.result);
    } else if (_0x50358a.type === "extJsPath" && _0x50358a.path) {
      _0x52a72b = _0x50358a.path;
      const _0x271065 = _0x1658eb("patchPathDisplay");
      if (_0x271065) {
        _0x271065.innerHTML = "<b>补丁路径</b> " + _0x15e097(_0x50358a.path);
      }
      _0x2ddc49("patch", "success", "已选择 extension.js");
      _0x28550f("refreshPatchStatus");
    } else if (_0x50358a.type === "log") {
      const _0x6c8d62 = _0x1658eb("logBox");
      if (!_0x6c8d62) {
        return;
      }
      if (_0x6c8d62.textContent && _0x6c8d62.textContent.trim() === "等待日志...") {
        _0x6c8d62.innerHTML = "";
      }
      const _0xdfa8f3 = /GetChatMessage|GetStreamingCompletions|GetEmbeddings/.test(_0x50358a.line) ? " hi" : /err|stderr/i.test(_0x50358a.line) ? " err" : "";
      _0x6c8d62.innerHTML += "<div class=\"log-line" + _0xdfa8f3 + "\">" + _0x15e097(_0x50358a.line) + "</div>";
      _0x6c8d62.scrollTop = _0x6c8d62.scrollHeight;
    }
  });
  _0x28550f("getStatus");
  
  [1, 2].forEach(_0x736c12 => {
    const _0x3f8a12 = _0xslotState();
    const _0x4761ae = _0x43beee(_0x736c12);
    const _0x427e97 = _0x1658eb("cfgByok" + _0x736c12 + "Model");
    if (_0x3f8a12[_0x736c12].options.length && _0x3f8a12[_0x736c12].apiKey && _0x3f8a12[_0x736c12].apiKey === _0x4761ae) {
      if (_0x427e97) {
        _0x4d1c45(_0x427e97, _0x3f8a12[_0x736c12].options, _0x3f8a12[_0x736c12].selected || _0x427e97.value || "");
      }
    } else if (_0x3f8a12[_0x736c12].options.length) {
      _0x1ef8c2("API Key 已变化，请重新加载模型", _0x736c12);
    }
  });
  _0x3cef77();
  
})();
