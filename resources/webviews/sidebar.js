(() => {
  const tmp0 = acquireVsCodeApi();
  let tmp1 = "";
  const tmp2 = new Map();
  let tmp3 = tmp0.getState() || {};
  const fn = () => ({
    1: {
      options: Array.isArray(tmp3.cachedModelOptions1) ? tmp3.cachedModelOptions1 : [],
      selected: typeof tmp3.lastSelectedModel1 === "string" ? tmp3.lastSelectedModel1 : "",
      apiKey: typeof tmp3.cachedModelApiKey1 === "string" ? tmp3.cachedModelApiKey1 : ""
    },
    2: {
      options: Array.isArray(tmp3.cachedModelOptions2) ? tmp3.cachedModelOptions2 : [],
      selected: typeof tmp3.lastSelectedModel2 === "string" ? tmp3.lastSelectedModel2 : "",
      apiKey: typeof tmp3.cachedModelApiKey2 === "string" ? tmp3.cachedModelApiKey2 : ""
    }
  });
  function fn2(arg0) {
    return arg0 === 2 ? 2 : 1;
  }
  function fn3(arg0) {
    const tmp12 = fn();
    if (arg0 === 1 || arg0 === 2) {
      tmp3 = {
        ...tmp3,
        ["cachedModelOptions" + arg0]: tmp12[arg0].options,
        ["lastSelectedModel" + arg0]: tmp12[arg0].selected,
        ["cachedModelApiKey" + arg0]: tmp12[arg0].apiKey
      };
    } else {
      tmp3 = {
        ...tmp3,
        cachedModelOptions1: tmp12[1].options,
        lastSelectedModel1: tmp12[1].selected,
        cachedModelApiKey1: tmp12[1].apiKey,
        cachedModelOptions2: tmp12[2].options,
        lastSelectedModel2: tmp12[2].selected,
        cachedModelApiKey2: tmp12[2].apiKey
      };
    }
    tmp0.setState(tmp3);
  }
  function fn4(arg0) {
    return document.getElementById(arg0);
  }
  function fn5(arg0, arg1) {
    tmp0.postMessage(arg1 ? {
      command: arg0,
      ...arg1
    } : {
      command: arg0
    });
  }
  function fn6(arg0) {
    return String(arg0 == null ? "" : arg0).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function fn7(arg0, arg1, arg2, arg3) {
    const tmp4 = fn4(arg0 + "ActionState");
    const tmp5 = fn4(arg0 + "ActionText");
    if (!tmp4 || !tmp5) {
      return;
    }
    if (tmp2.has(arg0)) {
      clearTimeout(tmp2.get(arg0));
      tmp2.delete(arg0);
    }
    tmp4.classList.remove("hidden", "success", "error");
    if (!arg1) {
      tmp4.classList.add("hidden");
      tmp5.textContent = "";
      return;
    }
    if (arg1 === "success" || arg1 === "error") {
      tmp4.classList.add(arg1);
      tmp2.set(arg0, setTimeout(() => fn7(arg0, null, ""), arg1 === "success" ? 1600 : 3500));
    } else if (arg1 === "busy") {
      tmp2.set(arg0, setTimeout(() => fn7(arg0, "error", "请求超时，请稍后重试或查看日志"), arg3 || 30000));
    }
    tmp5.textContent = arg2 || "";
  }
  function fn8(arg0, arg1, arg2) {
    if (!arg0) {
      return;
    }
    arg0.classList.remove("badge-error");
    arg0.classList.toggle("badge-ok", !!arg1);
    arg0.classList.toggle("badge-warn", !arg1);
    arg0.textContent = arg2 || "";
  }
  function fn9(arg0, arg1) {
    const tmp22 = fn2(arg1);
    const tmp32 = fn();
    tmp32[tmp22].options = [];
    tmp32[tmp22].selected = "";
    tmp32[tmp22].apiKey = "";
    tmp3["cachedModelOptions" + tmp22] = [];
    tmp3["lastSelectedModel" + tmp22] = "";
    tmp3["cachedModelApiKey" + tmp22] = "";
    const tmp4 = fn4("cfgByok" + tmp22 + "Model");
    if (tmp4) {
      fn25(tmp4, [], "");
    }
    const tmp5 = fn4("modelFetchStatus" + tmp22);
    if (tmp5) {
      tmp5.textContent = arg0 || "";
      tmp5.style.color = "#fbbf24";
    }
    fn3(tmp22);
    fn20();
  }
  function fn10(arg0) {
    const tmp12 = fn4("cfgByok" + fn2(arg0) + "Host");
    return tmp12 && tmp12.value || "";
  }
  function fn11(arg0) {
    const manual = fn4("cfgByok" + fn2(arg0) + "Key");
    return manual && manual.value || "";
  }
  function fn12(arg0) {
    if (!arg0) {
      return;
    }
    const tmp12 = Array.isArray(arg0.patches) ? arg0.patches : [];
    const tmp22 = tmp12.filter(arg02 => arg02 && arg02.status === "applied").length;
    const tmp32 = tmp12.length > 0 && tmp22 === tmp12.length;
    fn8(fn4("patchBadge"), tmp32, tmp32 ? "已就绪" : "需安装");
    if (arg0.path) {
      tmp1 = arg0.path;
    } else {
      tmp1 = "";
    }
    const tmp4 = fn4("patchPathDisplay");
    if (tmp4) {
      tmp4.innerHTML = arg0.path ? "<b>补丁路径</b> " + fn6(arg0.path) : "<b>补丁路径</b> 自动检测失败；非默认安装请点“选择路径”";
    }
  }
  function fn13(arg0, arg1) {
    const tmp22 = fn4(arg0);
    if (!tmp22 || document.activeElement === tmp22) {
      return;
    }
    if (tmp22.type === "checkbox") {
      tmp22.checked = arg1 === true || arg1 === "true";
      return;
    }
    tmp22.value = arg1 == null ? "" : String(arg1);
  }
  function tmp17(arg0) {
    return String(arg0 || "").trim().toLowerCase().endsWith("-thinking");
  }
  function fn14(arg0) {
    return String(arg0 || "").trim().toLowerCase().replace(/-thinking$/, "");
  }
  function fn15(arg0) {
    const tmp12 = fn14(arg0);
    if (!tmp12) {
      return null;
    }
    if (/^gemini-|^model_google_gemini|^models\/gemini-/.test(tmp12)) {
      return "gemini";
    }
    if (/^gpt-|^o[0-9][a-z0-9.-]*|^chatgpt-|^model_gpt/.test(tmp12)) {
      return "gpt";
    }
    if (/^claude-|^model_claude/.test(tmp12)) {
      return "claude";
    }
    return null;
  }
  const tmp20 = {
    claude: [["", "关闭 · 不启用思考"], ["low", "低 · budget 5k / adaptive"], ["medium", "中 · 推荐平衡"], ["high", "高 · 复杂分析/代码"], ["xhigh", "极高 · Opus 4.7/4.8"], ["max", "Max · Claude 最深思考"]],
    gpt: [["", "关闭 · 不启用 reasoning"], ["low", "低 · reasoning.effort=low"], ["medium", "中 · reasoning.effort=medium"], ["high", "高 · reasoning.effort=high"], ["xhigh", "极高 · reasoning.effort=xhigh"]],
    gemini: [["", "默认 · medium（API 默认，不覆盖）"], ["minimal", "Minimal · 最低思考 / 最低延迟"], ["low", "Low · 速度优先"], ["medium", "Medium · 推荐平衡"], ["high", "High · 最深推理"]]
  };
  function fn16(arg0) {
    if (arg0 === "gpt") {
      return "GPT · reasoning.effort";
    }
    if (arg0 === "gemini") {
      return "Gemini 3.5 Flash · thinking_level";
    }
    if (arg0 === "claude") {
      return "Claude · adaptive / budget_tokens";
    }
    return "思考强度";
  }
  function fn17(arg0, arg1) {
    if (!arg0) {
      return false;
    }
    const tmp22 = fn14(arg1);
    if (arg0 === "claude" || arg0 === "gpt") {
      return !!tmp22;
    }
    if (arg0 === "gemini") {
      return /gemini-/.test(tmp22);
    }
    return false;
  }
  function fn18(arg0, arg1) {
    const tmp22 = String(arg1 ?? "").trim().toLowerCase();
    if (arg0 === "gemini") {
      const tmp02 = {
        xhigh: "high",
        max: "high"
      };
      const tmp12 = tmp02[tmp22] || tmp22;
      const tmp23 = tmp20.gemini;
      return tmp23.some(([tmp03]) => tmp03 === tmp12) ? tmp12 : "";
    }
    if (arg0 === "gpt") {
      const tmp02 = tmp22 === "max" ? "xhigh" : tmp22;
      const tmp12 = tmp20.gpt;
      return tmp12.some(([tmp03]) => tmp03 === tmp02) ? tmp02 : "";
    }
    const tmp32 = tmp20[arg0] || tmp20.claude;
    return tmp32.some(([tmp02]) => tmp02 === tmp22) ? tmp22 : "";
  }
  function fn19(arg0, arg1, arg2) {
    const tmp32 = fn2(arg0);
    const tmp4 = fn4("cfgByok" + tmp32 + "ThinkingEffortRow");
    const tmp5 = fn4("cfgByok" + tmp32 + "ThinkingEffort");
    const tmp6 = fn4("cfgByok" + tmp32 + "ThinkingLabel");
    const tmp7 = fn15(arg1);
    if (tmp4) {
      tmp4.classList.toggle("hidden", !fn17(tmp7, arg1));
    }
    if (tmp6) {
      tmp6.textContent = fn16(tmp7);
    }
    if (!tmp5 || !fn17(tmp7, arg1)) {
      return;
    }
    const tmp8 = fn18(tmp7, arg2 !== undefined ? arg2 : tmp5.value);
    const tmp9 = tmp20[tmp7] || tmp20.claude;
    tmp5.innerHTML = tmp9.map(([tmp02, tmp12]) => "<option value=\"" + tmp02 + "\"" + (tmp8 === tmp02 ? " selected" : "") + ">" + tmp12 + "</option>").join("");
    tmp5.value = tmp8;
  }
  function fn20() {
    [1, 2].forEach(arg0 => {
      const tmp12 = fn2(arg0);
      const tmp22 = fn4("cfgByok" + tmp12 + "Model");
      const tmp32 = tmp22 && tmp22.value || "";
      fn19(arg0, tmp32);
    });
  }
  function fn21(arg0) {
    if (typeof arg0 === "string") {
      return arg0.trim();
    }
    return String(arg0 && (arg0.id || arg0.value || arg0.name) || "").trim();
  }
  function fn22(arg0) {
    if (typeof arg0 === "string") {
      return arg0.trim();
    }
    return String(arg0 && (arg0.id || arg0.name || arg0.value) || "").trim();
  }
  function tmp28() {
    const tmp02 = fn4("cfgDefaultModelCustom");
    const tmp12 = fn4("cfgByok1Model");
    const tmp22 = fn();
    return tmp02 && tmp02.value.trim() || tmp12 && tmp12.value || tmp22[1].selected || "";
  }
  function fn23(arg0, arg1) {
    const tmp22 = fn2(arg1);
    const tmp32 = "BYOK" + tmp22 + "_";
    const tmp4 = arg0[tmp32 + "ANTHROPIC_API_HOST"] || (tmp22 === 1 ? arg0.ANTHROPIC_API_HOST || "" : "");
    const tmp5 = arg0[tmp32 + "ANTHROPIC_API_KEY"] || (tmp22 === 1 ? arg0.ANTHROPIC_API_KEY || "" : "");
    const tmp6 = arg0[tmp32 + "MODEL"] || (tmp22 === 1 ? arg0.DEFAULT_MODEL || "" : "");
    fn13("cfgByok" + tmp22 + "Host", tmp4);
    fn13("cfgByok" + tmp22 + "Key", tmp5);
    fn13("cfgByok" + tmp22 + "ThinkingEffort", arg0[tmp32 + "THINKING_EFFORT"] || (tmp22 === 1 ? arg0.OPENAI_REASONING_EFFORT || "" : ""));
    fn19(arg1, tmp6, arg0[tmp32 + "THINKING_EFFORT"] || (tmp22 === 1 ? arg0.OPENAI_REASONING_EFFORT || "" : ""));
    const tmp7 = fn11(tmp22);
    const tmp8 = fn();
    const tmp9 = !!tmp8[tmp22].apiKey && !!tmp7 && tmp8[tmp22].apiKey === tmp7;
    if (tmp8[tmp22].options.length && !tmp9) {
      tmp3["cachedModelOptions" + tmp22] = [];
      tmp3["lastSelectedModel" + tmp22] = "";
    }
    if (tmp6) {
      tmp3["lastSelectedModel" + tmp22] = tmp6;
    }
    const tmp10 = fn4("cfgByok" + tmp22 + "Model");
    const tmp11 = tmp6 || (tmp9 && document.activeElement === tmp10 ? tmp10.value : "");
    if (tmp10) {
      const tmp02 = fn()[tmp22].options;
      fn25(tmp10, tmp9 ? tmp02 : [], tmp11);
    }
    fn19(arg1, tmp11 || tmp6, arg0[tmp32 + "THINKING_EFFORT"] || (tmp22 === 1 ? arg0.OPENAI_REASONING_EFFORT || "" : ""));
  }
  function fn24(arg0, arg1) {
    if (arg0) {
      fn23(arg0, 1);
      fn23(arg0, 2);
      fn13("cfgAnthropicPath", arg0.BYOK1_ANTHROPIC_API_PATH || arg0.ANTHROPIC_API_PATH || "");
      fn13("cfgOpenaiPath", arg0.BYOK1_OPENAI_API_PATH || arg0.OPENAI_API_PATH || "");
      fn13("cfgMaxTokens", arg0.MAX_TOKENS || "16384");
      fn13("cfgSysPromptOverride", arg0.SYSTEM_PROMPT_OVERRIDE === "true" ? "true" : "");
      fn13("cfgSysPromptPath", arg0.SYSTEM_PROMPT_PATH || "");
      fn3();
    }
    if (arg1) {
      fn13("cfgHybridPort", arg1.hybridPort || "3006");
      fn13("cfgInferencePort", arg1.inferencePort || "3001");
      fn8(fn4("proxyRunBadge"), !!arg1.running, arg1.running ? "运行中" : "已停止");
    }
    fn20();
  }
  function fn24a() {
    const tmp12 = fn4("cfgAnthropicPath");
    const tmp22 = fn4("cfgOpenaiPath");
    if (!tmp12 || !tmp22 || fn4("advancedRouteBody")) {
      return;
    }
    const tmp32 = document.createElement("div");
    tmp32.className = "guide-block";
    tmp32.style.marginBottom = "10px";
    tmp32.innerHTML = "<div class=\"card-head between\" style=\"margin-bottom:6px;padding:0\"><span class=\"toggle-section collapsed\" data-ws-toggle=\"advancedRouteBody\">高级路由</span><span class=\"badge badge-warn\">可选</span></div><div id=\"advancedRouteBody\" class=\"hidden\"><div class=\"fg\"><label>Anthropic API Path</label></div><div class=\"fg\"><label>OpenAI API Path</label></div><div class=\"guide-note\">GPT 默认先走 <code>/v1/responses</code>；网关不支持时会回退 <code>/v1/chat/completions</code>。如网关明确只支持旧接口，可在这里直接填写。</div></div>";
    const tmp4 = fn4("cfgMaxTokens");
    const tmp5 = tmp4 && tmp4.parentElement && tmp4.parentElement.parentElement;
    const tmp6 = tmp5 && tmp5.parentElement || tmp22.parentElement;
    if (tmp6 && tmp5) {
      tmp6.insertBefore(tmp32, tmp5);
    } else {
      tmp22.insertAdjacentElement("afterend", tmp32);
    }
    const tmp7 = fn4("advancedRouteBody");
    const tmp8 = tmp7 && tmp7.querySelectorAll(".fg");
    tmp12.type = "text";
    tmp12.placeholder = "/v1/messages";
    tmp22.type = "text";
    tmp22.placeholder = "/v1/responses 或 /v1/chat/completions";
    if (tmp8 && tmp8[0]) {
      tmp8[0].appendChild(tmp12);
    }
    if (tmp8 && tmp8[1]) {
      tmp8[1].appendChild(tmp22);
    }
  }
  function fn25(arg0, arg1, arg2) {
    if (!arg0) {
      return;
    }
    const tmp32 = String(arg2 || "").trim();
    const tmp4 = [];
    const tmp5 = new Set();
    for (const tmp02 of arg1 || []) {
      const tmp03 = fn21(tmp02);
      if (!tmp03 || tmp5.has(tmp03)) {
        continue;
      }
      tmp5.add(tmp03);
      tmp4.push(tmp02);
    }
    const tmp6 = tmp32 && !tmp5.has(tmp32) ? [{
      id: tmp32,
      name: tmp32
    }].concat(tmp4) : tmp4;
    const tmp7 = Array.from(arg0.options).map(arg02 => arg02.value + "\0" + (arg02.textContent || "")).join("");
    const tmp8 = tmp6.length ? tmp6.map(arg02 => fn21(arg02) + "\0" + (fn22(arg02) || fn21(arg02))).join("") : (tmp32 || "") + "\0" + (tmp32 ? tmp32 : "请先加载模型列表");
    if (tmp7 === tmp8) {
      if (tmp32 && arg0.value !== tmp32) {
        arg0.value = tmp32;
      }
      return;
    }
    arg0.innerHTML = "";
    if (!tmp6.length) {
      const tmp02 = document.createElement("option");
      tmp02.value = tmp32 || "";
      tmp02.textContent = tmp32 ? tmp32 : "请先加载模型列表";
      tmp02.selected = true;
      arg0.appendChild(tmp02);
      return;
    }
    for (const tmp02 of tmp6) {
      const tmp03 = document.createElement("option");
      tmp03.value = fn21(tmp02);
      tmp03.textContent = fn22(tmp02) || tmp03.value;
      if (tmp03.value === tmp32) {
        tmp03.selected = true;
      }
      arg0.appendChild(tmp03);
    }
    if (tmp32) {
      arg0.value = tmp32;
    }
  }
  function fn26(arg0) {
    const tmp12 = fn2(arg0);
    const tmp22 = fn11(tmp12);
    const tmp32 = fn10(tmp12);
    const tmp4 = fn4("cfgByok" + tmp12 + "Model");
    const tmp5 = (tmp4 || {}).value || "";
    const tmp6 = "BYOK" + tmp12 + "_";
    return {
      [tmp6 + "ANTHROPIC_API_HOST"]: tmp32,
      [tmp6 + "ANTHROPIC_API_KEY"]: tmp22,
      [tmp6 + "ANTHROPIC_API_PATH"]: (fn4("cfgAnthropicPath") || {}).value || "",
      [tmp6 + "OPENAI_API_HOST"]: tmp32,
      [tmp6 + "OPENAI_API_KEY"]: tmp22,
      [tmp6 + "OPENAI_API_PATH"]: (fn4("cfgOpenaiPath") || {}).value || "",
      [tmp6 + "MODEL"]: tmp5,
      [tmp6 + "THINKING_EFFORT"]: ((fn4("cfgByok" + tmp12 + "ThinkingEffort") || {}).value || "").trim()
    };
  }
  function fn27() {
    const tmp02 = fn26(1);
    const tmp12 = fn26(2);
    return {
      ...tmp02,
      ...tmp12,
      ANTHROPIC_API_HOST: tmp02.BYOK1_ANTHROPIC_API_HOST,
      ANTHROPIC_API_KEY: tmp02.BYOK1_ANTHROPIC_API_KEY,
      ANTHROPIC_API_PATH: tmp02.BYOK1_ANTHROPIC_API_PATH,
      OPENAI_API_HOST: tmp02.BYOK1_OPENAI_API_HOST,
      OPENAI_API_KEY: tmp02.BYOK1_OPENAI_API_KEY,
      OPENAI_API_PATH: tmp02.BYOK1_OPENAI_API_PATH,
      DEFAULT_MODEL: tmp02.BYOK1_MODEL,
      MAX_TOKENS: (fn4("cfgMaxTokens") || {}).value || "16384",
      COMPLETION_TIMEOUT_MS: (fn4("cfgCompletionTimeoutMs") || {}).value || "12000",
      HYBRID_PORT: (fn4("cfgHybridPort") || {}).value || "3006",
      INFERENCE_PORT: (fn4("cfgInferencePort") || {}).value || "3001",
      SYSTEM_PROMPT_OVERRIDE: (fn4("cfgSysPromptOverride") || {}).value || "",
      SYSTEM_PROMPT_PATH: (fn4("cfgSysPromptPath") || {}).value || "",
      OPENAI_REASONING_EFFORT: tmp02.BYOK1_THINKING_EFFORT || "",
      OPENAI_THINKING_ENABLED: tmp02.BYOK1_THINKING_EFFORT ? "true" : ""
    };
  }
  function fn28(arg0) {
    const tmp12 = Math.floor((arg0 || 0) / 1000);
    if (tmp12 < 60) {
      return tmp12 + "s";
    }
    const tmp22 = Math.floor(tmp12 / 60);
    if (tmp22 < 60) {
      return tmp22 + "m";
    }
    return Math.floor(tmp22 / 60) + "h" + tmp22 % 60 + "m";
  }
  function fn29(arg0) {
    const tmp12 = [];
    const tmp22 = new Set();
    for (const tmp02 of arg0 || []) {
      const tmp03 = fn21(tmp02);
      if (!tmp03 || tmp22.has(tmp03)) {
        continue;
      }
      tmp12.push(tmp02);
      tmp22.add(tmp03);
      const tmp13 = tmp03.toLowerCase();
      const tmp23 = (tmp13.startsWith("claude-") || tmp13.startsWith("gemini-")) && !tmp13.endsWith("-thinking");
      if (tmp23) {
        const tmp04 = tmp03 + "-thinking";
        if (!tmp22.has(tmp04)) {
          const tmp05 = {
            id: tmp04,
            name: tmp04
          };
          tmp12.push(tmp05);
          tmp22.add(tmp04);
        }
      }
    }
    return tmp12;
  }
  function fn30(arg0) {
    const tmp12 = arg0 && arg0.providers || {};
    const tmp22 = [];
    if (tmp12.anthropic && Array.isArray(tmp12.anthropic.models)) {
      tmp22.push(...tmp12.anthropic.models);
    }
    if (tmp12.openai && Array.isArray(tmp12.openai.models)) {
      tmp22.push(...tmp12.openai.models);
    }
    if (arg0 && Array.isArray(arg0.data)) {
      tmp22.push(...arg0.data);
    }
    if (arg0 && Array.isArray(arg0.models)) {
      tmp22.push(...arg0.models);
    }
    return fn29(tmp22);
  }
  function fn31(arg0) {
    const tmp12 = fn2(arg0);
    const tmp22 = fn4("cfgByok" + tmp12 + "Model");
    const tmp32 = fn4("modelFetchStatus" + tmp12);
    const tmp4 = fn11(tmp12);
    const tmp5 = fn();
    const tmp6 = !!tmp5[tmp12].apiKey && !!tmp4 && tmp5[tmp12].apiKey === tmp4;
    const tmp7 = tmp6 ? (tmp22 || {}).value || tmp5[tmp12].selected : "";
    if (tmp7) {
      tmp5[tmp12].selected = tmp7;
      tmp3["lastSelectedModel" + tmp12] = tmp7;
    }
    if (tmp22) {
      fn25(tmp22, tmp6 ? tmp5[tmp12].options : [], tmp7);
    }
    fn3(tmp12);
    if (tmp32) {
      tmp32.textContent = "正在加载模型...";
      tmp32.style.color = "#34d399";
    }
    fn20();
  }
  function fn32(arg0, arg1, arg2) {
    const tmp32 = fn2(arg2);
    const tmp4 = fn4("cfgByok" + tmp32 + "Model");
    const tmp5 = fn4("modelFetchStatus" + tmp32);
    if (!tmp4) {
      return;
    }
    const tmp6 = fn11(tmp32);
    const tmp7 = fn();
    const tmp8 = !!tmp7[tmp32].apiKey && !!tmp6 && tmp7[tmp32].apiKey === tmp6;
    const tmp9 = (tmp8 ? tmp7[tmp32].selected || (tmp4 || {}).value : "") || arg0 && arg0.defaultModel || "";
    if (tmp9) {
      tmp7[tmp32].selected = tmp9;
      tmp3["lastSelectedModel" + tmp32] = tmp9;
    }
    if (arg1) {
      fn25(tmp4, tmp8 ? tmp7[tmp32].options : [], tmp9);
      fn3(tmp32);
      if (tmp5) {
        tmp5.textContent = "加载失败：" + arg1;
        tmp5.style.color = "#f87171";
      }
      fn7("config", "error", "BYOK #" + tmp32 + " 加载模型失败：" + arg1);
      return;
    }
    tmp7[tmp32].options = fn30(arg0);
    tmp7[tmp32].apiKey = tmp6;
    tmp3["cachedModelOptions" + tmp32] = tmp7[tmp32].options;
    tmp3["cachedModelApiKey" + tmp32] = tmp6;
    fn25(tmp4, tmp7[tmp32].options, tmp9);
    fn3(tmp32);
    const tmp10 = tmp7[tmp32].options.length;
    if (tmp5) {
      tmp5.textContent = tmp10 ? "已加载 " + tmp10 + " 个模型" : "未获取到模型列表，请检查 API Key 或网关";
      tmp5.style.color = tmp10 ? "#34d399" : "#fbbf24";
    }
    fn7("config", tmp10 ? "success" : "error", tmp10 ? "BYOK #" + tmp32 + " 已加载 " + tmp10 + " 个模型" : "BYOK #" + tmp32 + " 未获取到模型列表");
    fn20();
  }
  function fn33(arg0) {
    const tmp12 = fn4("modelProbeResult");
    if (!tmp12 || !arg0) {
      return;
    }
    const tmp22 = !!arg0.ok;
    tmp12.innerHTML = "<span class=\"badge " + (tmp22 ? "badge-ok" : "badge-error") + "\">" + (tmp22 ? "通过" : "失败") + "</span> " + fn6(arg0.model || "--") + " · " + fn6(arg0.detail || "");
    tmp12.classList.remove("hidden");
  }
  function fn34(arg0) {
    const tmp12 = fn4("environmentCheckResult");
    if (!tmp12) {
      return;
    }
    if (!arg0 || !Array.isArray(arg0.items)) {
      tmp12.classList.add("hidden");
      tmp12.innerHTML = "";
      return;
    }
    const tmp22 = arg0.items;
    const tmp32 = tmp22.filter(arg02 => arg02 && arg02.status === "error").length;
    const tmp4 = tmp22.filter(arg02 => arg02 && arg02.status === "warning").length;
    const tmp5 = tmp22.some(arg02 => arg02 && arg02.fixable && arg02.status !== "ok");
    const tmp6 = tmp32 > 0 ? "badge-error" : tmp4 > 0 ? "badge-warn" : "badge-ok";
    const tmp7 = tmp32 > 0 ? "错误 " + tmp32 : tmp4 > 0 ? "警告 " + tmp4 : "通过";
    const tmp8 = {
      ok: "正常",
      warning: "警告",
      error: "异常"
    };
    const tmp9 = {
      ok: "badge-ok",
      warning: "badge-warn",
      error: "badge-error"
    };
    const tmp10 = tmp22.map(arg02 => {
      const tmp13 = arg02 && arg02.status || "warning";
      return "<div class=\"env-check-item\">\n        <div class=\"env-check-top\"><span>" + fn6(arg02 && arg02.name) + "</span><span class=\"badge " + (tmp9[tmp13] || "badge-warn") + "\">" + (tmp8[tmp13] || "未知") + "</span></div>\n        <div class=\"env-check-detail\">" + fn6(arg02 && arg02.detail) + "</div>\n        " + (arg02 && arg02.fixable && tmp13 !== "ok" ? "<div class=\"env-check-fix\">可一键修复</div>" : "") + "\n      </div>";
    }).join("");
    const tmp11 = tmp5 ? "<button type=\"button\" class=\"btn btn-p sm\" data-ws-action=\"repairEnvironment\">一键修复</button>" : "";
    const tmp122 = "<button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"probeModelLink\">链路探测</button>";
    tmp12.innerHTML = "<div class=\"env-check-head\"><span>" + fn6(arg0.checkedAt || "") + "</span><span class=\"badge " + tmp6 + "\">" + tmp7 + "</span></div><div class=\"env-check-list\">" + tmp10 + "</div><div class=\"env-check-actions\">" + tmp11 + tmp122 + "</div><div id=\"modelProbeResult\" class=\"env-check-probe hidden\"></div>";
    tmp12.classList.remove("hidden");
  }
  function fn35(arg0) {
    if (!arg0) {
      return;
    }
    const tmp12 = fn4("statPort");
    const tmp22 = fn4("statUptime");
    const tmp32 = fn4("statRequests");
    const tmp4 = fn4("proxyControlButtons");
    if (tmp12) {
      tmp12.textContent = String(arg0.hybridPort || "--");
    }
    if (tmp22) {
      tmp22.textContent = arg0.running ? fn28(arg0.uptime) : "--";
    }
    if (tmp32) {
      tmp32.textContent = String(arg0.requestCount || 0);
    }
    if (tmp4) {
      const tmp02 = (arg0.running ? "<button type=\"button\" class=\"btn btn-d\" data-ws-action=\"stopProxy\">停止代理</button>" : "<button type=\"button\" class=\"btn btn-p\" data-ws-action=\"startProxy\" data-ws-mode=\"both\">一键启动</button>") + "<button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"saveConfig\">仅保存配置</button><button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"maintenanceTools\">维护工具</button>";
      if (tmp4.innerHTML !== tmp02) {
        tmp4.innerHTML = tmp02;
      }
    }
  }
  function fn36(arg0) {
    const tmp12 = arg0 && arg0.getAttribute("data-ws-toggle");
    const tmp22 = tmp12 ? fn4(tmp12) : null;
    if (!tmp22) {
      return;
    }
    const tmp32 = tmp22.classList.toggle("hidden");
    arg0.classList.toggle("collapsed", tmp32);
  }
  function tmp43() {}
  document.addEventListener("click", arg0 => {
    const tmp12 = arg0.target && arg0.target.closest ? arg0.target.closest("[data-ws-toggle]") : null;
    if (tmp12) {
      fn36(tmp12);
      arg0.preventDefault();
      return;
    }
    const tmp22 = arg0.target.closest("[data-ws-action]");
    if (!tmp22) {
      return;
    }
    const tmp32 = tmp22.getAttribute("data-ws-action");
    if (tmp32 === "startProxy") {
      fn7("proxy", "busy", "正在启动代理...");
      fn5("startProxy", {
        mode: tmp22.getAttribute("data-ws-mode") || "both",
        config: fn27()
      });
    } else if (tmp32 === "stopProxy") {
      fn7("proxy", "busy", "正在停止代理...");
      fn5("stopProxy");
    } else if (tmp32 === "saveConfig") {
      fn7("config", "busy", "正在保存配置...");
      fn5("saveConfig", {
        config: fn27()
      });
    } else if (tmp32 === "maintenanceTools") {
      fn7("config", "busy", "请选择维护操作...");
      fn5("maintenanceTools");
    } else if (tmp32 === "clearCache") {
      fn7("config", "busy", "准备清理缓存...");
      fn5("clearCache");
    } else if (tmp32 === "forceRestartLanguageServer") {
      fn7("config", "busy", "正在强制重启 LS...");
      fn5("forceRestartLanguageServer");
    } else if (tmp32 === "checkEnvironment") {
      fn7("config", "busy", "正在检测环境...");
      fn5("checkEnvironment");
    } else if (tmp32 === "exportDiagnostics") {
      fn7("config", "busy", "正在生成诊断报告...");
      fn5("exportDiagnostics");
    } else if (tmp32 === "repairEnvironment") {
      fn7("config", "busy", "正在修复环境...");
      fn5("repairEnvironment");
    } else if (tmp32 === "probeModelLink") {
      const tmp02 = fn4("modelProbeResult");
      if (tmp02) {
        tmp02.textContent = "正在探测当前默认模型链路...";
        tmp02.classList.remove("hidden");
      }
      fn7("config", "busy", "正在探测模型链路...");
      fn5("probeModelLink", {
        config: fn27()
      });
    } else if (tmp32 === "importExternalConfig") {
      const tmp02 = fn2(Number(tmp22.getAttribute("data-ws-slot") || "1"));
      const tmp13 = (tmp22.getAttribute("data-ws-source") || "claude").toLowerCase();
      const tmp14 = tmp13 === "codex" ? "GPT/Codex" : "Claude";
      fn7("config", "busy", "正在读取 " + tmp14 + " 用户配置...");
      fn5("importExternalConfig", {
        slot: tmp02,
        source: tmp13
      });
    } else if (tmp32 === "fetchModels") {
      const tmp02 = fn2(Number(tmp22.getAttribute("data-ws-slot") || "1"));
      const tmp13 = fn11(tmp02).trim();
      const tmp23 = fn10(tmp02).trim();
      if (!tmp13) {
        fn7("config", "error", "请先填写 BYOK #" + tmp02 + " 的 API Key");
        return;
      }
      fn31(tmp02);
      fn7("config", "busy", "正在加载 BYOK #" + tmp02 + " 模型...", 45000);
      const tmp33 = {
        slot: tmp02,
        apiKey: tmp13,
        baseUrl: tmp23
      };
      fn5("fetchModels", tmp33);
    } else if (tmp32 === "openPromptTemplates") {
      fn7("config", "busy", "请选择提示词模板...");
      fn5("openPromptTemplates");
    } else if (tmp32 === "openSystemPrompt") {
      fn7("config", "busy", "正在启用并打开自定义提示词...");
      fn5("openSystemPrompt", {
        path: (fn4("cfgSysPromptPath") || {}).value || ""
      });
    } else if (tmp32 === "applyPatch") {
      fn7("patch", "busy", "正在应用补丁...");
      fn5("applyPatch", {
        apiUrl: (fn4("patchApiUrl") || {}).value || "",
        inferenceUrl: (fn4("patchInferenceUrl") || {}).value || "",
        extJsPath: tmp1 || undefined
      });
    } else if (tmp32 === "revertPatch") {
      fn7("patch", "busy", "正在还原补丁...");
      fn5("revertPatch");
    } else if (tmp32 === "refreshPatchStatus") {
      fn7("patch", "busy", "正在刷新补丁状态...");
      fn5("refreshPatchStatus");
    } else if (tmp32 === "locateExtJs") {
      fn7("patch", "busy", "请选择 Devin Desktop 的 extension.js...");
      fn5("locateExtJs");
    } else if (tmp32 === "clearExtJsPath") {
      tmp1 = "";
      fn7("patch", "busy", "正在切回自动检测...");
      fn5("clearExtJsPath");
    } else if (tmp32 === "reloadIdeWindow") {
      fn5("reloadIdeWindow");
    } else if (tmp32 === "newWindow") {
      fn5("newWindow");
    } else if (tmp32 === "copyLogs") {
      const tmp02 = fn4("logBox");
      if (!tmp02) {
        return;
      }
      const tmp13 = Array.from(tmp02.querySelectorAll(".log-line")).map(arg02 => arg02.textContent || "").join("\n");
      navigator.clipboard.writeText(tmp13).then(() => {
        const tmp03 = fn4("copyToast");
        if (tmp03) {
          tmp03.style.display = "block";
          setTimeout(() => {
            tmp03.style.display = "none";
          }, 2000);
        }
      });
    }
  });
  document.addEventListener("change", arg0 => {
    const tmp12 = arg0.target;
    if (!tmp12) {
      return;
    }
    if (tmp12.id === "cfgAutoStartProxy") {
      fn5("setAutoStartProxy", {
        value: tmp12.checked === true
      });
    } else if (tmp12.id === "cfgByok1Model" || tmp12.id === "cfgByok2Model" || tmp12.id === "cfgByok1ThinkingEffort" || tmp12.id === "cfgByok2ThinkingEffort") {
      const tmp02 = /cfgByok2/.test(tmp12.id) ? 2 : 1;
      if (tmp12.id.endsWith("Model")) {
        tmp3["lastSelectedModel" + tmp02] = tmp12.value || "";
        fn3(tmp02);
      }
      fn20();
    } else if (tmp12.id === "cfgByok1Host" || tmp12.id === "cfgByok2Host") {
      fn9("Base URL 已修改，请重新加载模型", tmp12.id === "cfgByok2Host" ? 2 : 1);
    } else if (tmp12.id === "cfgByok1Key" || tmp12.id === "cfgByok2Key") {
      fn9("API Key 已修改，请重新加载模型", tmp12.id === "cfgByok2Key" ? 2 : 1);
    }
  });
  document.addEventListener("input", arg0 => {
    const tmp12 = arg0.target;
    if (tmp12 && (tmp12.id === "cfgDefaultModelCustom" || /cfgByok[12]Model/.test(tmp12.id))) {
      fn20();
    }
  });
  window.addEventListener("message", arg0 => {
    const tmp12 = arg0.data || {};
    if (tmp12.type === "status") {
      fn35(tmp12.proxy);
      fn24(tmp12.config, tmp12.proxy);
      fn12(tmp12.patch);
    } else if (tmp12.type === "actionState" && tmp12.section) {
      fn7(tmp12.section, tmp12.state === "error" ? "error" : "success", tmp12.message || "完成");
    } else if (tmp12.type === "modelList") {
      const tmp02 = fn2(tmp12.slot);
      if (tmp12.loading) {
        fn31(tmp02);
      } else {
        fn32(tmp12.data, tmp12.error, tmp02);
      }
    } else if (tmp12.type === "externalConfigImported") {
      const tmp02 = fn2(tmp12.slot);
      if (tmp12.host) {
        fn13("cfgByok" + tmp02 + "Host", tmp12.host);
      }
      if (tmp12.apiKey) {
        fn13("cfgByok" + tmp02 + "Key", tmp12.apiKey);
      }
      if (tmp12.thinkingEffort) {
        fn13("cfgByok" + tmp02 + "ThinkingEffort", tmp12.thinkingEffort);
      }
      const tmp13 = fn4("cfgByok" + tmp02 + "Model");
      if (tmp12.model && tmp13) {
        fn25(tmp13, [{
          id: tmp12.model,
          name: tmp12.model
        }], tmp12.model);
        tmp3["lastSelectedModel" + tmp02] = tmp12.model;
      }
      fn9("已导入并保存外部配置，正在同步模型列表", tmp02);
      fn20();
      if (tmp12.message) {
        fn7("config", "success", tmp12.message);
      }
    } else if (tmp12.type === "modelProbeResult") {
      fn33(tmp12.result);
    } else if (tmp12.type === "environmentCheck") {
      fn34(tmp12.result);
    } else if (tmp12.type === "extJsPath" && tmp12.path) {
      tmp1 = tmp12.path;
      const tmp02 = fn4("patchPathDisplay");
      if (tmp02) {
        tmp02.innerHTML = "<b>补丁路径</b> " + fn6(tmp12.path);
      }
      fn7("patch", "success", "已选择 extension.js");
      fn5("refreshPatchStatus");
    } else if (tmp12.type === "log") {
      const tmp02 = fn4("logBox");
      if (!tmp02) {
        return;
      }
      if (tmp02.textContent && tmp02.textContent.trim() === "等待日志...") {
        tmp02.innerHTML = "";
      }
      const tmp13 = /GetChatMessage|GetStreamingCompletions|GetEmbeddings/.test(tmp12.line) ? " hi" : /err|stderr/i.test(tmp12.line) ? " err" : "";
      tmp02.innerHTML += "<div class=\"log-line" + tmp13 + "\">" + fn6(tmp12.line) + "</div>";
      tmp02.scrollTop = tmp02.scrollHeight;
    }
  });
  fn24a();
  fn5("getStatus");
  [1, 2].forEach(arg0 => {
    const tmp12 = fn();
    const tmp22 = fn11(arg0);
    const tmp32 = fn4("cfgByok" + arg0 + "Model");
    if (tmp12[arg0].options.length && tmp12[arg0].apiKey && tmp12[arg0].apiKey === tmp22) {
      if (tmp32) {
        fn25(tmp32, tmp12[arg0].options, tmp12[arg0].selected || tmp32.value || "");
      }
    } else if (tmp12[arg0].options.length) {
      fn9("API Key 已变化，请重新加载模型", arg0);
    }
  });
  fn20();
})();
