import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseFields,
  getField,
  getAllFields,
  writeStringField,
  writeVarintField,
  writeMessageField,
  writeFixed32Field,
  reserializeField,
  replaceFields
} from "../../src/proxy/proto.js";
import { setRuntimeConfig } from "../../src/proxy/handlers/models.js";
import {
  buildClientModelConfig,
  buildSlotLabel,
  collectConfiguredSlots,
  modifyCascadeModelConfigData,
  modifyGetUserStatusResponse,
  modifyGetCascadeModelConfigsResponse,
  prettifyModelName,
  detectModelProviderEnum,
  BYOK_SLOT_ENTRIES
} from "../../src/proxy/handlers/model-configs.js";

/** 只配置指定槽位的模型，其余清空 */
function configureSlots(models) {
  setRuntimeConfig({
    maxTokens: 32768,
    CONTEXT_WINDOW: 200000,
    MODEL_LIST_MODE: "inject",
    BYOK1_MODEL: models[1] || "",
    BYOK2_MODEL: models[2] || "",
    BYOK3_MODEL: models[3] || "",
    BYOK4_MODEL: models[4] || "",
    BYOK1_THINKING_EFFORT: "",
    BYOK2_THINKING_EFFORT: "",
    BYOK3_THINKING_EFFORT: "",
    BYOK4_THINKING_EFFORT: ""
  });
}

/** 构造一条官方风格的 ClientModelConfig（新式：只有 label + model_uid） */
function officialConfig(label, uid) {
  return Buffer.concat([writeStringField(1, label), writeStringField(22, uid)]);
}

/** 构造一个官方风格的 ClientModelSort */
function officialSort(name, groupName, labels) {
  const group = Buffer.concat([
    writeStringField(1, groupName),
    ...labels.map((l) => writeStringField(2, l))
  ]);
  return Buffer.concat([writeStringField(1, name), writeMessageField(2, group)]);
}

/** 从 CascadeModelConfigData 字节里取出所有条目的 label */
function configLabels(bytes) {
  return getAllFields(parseFields(bytes), 1).map(
    (f) => getField(parseFields(f.value), 1, 2).value.toString("utf8")
  );
}

/** 从 CascadeModelConfigData 字节里取出所有 sort 的 (name, 各分组 label) */
function sortSummary(bytes) {
  return getAllFields(parseFields(bytes), 2).map((f) => {
    const sf = parseFields(f.value);
    return {
      name: getField(sf, 1, 2).value.toString("utf8"),
      groups: getAllFields(sf, 2).map((g) => {
        const gf = parseFields(g.value);
        return {
          name: getField(gf, 1, 2).value.toString("utf8"),
          labels: getAllFields(gf, 2).map((l) => l.value.toString("utf8"))
        };
      })
    };
  });
}

test("reserializeField 对四种 wire type 往返保真", () => {
  const original = Buffer.concat([
    writeVarintField(3, 42),
    writeStringField(7, "hello"),
    writeFixed32Field(9, Buffer.from([1, 2, 3, 4]))
  ]);
  const roundTripped = Buffer.concat(parseFields(original).map(reserializeField));
  assert.deepEqual(roundTripped, original, "重新序列化应与原字节完全一致");
});

test("replaceFields 保留未识别字段，只替换目标字段", () => {
  // field 5 是「上游未来新增的未知字段」，改写后必须还在
  const original = Buffer.concat([
    writeStringField(1, "old-a"),
    writeStringField(1, "old-b"),
    writeVarintField(5, 999),
    writeStringField(2, "sort")
  ]);
  const out = replaceFields(parseFields(original), { 1: [Buffer.from("new")] });
  const fields = parseFields(out);

  assert.equal(getAllFields(fields, 1).length, 1, "field 1 应被替换为单条");
  assert.equal(getField(fields, 1, 2).value.toString(), "new");
  assert.equal(getField(fields, 5, 0).value, 999, "未识别的 field 5 必须保留");
  assert.equal(getField(fields, 2, 2).value.toString(), "sort", "未涉及的 field 2 必须保留");
});

test("f18 必须写上下文窗口而非输出上限（语义回归保护）", () => {
  // field 18 名为 max_tokens，但 Devin 的语义是**上下文窗口**：
  //   模型卡片渲染 `${format(maxTokens)} context`
  //   对话框上下文进度条把它当 contextLimit（用量百分比的分母）
  // 真正的输出上限在 ModelInfo.max_output_tokens(f13)。
  // 曾误把 MAX_TOKENS（输出上限）写进 f18，导致填 800000 后界面显示 800k 上下文。
  setRuntimeConfig({
    maxTokens: 32768,        // 输出上限：不应出现在 f18
    CONTEXT_WINDOW: 200000,  // 上下文窗口：应出现在 f18
    MODEL_LIST_MODE: "replace",
    BYOK1_MODEL: "claude-opus-4-8",
    BYOK2_MODEL: "",
    BYOK3_MODEL: "",
    BYOK4_MODEL: ""
  });

  const { bytes } = modifyCascadeModelConfigData(Buffer.alloc(0), "replace");
  const entry = getAllFields(parseFields(bytes), 1)[0].value;
  const f18 = getField(parseFields(entry), 18, 0).value;

  assert.equal(f18, 200000, "f18 应为上下文窗口 CONTEXT_WINDOW");
  assert.notEqual(f18, 32768, "f18 不能是 MAX_TOKENS —— 那会让界面显示错误的上下文额度");
});

test("上下文窗口改动后 f18 随之变化（不受 maxTokens 影响）", () => {
  const read = () => {
    const { bytes } = modifyCascadeModelConfigData(Buffer.alloc(0), "replace");
    const entry = getAllFields(parseFields(bytes), 1)[0].value;
    return getField(parseFields(entry), 18, 0).value;
  };

  setRuntimeConfig({
    maxTokens: 32768,
    CONTEXT_WINDOW: 1000000,
    BYOK1_MODEL: "claude-opus-4-8",
    BYOK2_MODEL: "",
    BYOK3_MODEL: "",
    BYOK4_MODEL: ""
  });
  assert.equal(read(), 1000000, "改上下文窗口应生效");

  // 只改输出上限，f18 不应变化
  setRuntimeConfig({ maxTokens: 65536 });
  assert.equal(read(), 1000000, "改 maxTokens 不应影响 f18");

  // 非法上下文窗口回落默认值
  setRuntimeConfig({ CONTEXT_WINDOW: "abc" });
  assert.equal(read(), 200000, "非法值应回落 200000");
});

test("buildClientModelConfig 不写 disabled 与 disabled_reason", () => {
  const bytes = buildClientModelConfig({
    enumNo: 277,
    uid: "MODEL_CLAUDE_4_OPUS_BYOK",
    label: "claude-opus-4-8 (BYOK1)",
    contextWindow: 200000
  });
  const fields = parseFields(bytes);

  assert.equal(getField(fields, 4), undefined, "disabled(f4) 必须省略，否则可能触发严格校验");
  assert.equal(getField(fields, 33), undefined, "disabled_reason(f33) 必须省略，否则条目会被灰掉");
  assert.equal(getField(fields, 13, 0).value, 3, "pricing_type 应为 BYOK(3)");
  assert.equal(
    getField(fields, 22, 2).value.toString("utf8"),
    "MODEL_CLAUDE_4_OPUS_BYOK",
    "model_uid 应沿用原 BYOK 枚举名"
  );
  // model_or_alias(f2) 内层 field 1 = 枚举号
  assert.equal(getField(parseFields(getField(fields, 2, 2).value), 1, 0).value, 277);
});

test("MODEL_LIST_MODE 能穿过 profileStore 往返（方案切换不丢设置）", async () => {
  // 保存路径是 webview → envConfigToProfileFields → profileStore → projectToEnvConfig → .env
  // profileStore 是封闭白名单，漏加字段会导致切换方案时静默丢失该设置
  const ps = await import("../../src/services/profileStore.js");
  const store = ps.default || ps;

  for (const mode of ["inject", "replace", "off"]) {
    const profile = store.createDefaultProfile({ MODEL_LIST_MODE: mode, BYOK1_MODEL: "m" });
    assert.equal(profile.advanced.modelListMode, mode, `profile 应捕获 ${mode}`);
    assert.equal(
      store.projectToEnvConfig(profile).MODEL_LIST_MODE,
      mode,
      `projectToEnvConfig 应还原 ${mode}`
    );
  }

  // 缺省 / 非法值回落 replace（默认只显示 BYOK 槽位）
  assert.equal(
    store.projectToEnvConfig(store.createDefaultProfile({})).MODEL_LIST_MODE,
    "replace"
  );
  assert.equal(
    store.createDefaultProfile({ MODEL_LIST_MODE: "bogus" }).advanced.modelListMode,
    "replace"
  );
  assert.equal(
    store.createDefaultProfile({ MODEL_LIST_MODE: "INJECT" }).advanced.modelListMode,
    "inject",
    "应大小写归一"
  );

  // 老方案（advanced 无此字段）不应崩
  const legacy = store.createDefaultProfile({ MODEL_LIST_MODE: "replace" });
  delete legacy.advanced.modelListMode;
  assert.equal(
    store.projectToEnvConfig(legacy).MODEL_LIST_MODE,
    "replace",
    "老方案（advanced 无该字段）应回落到默认的 replace"
  );

  // 不同方案互不污染
  const pA = store.createDefaultProfile({ MODEL_LIST_MODE: "replace", BYOK1_MODEL: "a" });
  const pB = store.createDefaultProfile({ MODEL_LIST_MODE: "off", BYOK1_MODEL: "b" });
  assert.equal(store.projectToEnvConfig(pA).MODEL_LIST_MODE, "replace");
  assert.equal(store.projectToEnvConfig(pB).MODEL_LIST_MODE, "off");
});

test("model_uid 与 byok-slots 的槽位映射键保持一致", async () => {
  const { BYOK_SLOT_BY_REQUEST } = await import("../../src/proxy/handlers/byok-slots.js");
  for (const entry of BYOK_SLOT_ENTRIES) {
    assert.equal(
      BYOK_SLOT_BY_REQUEST[entry.uid],
      entry.slot,
      `${entry.uid} 必须映射到槽位 ${entry.slot}，否则选中后路由拿不到槽位`
    );
  }
});

test("未配置模型的槽位不进入下拉框", () => {
  configureSlots({ 1: "claude-opus-4-8", 3: "gpt-5.4" });
  const slots = collectConfiguredSlots();
  assert.deepEqual(
    slots.map((s) => s.slot),
    [1, 3],
    "只有配了 BYOKn_MODEL 的槽位才应出现"
  );
});

test("prettifyModelName 把 slug 转成官方风格的显示名", () => {
  const cases = [
    ["claude-opus-4-8", "Claude Opus 4.8"],
    ["claude-opus-4-6-thinking", "Claude Opus 4.6 Thinking"],
    ["claude-3-5-haiku-20241022", "Claude 3.5 Haiku"],
    ["claude-sonnet-4-20250514", "Claude Sonnet 4"],
    ["gpt-5-4-low", "GPT-5.4 Low"],
    ["gpt-5-4-xhigh-priority", "GPT-5.4 XHigh Fast"],
    ["gpt-4o", "GPT-4o"],
    ["gpt-4o-mini", "GPT-4o Mini"],
    ["o3-high", "o3 High"],
    ["gemini-3-5-flash-minimal", "Gemini 3.5 Flash Minimal"],
    ["models/gemini-2-5-pro", "Gemini 2.5 Pro"],
    ["anthropic/claude-opus-4-8", "Claude Opus 4.8"],
    ["glm-5-2-max-1m", "GLM-5.2 Max 1M"],
    ["swe-1-7-lightning", "SWE-1.7 Lightning"]
  ];
  for (const [input, expected] of cases) {
    assert.equal(prettifyModelName(input), expected, `${input} 应显示为 ${expected}`);
  }
});

test("prettifyModelName 对空值与无法识别的名字不丢信息", () => {
  assert.equal(prettifyModelName(""), "");
  assert.equal(prettifyModelName("   "), "");
  assert.equal(prettifyModelName(null), "");
  // 未知厂商：首字母大写但不丢词
  assert.equal(prettifyModelName("some-unknown-model-v2"), "Some Unknown Model V2");
});

test("prettifyModelName 保留 -thinking 以区分模型变体", () => {
  assert.notEqual(
    prettifyModelName("claude-opus-4-6"),
    prettifyModelName("claude-opus-4-6-thinking"),
    "thinking 变体与非 thinking 变体必须显示成不同名字"
  );
});

test("detectModelProviderEnum 按模型名给出厂商图标", () => {
  const cases = [
    ["claude-opus-4-8", 3],
    ["gpt-5.4", 2],
    ["o3-high", 2],
    ["gemini-3-pro", 4],
    ["grok-4-5-high", 5],
    ["deepseek-v4", 6],
    ["kimi-k3-high", 7],
    ["glm-5-2-max", 9],
    ["anthropic/claude-opus-4-8", 3],
    ["totally-unknown", 0]
  ];
  for (const [input, expected] of cases) {
    assert.equal(detectModelProviderEnum(input), expected, `${input} 的 provider 应为 ${expected}`);
  }
});

test("inject 模式 label 带 BYOK 后缀以避免与官方条目撞名", () => {
  configureSlots({ 1: "claude-opus-4-8" });
  const label = buildSlotLabel(1, "claude-opus-4-8", "inject");
  assert.equal(label, "Claude Opus 4.8 (BYOK1)");
});

test("replace 模式 label 显示干净模型名，不带 BYOK 后缀", () => {
  configureSlots({ 1: "claude-opus-4-8" });
  const label = buildSlotLabel(1, "claude-opus-4-8", "replace");
  assert.equal(label, "Claude Opus 4.8");
  assert.ok(!label.includes("BYOK"), "replace 模式不应暴露 BYOK 字样");
});

test("思考强度作为后缀拼进 label", () => {
  setRuntimeConfig({
    BYOK1_MODEL: "claude-opus-4-8",
    BYOK1_THINKING_EFFORT: "xhigh"
  });
  assert.equal(buildSlotLabel(1, "claude-opus-4-8", "replace"), "Claude Opus 4.8 XHigh");
});

test("replace 模式下两槽同模型同强度时自动去重", () => {
  // 两个槽位配成完全一样 —— 不去重会因 label 撞名导致其中一条永远选不到
  configureSlots({ 1: "claude-opus-4-8", 2: "claude-opus-4-8" });
  const slots = collectConfiguredSlots("replace");
  const labels = slots.map((s) => s.label);
  assert.equal(new Set(labels).size, labels.length, `label 必须唯一，实际: ${JSON.stringify(labels)}`);
});

test("BYOK 条目带 provider 字段以显示厂商图标", () => {
  configureSlots({ 1: "claude-opus-4-8", 2: "gpt-5.4", 3: "gemini-3-pro" });
  const slots = collectConfiguredSlots("replace");
  assert.equal(slots.find((s) => s.slot === 1).provider, 3, "Anthropic");
  assert.equal(slots.find((s) => s.slot === 2).provider, 2, "OpenAI");
  assert.equal(slots.find((s) => s.slot === 3).provider, 4, "Google");

  const bytes = buildClientModelConfig({
    enumNo: 277,
    uid: "MODEL_CLAUDE_4_OPUS_BYOK",
    label: "Claude Opus 4.8",
    provider: 3,
    contextWindow: 200000
  });
  assert.equal(getField(parseFields(bytes), 10, 0).value, 3, "provider(f10) 应写入");
});

test("provider 为 UNSPECIFIED 时省略该字段（proto3 缺省）", () => {
  const bytes = buildClientModelConfig({
    enumNo: 277,
    uid: "MODEL_CLAUDE_4_OPUS_BYOK",
    label: "Unknown Model",
    provider: 0,
    contextWindow: 200000
  });
  assert.equal(getField(parseFields(bytes), 10), undefined, "UNSPECIFIED 应省略");
});

test("inject 模式保留官方条目并追加 BYOK 条目", () => {
  configureSlots({ 1: "claude-opus-4-8", 2: "gpt-5.4" });
  const original = Buffer.concat([
    writeMessageField(1, officialConfig("Claude Opus 5 Medium", "claude-opus-5-medium")),
    writeMessageField(1, officialConfig("GPT-5.6 Sol Medium", "gpt-5-6-sol-medium")),
    writeMessageField(2, officialSort("Provider", "Anthropic", ["Claude Opus 5 Medium"]))
  ]);

  const { bytes, injected, changed } = modifyCascadeModelConfigData(original, "inject");
  assert.equal(injected, 2);
  assert.ok(changed !== false);

  const labels = configLabels(bytes);
  assert.equal(labels.length, 4, "2 条官方 + 2 条 BYOK");
  assert.ok(labels.includes("Claude Opus 5 Medium"), "官方条目必须保留");
  assert.ok(labels.includes("GPT-5.6 Sol Medium"), "官方条目必须保留");
  assert.ok(
    labels.some((l) => l.includes("(BYOK1)")),
    "BYOK1 条目应被追加"
  );
});

test("inject 模式往官方每个排序视图都追加 BYOK 分组", () => {
  configureSlots({ 1: "claude-opus-4-8" });
  const original = Buffer.concat([
    writeMessageField(1, officialConfig("Claude Opus 5 Medium", "claude-opus-5-medium")),
    writeMessageField(2, officialSort("Recommended", "", ["Claude Opus 5 Medium"])),
    writeMessageField(2, officialSort("Provider", "Anthropic", ["Claude Opus 5 Medium"]))
  ]);

  const { bytes } = modifyCascadeModelConfigData(original, "inject");
  const sorts = sortSummary(bytes);

  assert.equal(sorts.length, 2, "官方的两个排序视图都应保留");
  for (const sort of sorts) {
    // 原分组保留
    assert.ok(
      sort.groups.some((g) => g.labels.includes("Claude Opus 5 Medium")),
      `${sort.name} 的原分组必须保留`
    );
    // BYOK 分组已追加 —— 否则切到该视图就看不到 BYOK 条目
    assert.ok(
      sort.groups.some((g) => g.labels.some((l) => l.includes("(BYOK1)"))),
      `${sort.name} 必须追加 BYOK 分组，否则该视图下选不到`
    );
  }
});

test("replace 模式只保留 BYOK 条目与单一 BYOK 分组", () => {
  configureSlots({ 1: "claude-opus-4-8", 4: "gemini-3-pro" });
  const original = Buffer.concat([
    writeMessageField(1, officialConfig("Claude Opus 5 Medium", "claude-opus-5-medium")),
    writeMessageField(1, officialConfig("GPT-5.6 Sol Medium", "gpt-5-6-sol-medium")),
    writeMessageField(2, officialSort("Provider", "Anthropic", ["Claude Opus 5 Medium"]))
  ]);

  const { bytes, injected } = modifyCascadeModelConfigData(original, "replace");
  assert.equal(injected, 2);

  const labels = configLabels(bytes);
  assert.equal(labels.length, 2, "官方条目应被全部丢弃");
  assert.deepEqual(
    labels.sort(),
    ["Claude Opus 4.8", "Gemini 3 Pro"],
    "replace 模式应显示干净的模型名"
  );

  const sorts = sortSummary(bytes);
  assert.equal(sorts.length, 1, "只应剩一个 BYOK 排序视图");
  assert.equal(sorts[0].name, "BYOK");
  assert.equal(sorts[0].groups[0].labels.length, 2);
});

test("所有注入条目的 label 都被 sorts 引用（否则 UI 不渲染）", () => {
  configureSlots({ 1: "a-model", 2: "b-model", 3: "c-model", 4: "d-model" });
  for (const mode of ["inject", "replace"]) {
    const original = Buffer.concat([
      writeMessageField(1, officialConfig("Official", "official-uid")),
      writeMessageField(2, officialSort("Provider", "X", ["Official"]))
    ]);
    const { bytes } = modifyCascadeModelConfigData(original, mode);

    const referenced = new Set(
      sortSummary(bytes).flatMap((s) => s.groups.flatMap((g) => g.labels))
    );
    for (const label of configLabels(bytes)) {
      assert.ok(
        referenced.has(label),
        `[${mode}] label "${label}" 未被任何 sort 引用，UI 上将不可见`
      );
    }
  }
});

test("无任何已配置槽位时不改动响应", () => {
  configureSlots({});
  const original = Buffer.concat([
    writeMessageField(1, officialConfig("Claude Opus 5 Medium", "claude-opus-5-medium"))
  ]);
  const { bytes, injected } = modifyCascadeModelConfigData(original, "inject");
  assert.equal(injected, 0);
  assert.deepEqual(bytes, original, "没有槽位可注入时应原样返回，避免造出空列表");
});

test("off 模式完全不接管", () => {
  configureSlots({ 1: "claude-opus-4-8" });
  const original = Buffer.concat([
    writeMessageField(1, officialConfig("Claude Opus 5 Medium", "claude-opus-5-medium"))
  ]);
  const result = modifyGetCascadeModelConfigsResponse(original, "off");
  assert.equal(result.changed, false);
  assert.deepEqual(result.bytes, original);
});

test("GetUserStatus 下钻改写并保留登录态其余字段", () => {
  configureSlots({ 1: "claude-opus-4-8" });

  const cascadeData = Buffer.concat([
    writeMessageField(1, officialConfig("Claude Opus 5 Medium", "claude-opus-5-medium")),
    writeMessageField(2, officialSort("Provider", "Anthropic", ["Claude Opus 5 Medium"]))
  ]);
  // UserStatus：email(f7) / teams_tier(f10) / cascade_model_config_data(f33)
  const userStatus = Buffer.concat([
    writeVarintField(1, 1),
    writeStringField(7, "user@example.com"),
    writeVarintField(10, 4),
    writeMessageField(33, cascadeData)
  ]);
  // GetUserStatusResponse：user_status(f1) + plan_info(f2)
  const response = Buffer.concat([
    writeMessageField(1, userStatus),
    writeMessageField(2, writeStringField(1, "pro-plan"))
  ]);

  const { bytes, injected, changed } = modifyGetUserStatusResponse(response, "inject");
  assert.equal(changed, true);
  assert.equal(injected, 1);

  const top = parseFields(bytes);
  assert.equal(
    getField(parseFields(getField(top, 2, 2).value), 1, 2).value.toString("utf8"),
    "pro-plan",
    "plan_info 必须保留"
  );

  const us = parseFields(getField(top, 1, 2).value);
  assert.equal(getField(us, 1, 0).value, 1, "pro 标志必须保留");
  assert.equal(
    getField(us, 7, 2).value.toString("utf8"),
    "user@example.com",
    "email 必须保留 —— 自造整个 UserStatus 会破坏登录态"
  );
  assert.equal(getField(us, 10, 0).value, 4, "teams_tier 必须保留");

  const labels = configLabels(getField(us, 33, 2).value);
  assert.ok(labels.includes("Claude Opus 5 Medium"));
  assert.ok(labels.some((l) => l.includes("(BYOK1)")));
});

test("GetUserStatus 缺少 user_status 时原样放行", () => {
  configureSlots({ 1: "claude-opus-4-8" });
  // 错误响应形状：没有 field 1
  const response = writeStringField(9, "some error");
  const result = modifyGetUserStatusResponse(response, "inject");
  assert.equal(result.changed, false);
  assert.deepEqual(result.bytes, response);
});

test("GetUserStatus 无 cascade_model_config_data 时也能注入", () => {
  configureSlots({ 1: "claude-opus-4-8" });
  // 上游没给 f33（例如清单为空），仍应把 BYOK 条目建出来
  const userStatus = Buffer.concat([writeStringField(7, "user@example.com")]);
  const response = writeMessageField(1, userStatus);

  const { bytes, changed, injected } = modifyGetUserStatusResponse(response, "inject");
  assert.equal(changed, true);
  assert.equal(injected, 1);

  const us = parseFields(getField(parseFields(bytes), 1, 2).value);
  assert.equal(getField(us, 7, 2).value.toString("utf8"), "user@example.com");
  const labels = configLabels(getField(us, 33, 2).value);
  assert.equal(labels.length, 1);
  assert.ok(labels[0].includes("(BYOK1)"));
});

test("六种响应封装组合都能解开→改写→还原", async () => {
  const zlib = await import("node:zlib");
  const tryGunzip = (b) => {
    try {
      return zlib.gunzipSync(b);
    } catch {
      return null;
    }
  };
  configureSlots({ 1: "claude-opus-4-8" });

  const cascade = Buffer.concat([
    writeMessageField(1, officialConfig("Official", "official-uid")),
    writeMessageField(2, officialSort("Provider", "X", ["Official"]))
  ]);
  const userStatus = Buffer.concat([
    writeStringField(7, "user@example.com"),
    writeMessageField(33, cascade)
  ]);
  const plain = writeMessageField(1, userStatus);

  const wrapEnv = (payload, compress) => {
    const inner = compress ? zlib.gzipSync(payload) : payload;
    const out = Buffer.alloc(5 + inner.length);
    out[0] = compress ? 1 : 0;
    out.writeUInt32BE(inner.length, 1);
    inner.copy(out, 5);
    return out;
  };

  // 复刻 hybrid-server.handleModelListIntercept 的解封装 → 改写 → 重封装流程
  const roundTrip = (body) => {
    const outerGz = tryGunzip(body);
    const afterOuter = outerGz || body;
    let payload = afterOuter;
    let hadEnv = false;
    if (afterOuter.length > 5) {
      const flag = afterOuter[0];
      const len = afterOuter.readUInt32BE(1);
      if (len === afterOuter.length - 5 && flag <= 1) {
        hadEnv = true;
        payload = afterOuter.subarray(5);
        if (flag === 1) {
          payload = tryGunzip(payload) || payload;
        }
      }
    }
    const res = modifyGetUserStatusResponse(payload, "inject");
    if (!res.changed) return null;
    let out = res.bytes;
    if (hadEnv) {
      const e = Buffer.alloc(5 + out.length);
      e[0] = 0;
      e.writeUInt32BE(out.length, 1);
      out.copy(e, 5);
      out = e;
    }
    return outerGz ? zlib.gzipSync(out) : out;
  };

  // 模拟 Devin 客户端读取
  const clientRead = (body) => {
    let p = tryGunzip(body) || body;
    if (p.length > 5) {
      const flag = p[0];
      const len = p.readUInt32BE(1);
      if (len === p.length - 5 && flag <= 1) {
        p = p.subarray(5);
        if (flag === 1) p = tryGunzip(p) || p;
      }
    }
    const us = getField(parseFields(p), 1, 2);
    const usf = parseFields(us.value);
    const cd = getField(usf, 33, 2);
    return {
      email: getField(usf, 7, 2).value.toString("utf8"),
      labels: configLabels(cd.value)
    };
  };

  const scenarios = [
    ["裸 protobuf", plain],
    ["外层 gzip", zlib.gzipSync(plain)],
    ["envelope 未压缩", wrapEnv(plain, false)],
    ["envelope 内层 gzip", wrapEnv(plain, true)],
    ["外层 gzip + envelope", zlib.gzipSync(wrapEnv(plain, false))],
    ["外层 gzip + envelope 内层 gzip", zlib.gzipSync(wrapEnv(plain, true))]
  ];

  for (const [name, body] of scenarios) {
    const out = roundTrip(body);
    assert.ok(out, `[${name}] 应完成改写（未改写说明封装未被识别，注入静默失效）`);
    const back = clientRead(out);
    assert.equal(back.email, "user@example.com", `[${name}] 登录态字段必须保留`);
    assert.ok(back.labels.includes("Official"), `[${name}] 官方条目必须保留`);
    assert.ok(
      back.labels.some((l) => l.includes("(BYOK1)")),
      `[${name}] BYOK 条目必须存在`
    );
  }
});

test("空字节输入不抛异常", () => {
  configureSlots({ 1: "claude-opus-4-8" });
  const { bytes, injected } = modifyCascadeModelConfigData(Buffer.alloc(0), "inject");
  assert.equal(injected, 1, "空清单也应能注入 BYOK 条目");
  assert.equal(configLabels(bytes).length, 1);
});
