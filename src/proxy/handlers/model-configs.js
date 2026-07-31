/**
 * 模型清单接管（Cascade Model Configs 注入 / 替换）
 *
 * 背景：Devin 的模型下拉列表由服务端下发，本插件的 4 个 BYOK 槽位原本寄生在
 * MODEL_CLAUDE_4_*_BYOK 这 4 个枚举条目上。服务端不再下发这些条目后，用户
 * 在 UI 里选不到它们，槽位路由因此拿不到触发入口（插件转发能力本身完好）。
 *
 * 本模块在代理层改写清单，把 4 个槽位条目重新放回下拉框：
 *   inject  — 保留官方条目，追加 BYOK 条目（Pro 账号可继续用官方额度）
 *   replace — 丢弃官方条目，只保留 BYOK 条目
 *   off     — 不接管，原样放行
 *
 * 涉及的两条投喂路径（都经过 hybrid-server，因 P1/P2 补丁已把 API server 指向本地）：
 *   SeatManagementService/GetUserStatus → UserStatus(f1).cascade_model_config_data(f33)
 *   ApiServerService/GetCascadeModelConfigs → 顶层就是 CascadeModelConfigData 形状
 *
 * 关键实现约束（均已通过解码线上响应核实）：
 *   1. client_model_sorts(f2) 是唯一的展示驱动——渲染代码按 label 建 Map，
 *      只有被某个 sort 分组引用的 label 才会出现在 UI 上。只往 f1 注入条目
 *      是看不见的，必须同步往 f2 追加分组。
 *   2. 条目的 disabled(f4) 必须省略（proto3 false 为缺省）；写显式 0 可能触发
 *      严格校验，写 true 会被灰掉。disabled_reason(f33) 同样不能写。
 *   3. model_uid 沿用原 BYOK 枚举名——这些枚举在 extension.js 与 language_server
 *      里都还在，且线上仍有 39 个老式条目在服役，能天然通过潜在的合法性校验。
 *      同时 byok-slots.js 的 BYOK_SLOT_BY_REQUEST 无需改动。
 */

import {
  parseFields,
  getField,
  getAllFields,
  writeStringField,
  writeVarintField,
  writeMessageField,
  replaceFields
} from "../proto.js";
import { getModelListMode, getRuntimeConfig, getSlotModel, getSlotThinkingEffort } from "./models.js";

/** ClientModelConfig 字段号 */
const CFG_LABEL = 1;
const CFG_MODEL_OR_ALIAS = 2;
const CFG_SUPPORTS_IMAGES = 5;
const CFG_PROVIDER = 10;
const CFG_PRICING_TYPE = 13;
const CFG_MAX_TOKENS = 18;
const CFG_MODEL_UID = 22;

/** ModelProvider 枚举（决定下拉框里的厂商图标） */
const MODEL_PROVIDER = {
  UNSPECIFIED: 0,
  WINDSURF: 1,
  OPENAI: 2,
  ANTHROPIC: 3,
  GOOGLE: 4,
  XAI: 5,
  DEEPSEEK: 6,
  MOONSHOT: 7,
  QWEN: 8,
  ZAI: 9,
  MINIMAX: 10,
  NVIDIA: 11,
  THINKING_MACHINES: 12
};

/** ModelOrAlias.model（oneof 分支 1，枚举号） */
const MOA_MODEL_ENUM = 1;

/** ModelPricingType.MODEL_PRICING_TYPE_BYOK */
const PRICING_TYPE_BYOK = 3;

/** CascadeModelConfigData / GetCascadeModelConfigsResponse 字段号 */
const DATA_CLIENT_MODEL_CONFIGS = 1;
const DATA_CLIENT_MODEL_SORTS = 2;

/** ClientModelSort / ClientModelGroup 字段号 */
const SORT_NAME = 1;
const SORT_GROUPS = 2;
const GROUP_NAME = 1;
const GROUP_MODEL_LABELS = 2;

/** GetUserStatusResponse.user_status / UserStatus.cascade_model_config_data */
const RESP_USER_STATUS = 1;
const USER_STATUS_CASCADE_DATA = 33;

/** UI 上 BYOK 分组的名字 */
const BYOK_SORT_NAME = "BYOK";
const BYOK_GROUP_NAME = "自定义模型";

/**
 * 4 个槽位与其寄生枚举的对应关系。
 * uid 必须与 byok-slots.js 的 BYOK_SLOT_BY_REQUEST 键保持一致，
 * 否则选中后 getByokSlot() 拿不到槽位。
 */
export const BYOK_SLOT_ENTRIES = [
  { slot: 1, enumNo: 277, uid: "MODEL_CLAUDE_4_OPUS_BYOK" },
  { slot: 2, enumNo: 278, uid: "MODEL_CLAUDE_4_OPUS_THINKING_BYOK" },
  { slot: 3, enumNo: 279, uid: "MODEL_CLAUDE_4_SONNET_BYOK" },
  { slot: 4, enumNo: 280, uid: "MODEL_CLAUDE_4_SONNET_THINKING_BYOK" }
];

/** 厂商前缀 → 规范显示名。用连字符的（GPT-5.4）与用空格的（Claude Opus 4.8）分开处理，对齐官方条目风格 */
const VENDOR_DISPLAY = {
  claude: { name: "Claude", hyphenVersion: false },
  gpt: { name: "GPT", hyphenVersion: true },
  o1: { name: "o1", hyphenVersion: true },
  o3: { name: "o3", hyphenVersion: true },
  o4: { name: "o4", hyphenVersion: true },
  gemini: { name: "Gemini", hyphenVersion: false },
  grok: { name: "Grok", hyphenVersion: false },
  glm: { name: "GLM", hyphenVersion: true },
  kimi: { name: "Kimi", hyphenVersion: false },
  qwen: { name: "Qwen", hyphenVersion: false },
  deepseek: { name: "DeepSeek", hyphenVersion: false },
  llama: { name: "Llama", hyphenVersion: false },
  mistral: { name: "Mistral", hyphenVersion: false },
  nemotron: { name: "Nemotron", hyphenVersion: false },
  minimax: { name: "MiniMax", hyphenVersion: false },
  swe: { name: "SWE", hyphenVersion: true }
};

/** 词元 → 规范大小写 */
const TOKEN_DISPLAY = {
  opus: "Opus",
  sonnet: "Sonnet",
  haiku: "Haiku",
  fable: "Fable",
  mini: "Mini",
  nano: "Nano",
  flash: "Flash",
  pro: "Pro",
  ultra: "Ultra",
  max: "Max",
  high: "High",
  xhigh: "XHigh",
  medium: "Medium",
  low: "Low",
  minimal: "Minimal",
  none: "None",
  codex: "Codex",
  turbo: "Turbo",
  instruct: "Instruct",
  thinking: "Thinking",
  reasoning: "Reasoning",
  priority: "Fast",
  fast: "Fast",
  latest: "Latest",
  preview: "Preview",
  chat: "Chat",
  "1m": "1M",
  oss: "OSS"
};

/** 思考强度 → 显示后缀 */
const EFFORT_DISPLAY = {
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "XHigh",
  max: "Max"
};

/**
 * 把模型 slug 变成人类可读的显示名。
 *   claude-opus-4-8          → Claude Opus 4.8
 *   gpt-5-4-xhigh            → GPT-5.4 XHigh
 *   claude-3-5-haiku-20241022 → Claude 3.5 Haiku
 *   gemini-3-pro             → Gemini 3 Pro
 * 无法识别的部分原样保留，最差情况退回原始模型名（不会丢信息）。
 * @param {string} model
 * @returns {string}
 */
export function prettifyModelName(model) {
  const tmp0 = String(model || "").trim();
  if (!tmp0) {
    return "";
  }
  // 去掉 provider 路径前缀（如 anthropic/claude-opus-4-8、models/gemini-3-pro）
  const tmp1 = tmp0.includes("/") ? tmp0.slice(tmp0.lastIndexOf("/") + 1) : tmp0;
  // 去掉尾部 8 位日期戳（20241022）。-thinking 保留：它是模型变体的一部分，
  // 与「思考强度」是两件事，丢掉会让 xxx 与 xxx-thinking 显示成同一个名字
  const tmp2 = tmp1.replace(/-\d{8}$/, "").trim();
  if (!tmp2) {
    return tmp0;
  }

  const tmp3 = tmp2.split(/[-_.]/).filter(Boolean);
  if (tmp3.length === 0) {
    return tmp0;
  }

  const tmp4 = tmp3[0].toLowerCase();
  const tmp5 = VENDOR_DISPLAY[tmp4];
  const tmp6 = [];
  let tmp7 = 1;

  if (tmp5) {
    // 厂商名后紧跟的连续数字段合成版本号：4,8 → 4.8
    const tmp8 = [];
    while (tmp7 < tmp3.length && /^\d+$/.test(tmp3[tmp7])) {
      tmp8.push(tmp3[tmp7]);
      tmp7++;
    }
    if (tmp8.length > 0) {
      const tmp9 = tmp8.join(".");
      tmp6.push(tmp5.hyphenVersion ? tmp5.name + "-" + tmp9 : tmp5.name + " " + tmp9);
    } else if (tmp7 < tmp3.length && /^\d+[a-z]+$/i.test(tmp3[tmp7]) && tmp5.hyphenVersion) {
      // 版本号与后缀连写的情况：gpt-4o → GPT-4o
      tmp6.push(tmp5.name + "-" + tmp3[tmp7].toLowerCase());
      tmp7++;
    } else {
      tmp6.push(tmp5.name);
    }
  } else {
    tmp7 = 0;
  }

  // 其余词元：已知的规范化，纯数字合并成版本号，未知的首字母大写
  for (let tmp10 = tmp7; tmp10 < tmp3.length; tmp10++) {
    const tmp11 = tmp3[tmp10];
    const tmp12 = tmp11.toLowerCase();
    if (TOKEN_DISPLAY[tmp12]) {
      tmp6.push(TOKEN_DISPLAY[tmp12]);
      continue;
    }
    if (/^\d+$/.test(tmp11)) {
      const tmp13 = [tmp11];
      while (tmp10 + 1 < tmp3.length && /^\d+$/.test(tmp3[tmp10 + 1])) {
        tmp13.push(tmp3[tmp10 + 1]);
        tmp10++;
      }
      tmp6.push(tmp13.join("."));
      continue;
    }
    tmp6.push(tmp11.charAt(0).toUpperCase() + tmp11.slice(1));
  }

  const tmp14 = tmp6.join(" ").replace(/\s+/g, " ").trim();
  return tmp14 || tmp0;
}

/**
 * 按模型名推断 ModelProvider 枚举，让下拉框显示正确的厂商图标。
 * @param {string} model
 * @returns {number} MODEL_PROVIDER 枚举值，识别不出时为 UNSPECIFIED
 */
export function detectModelProviderEnum(model) {
  const tmp0 = String(model || "")
    .trim()
    .toLowerCase()
    .replace(/-thinking$/i, "");
  const tmp1 = tmp0.includes("/") ? tmp0.slice(tmp0.lastIndexOf("/") + 1) : tmp0;
  if (/^claude/.test(tmp1)) return MODEL_PROVIDER.ANTHROPIC;
  if (/^(gpt|o[1-9]|chatgpt|codex)/.test(tmp1)) return MODEL_PROVIDER.OPENAI;
  if (/^gemini/.test(tmp1)) return MODEL_PROVIDER.GOOGLE;
  if (/^grok/.test(tmp1)) return MODEL_PROVIDER.XAI;
  if (/^deepseek/.test(tmp1)) return MODEL_PROVIDER.DEEPSEEK;
  if (/^(kimi|moonshot)/.test(tmp1)) return MODEL_PROVIDER.MOONSHOT;
  if (/^qwen/.test(tmp1)) return MODEL_PROVIDER.QWEN;
  if (/^glm/.test(tmp1)) return MODEL_PROVIDER.ZAI;
  if (/^minimax/.test(tmp1)) return MODEL_PROVIDER.MINIMAX;
  if (/^nemotron/.test(tmp1)) return MODEL_PROVIDER.NVIDIA;
  if (/^swe/.test(tmp1)) return MODEL_PROVIDER.WINDSURF;
  return MODEL_PROVIDER.UNSPECIFIED;
}

/**
 * 生成槽位在下拉框里显示的名字。
 *
 * replace 模式：官方条目已被全部丢弃，不存在撞名风险，直接显示干净的模型名
 *   （Claude Opus 4.8 High），所见即所得。
 * inject 模式：与官方条目共存，必须带 (BYOKn) 后缀 —— sorts 按 label 查表，
 *   重名会导致命中错误条目；且用户需要分清哪条走自己的 key。
 *
 * @param {number} slot
 * @param {string} model
 * @param {string} [mode] - inject | replace
 * @returns {string}
 */
export function buildSlotLabel(slot, model, mode) {
  const tmp0 = String(model || "").trim();
  const tmp1 = EFFORT_DISPLAY[getSlotThinkingEffort(slot)] || "";
  const tmp2 = prettifyModelName(tmp0) || "未配置";
  const tmp3 = tmp1 ? tmp2 + " " + tmp1 : tmp2;
  return mode === "replace" ? tmp3 : tmp3 + " (BYOK" + slot + ")";
}

/**
 * 构造单条 ClientModelConfig。
 * 刻意不写 disabled(f4) 与 disabled_reason(f33)：proto3 下 false 是缺省值，
 * 显式写 0 可能触发严格校验，写了 reason 会让条目在 UI 上变灰不可点。
 * @param {{enumNo:number, uid:string, label:string, maxTokens:number}} arg0
 * @returns {Buffer}
 */
export function buildClientModelConfig(arg0) {
  const tmp1 = [
    writeStringField(CFG_LABEL, arg0.label),
    writeMessageField(CFG_MODEL_OR_ALIAS, writeVarintField(MOA_MODEL_ENUM, arg0.enumNo)),
    writeVarintField(CFG_SUPPORTS_IMAGES, 1),
    writeVarintField(CFG_PRICING_TYPE, PRICING_TYPE_BYOK),
    writeVarintField(CFG_MAX_TOKENS, arg0.maxTokens),
    writeStringField(CFG_MODEL_UID, arg0.uid)
  ];
  // provider 决定下拉框里的厂商图标；UNSPECIFIED(0) 是 proto3 缺省值，省略以免多写一个字节
  if (arg0.provider) {
    tmp1.splice(3, 0, writeVarintField(CFG_PROVIDER, arg0.provider));
  }
  return Buffer.concat(tmp1);
}

/**
 * 收集所有「已配置模型」的槽位条目。未配置 BYOKn_MODEL 的槽位不出现在下拉框里，
 * 避免用户选中后拿到 "model not configured" 错误。
 * @returns {Array<{slot:number, enumNo:number, uid:string, label:string}>}
 */
export function collectConfiguredSlots(mode) {
  const tmp0 = [];
  const tmp3 = new Map();
  for (const tmp1 of BYOK_SLOT_ENTRIES) {
    const tmp2 = String(getSlotModel(tmp1.slot) || "").trim();
    if (!tmp2) {
      continue;
    }
    let tmp4 = buildSlotLabel(tmp1.slot, tmp2, mode);
    // replace 模式下不带 (BYOKn) 后缀，两个槽位配同一模型+同一强度时会撞名；
    // sorts 按 label 查表，重名会让其中一条永远选不到，故加后缀去重
    if (tmp3.has(tmp4)) {
      tmp4 = tmp4 + " (BYOK" + tmp1.slot + ")";
    }
    tmp3.set(tmp4, true);
    tmp0.push({
      slot: tmp1.slot,
      enumNo: tmp1.enumNo,
      uid: tmp1.uid,
      label: tmp4,
      provider: detectModelProviderEnum(tmp2)
    });
  }
  return tmp0;
}

/**
 * 构造 BYOK 条目字节数组。
 * @param {Array} arg0 - collectConfiguredSlots() 的输出
 * @returns {Buffer[]}
 */
function buildByokConfigBlobs(arg0) {
  const tmp1 = getRuntimeConfig().maxTokens || 32768;
  return arg0.map(arg02 =>
    buildClientModelConfig({
      enumNo: arg02.enumNo,
      uid: arg02.uid,
      label: arg02.label,
      provider: arg02.provider,
      maxTokens: tmp1
    })
  );
}

/**
 * 构造一个只含 BYOK 分组的 ClientModelSort。
 * @param {string[]} arg0 - 要放进分组的 label 列表
 * @returns {Buffer}
 */
function buildByokSortBlob(arg0) {
  const tmp1 = Buffer.concat([
    writeStringField(GROUP_NAME, BYOK_GROUP_NAME),
    ...arg0.map(arg02 => writeStringField(GROUP_MODEL_LABELS, arg02))
  ]);
  return Buffer.concat([
    writeStringField(SORT_NAME, BYOK_SORT_NAME),
    writeMessageField(SORT_GROUPS, tmp1)
  ]);
}

/**
 * 往一个已有的 ClientModelSort 里追加 BYOK 分组，保留其原有分组与字段。
 * inject 模式下这样做，能让 BYOK 条目在官方的每个排序视图里都可见
 * （否则切到 Provider / Cost 视图就找不到了）。
 * @param {Buffer} arg0 - 原 ClientModelSort 字节
 * @param {string[]} arg1 - BYOK label 列表
 * @returns {Buffer}
 */
function appendByokGroupToSort(arg0, arg1) {
  const tmp2 = parseFields(arg0);
  const tmp3 = getAllFields(tmp2, SORT_GROUPS).map(arg02 => arg02.value);
  const tmp4 = Buffer.concat([
    writeStringField(GROUP_NAME, BYOK_GROUP_NAME),
    ...arg1.map(arg02 => writeStringField(GROUP_MODEL_LABELS, arg02))
  ]);
  return replaceFields(tmp2, { [SORT_GROUPS]: [...tmp3, tmp4] });
}

/**
 * 改写 CascadeModelConfigData 形状的字节（含 client_model_configs / client_model_sorts）。
 * 这是 inject / replace 的共同核心，GetUserStatus 与 GetCascadeModelConfigs 都复用它。
 *
 * @param {Buffer} arg0 - 原始 CascadeModelConfigData 字节（可为空 Buffer）
 * @param {string} arg1 - inject | replace
 * @returns {{bytes: Buffer, injected: number, mode: string}}
 */
export function modifyCascadeModelConfigData(arg0, arg1) {
  const tmp2 = collectConfiguredSlots(arg1);
  if (tmp2.length === 0) {
    // 没有任何已配置槽位 —— 不做改动，避免造出一个空的或只有占位项的下拉框
    return { bytes: arg0, injected: 0, mode: arg1 };
  }

  const tmp3 = arg0 && arg0.length > 0 ? parseFields(arg0) : [];
  const tmp4 = buildByokConfigBlobs(tmp2);
  const tmp5 = tmp2.map(arg02 => arg02.label);

  let tmp6;
  let tmp7;
  if (arg1 === "replace") {
    tmp6 = tmp4;
    tmp7 = [buildByokSortBlob(tmp5)];
  } else {
    const tmp8 = getAllFields(tmp3, DATA_CLIENT_MODEL_CONFIGS).map(arg02 => arg02.value);
    const tmp9 = getAllFields(tmp3, DATA_CLIENT_MODEL_SORTS).map(arg02 => arg02.value);
    tmp6 = [...tmp8, ...tmp4];
    // 官方每个排序视图都追加 BYOK 分组；若上游一个 sort 都没给，就自建一个
    tmp7 = tmp9.length > 0
      ? tmp9.map(arg02 => appendByokGroupToSort(arg02, tmp5))
      : [buildByokSortBlob(tmp5)];
  }

  const tmp10 = replaceFields(tmp3, {
    [DATA_CLIENT_MODEL_CONFIGS]: tmp6,
    [DATA_CLIENT_MODEL_SORTS]: tmp7
  });
  return { bytes: tmp10, injected: tmp4.length, mode: arg1 };
}

/**
 * 改写 GetCascadeModelConfigsResponse（顶层即 CascadeModelConfigData 形状）。
 * 解析失败或无槽位时返回原字节，交由调用方降级放行。
 * @param {Buffer} arg0
 * @param {string} [arg1] - 模式，默认取运行时配置
 * @returns {{bytes: Buffer, injected: number, mode: string, changed: boolean}}
 */
export function modifyGetCascadeModelConfigsResponse(arg0, arg1) {
  const tmp2 = arg1 || getModelListMode();
  if (tmp2 === "off") {
    return { bytes: arg0, injected: 0, mode: tmp2, changed: false };
  }
  const tmp3 = modifyCascadeModelConfigData(arg0, tmp2);
  return { ...tmp3, changed: tmp3.injected > 0 };
}

/**
 * 改写 GetUserStatusResponse —— 需要逐层下钻：
 *   GetUserStatusResponse.user_status(f1) → UserStatus.cascade_model_config_data(f33)
 * 外层两级都用 replaceFields 重建，以保留 plan / email / 配额等其余字段
 * （直接自造整个 UserStatus 会破坏登录态）。
 * @param {Buffer} arg0
 * @param {string} [arg1] - 模式，默认取运行时配置
 * @returns {{bytes: Buffer, injected: number, mode: string, changed: boolean}}
 */
export function modifyGetUserStatusResponse(arg0, arg1) {
  const tmp2 = arg1 || getModelListMode();
  if (tmp2 === "off") {
    return { bytes: arg0, injected: 0, mode: tmp2, changed: false };
  }

  const tmp3 = parseFields(arg0);
  const tmp4 = getField(tmp3, RESP_USER_STATUS, 2);
  if (!tmp4) {
    // 没有 user_status —— 可能是错误响应或结构变更，原样放行
    return { bytes: arg0, injected: 0, mode: tmp2, changed: false };
  }

  const tmp5 = parseFields(tmp4.value);
  const tmp6 = getField(tmp5, USER_STATUS_CASCADE_DATA, 2);
  const tmp7 = modifyCascadeModelConfigData(tmp6 ? tmp6.value : Buffer.alloc(0), tmp2);
  if (tmp7.injected === 0) {
    return { bytes: arg0, injected: 0, mode: tmp2, changed: false };
  }

  const tmp8 = replaceFields(tmp5, { [USER_STATUS_CASCADE_DATA]: [tmp7.bytes] });
  const tmp9 = replaceFields(tmp3, { [RESP_USER_STATUS]: [tmp8] });
  return { bytes: tmp9, injected: tmp7.injected, mode: tmp2, changed: true };
}
