import fs from "node:fs";
import path from "node:path";
import { parseFields, getField, getAllFields } from "../proto.js";
import { unwrapRequest } from "../connect.js";
import { KNOWN_TOOL_NAMES, isAllowedToolName, normalizeToolInvocation } from "./tool-normalization.js";
const SYSTEM_PROMPT_OVERRIDE = process.env.SYSTEM_PROMPT_OVERRIDE === "true";
const SYSTEM_PROMPT_PATH = process.env.SYSTEM_PROMPT_PATH || "";
const DEBUG_UNKNOWN_FIELDS = process.env.DEBUG_UNKNOWN_FIELDS === "1";
const DEBUG_EXPORT_SYSTEM_PROMPT = process.env.DEBUG_EXPORT_SYSTEM_PROMPT === "1";
const DEBUG_SYSTEM_PROMPT_DUMP_PATH = process.env.DEBUG_SYSTEM_PROMPT_DUMP_PATH || "./debug/original-system-prompt.txt";
const STRIP_UNSIGNED_THINKING = process.env.STRIP_UNSIGNED_THINKING !== "false";
let _warnedUnsignedThinking = false;
let _promptCache = {
  content: "",
  mtime: 0,
  path: ""
};
let _promptDumpCache = {
  content: "",
  path: ""
};
const ANTHROPIC_TOOL_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
function getCustomSystemPrompt() {
  if (!SYSTEM_PROMPT_OVERRIDE || !SYSTEM_PROMPT_PATH) {
    return "";
  }
  try {
    const tmp0 = fs.statSync(SYSTEM_PROMPT_PATH);
    if (_promptCache.path === SYSTEM_PROMPT_PATH && _promptCache.mtime === tmp0.mtimeMs) {
      return _promptCache.content;
    }
    const tmp1 = fs.readFileSync(SYSTEM_PROMPT_PATH, "utf8").trim();
    const tmp2 = {
      content: tmp1,
      mtime: tmp0.mtimeMs,
      path: SYSTEM_PROMPT_PATH
    };
    _promptCache = tmp2;
    console.log("  📝 Custom system prompt loaded (" + tmp1.length + " chars)");
    return tmp1;
  } catch (tmp0) {
    console.error("  ❌ Failed to load custom system prompt: " + tmp0.message);
    return "";
  }
}
function dumpOriginalSystemPrompt(arg0) {
  if (!DEBUG_EXPORT_SYSTEM_PROMPT || !arg0) {
    return;
  }
  const tmp1 = path.isAbsolute(DEBUG_SYSTEM_PROMPT_DUMP_PATH) ? DEBUG_SYSTEM_PROMPT_DUMP_PATH : path.resolve(process.cwd(), DEBUG_SYSTEM_PROMPT_DUMP_PATH);
  if (_promptDumpCache.path === tmp1 && _promptDumpCache.content === arg0) {
    return;
  }
  try {
    fs.mkdirSync(path.dirname(tmp1), {
      recursive: true
    });
    const tmp0 = arg0.split("\n").map(arg02 => /(?:key|token|secret|password|credential)\s*[:=]\s*\S/i.test(arg02) ? "[REDACTED]" : arg02).join("\n");
    fs.writeFileSync(tmp1, tmp0.trim() + "\n", {
      encoding: "utf8",
      mode: 384
    });
    const tmp12 = {
      content: arg0,
      path: tmp1
    };
    _promptDumpCache = tmp12;
    console.log("  📝 Dumped original system prompt to " + tmp1 + " (" + arg0.length + " chars)");
    console.warn("  ⚠️  DEBUG_EXPORT_SYSTEM_PROMPT is ON — disable in production");
  } catch (tmp0) {
    console.error("  ❌ Failed to dump original system prompt: " + tmp0.message);
  }
}
const KEEP_SECTIONS = ["tool_calling", "making_code_changes", "debugging", "running_commands", "calling_external_apis", "communication", "workflows"];
const KEEP_LINE_PATTERNS = [/^There will be an <ephemeral_message>/];
function extractFunctionalSections(arg0) {
  const tmp1 = [];
  for (const tmp0 of KEEP_SECTIONS) {
    const tmp02 = new RegExp("<" + tmp0 + ">[\\s\\S]*?</" + tmp0 + ">", "g");
    let tmp12;
    while ((tmp12 = tmp02.exec(arg0)) !== null) {
      tmp1.push(tmp12[0]);
    }
    const tmp2 = "<" + tmp0 + " ";
    const tmp3 = "</" + tmp0 + ">";
    let tmp4 = arg0.indexOf(tmp2);
    while (tmp4 !== -1) {
      const tmp03 = arg0.indexOf(tmp3, tmp4);
      if (tmp03 !== -1) {
        tmp1.push(arg0.slice(tmp4, tmp03 + tmp3.length));
      }
      tmp4 = arg0.indexOf(tmp2, tmp4 + 1);
    }
  }
  for (const tmp0 of arg0.split("\n")) {
    const tmp02 = tmp0.trim();
    if (KEEP_LINE_PATTERNS.some(arg02 => arg02.test(tmp02))) {
      tmp1.push(tmp02);
    }
  }
  return tmp1.join("\n\n");
}
function compactPromptText(arg0) {
  if (!arg0) {
    return "";
  }
  return arg0.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
const SOURCE = {
  UNSPECIFIED: 0,
  USER: 1,
  SYSTEM: 2,
  UNKNOWN: 3,
  TOOL: 4,
  SYSTEM_PROMPT: 5
};
function parseImageData(arg0) {
  const tmp1 = parseFields(arg0);
  const tmp2 = getField(tmp1, 1, 2);
  const tmp3 = getField(tmp1, 2, 2);
  const tmp4 = getField(tmp1, 3, 2);
  return {
    base64_data: tmp2 ? tmp2.value.toString("utf8") : "",
    mime_type: tmp3 ? tmp3.value.toString("utf8") : "image/png",
    caption: tmp4 ? tmp4.value.toString("utf8") : ""
  };
}
function parseChatToolCall(arg0) {
  const tmp1 = parseFields(arg0);
  const tmp2 = getField(tmp1, 1, 2);
  const tmp3 = getField(tmp1, 2, 2);
  const tmp4 = getField(tmp1, 3, 2);
  const tmp5 = tmp3 ? tmp3.value.toString("utf8") : "";
  const tmp6 = tmp4 ? tmp4.value.toString("utf8") : "{}";
  const tmp7 = normalizeToolInvocation(tmp5, tmp6);
  return {
    id: tmp2 ? tmp2.value.toString("utf8") : "",
    name: tmp7.toolName,
    arguments_json: JSON.stringify(tmp7.params ?? {})
  };
}
function parseChatMessagePrompt(arg0) {
  const tmp1 = parseFields(arg0);
  const tmp2 = getField(tmp1, 1, 2);
  const tmp3 = getField(tmp1, 2, 0);
  const tmp4 = getField(tmp1, 3, 2);
  const tmp5 = getField(tmp1, 7, 2);
  const tmp6 = getField(tmp1, 9, 0);
  const tmp7 = getField(tmp1, 11, 2);
  const tmp8 = getField(tmp1, 12, 2);
  const tmp9 = getAllFields(tmp1, 6);
  const tmp10 = getAllFields(tmp1, 10);
  return {
    messageId: tmp2 ? tmp2.value.toString("utf8") : "",
    source: tmp3 ? tmp3.value : 0,
    prompt: tmp4 ? tmp4.value.toString("utf8") : "",
    toolCalls: tmp9.map(arg02 => parseChatToolCall(arg02.value)),
    toolCallId: tmp5 ? tmp5.value.toString("utf8") : "",
    toolResultIsError: tmp6 ? Boolean(tmp6.value) : false,
    images: tmp10.map(arg02 => parseImageData(arg02.value)),
    thinking: tmp7 ? tmp7.value.toString("utf8") : "",
    signature: tmp8 ? tmp8.value.toString("utf8") : ""
  };
}
function parseChatToolDefinition(arg0) {
  const tmp1 = parseFields(arg0);
  const tmp2 = getField(tmp1, 1, 2);
  const tmp3 = getField(tmp1, 2, 2);
  const tmp4 = getField(tmp1, 3, 2);
  const tmp5 = tmp2 ? tmp2.value.toString("utf8") : "";
  const tmp6 = tmp3 ? tmp3.value.toString("utf8") : "";
  const tmp7 = tmp4 ? tmp4.value.toString("utf8") : "{}";
  let tmp8;
  try {
    tmp8 = JSON.parse(tmp7);
  } catch {
    tmp8 = {
      type: "object",
      properties: {}
    };
  }
  if (!tmp8.type) {
    tmp8.type = "object";
  }
  if (tmp8.type === "object" && !tmp8.properties) {
    tmp8.properties = {};
  }
  const tmp9 = KNOWN_TOOL_NAMES.has(tmp5) ? tmp5 : normalizeToolInvocation(tmp5, {}).toolName || tmp5;
  const tmp10 = {
    name: tmp9,
    description: tmp6,
    input_schema: tmp8
  };
  return tmp10;
}
function parseChatToolChoice(arg0) {
  const tmp1 = parseFields(arg0);
  const tmp2 = getField(tmp1, 1, 2);
  const tmp3 = getField(tmp1, 2, 2);
  const tmp4 = tmp3 ? tmp3.value.toString("utf8").trim() : "";
  const tmp5 = tmp2 ? tmp2.value.toString("utf8").trim() : "";
  if (tmp4) {
    const tmp0 = normalizeToolInvocation(tmp4, {});
    const tmp12 = {
      type: "tool",
      name: tmp0.toolName
    };
    return tmp12;
  }
  if (tmp5) {
    const tmp0 = {
      type: tmp5
    };
    return tmp0;
  }
  return undefined;
}
function warnUnsignedThinkingStripped() {
  if (!_warnedUnsignedThinking) {
    _warnedUnsignedThinking = true;
    console.warn("  ⚠️  Stripped unsigned Claude thinking block before forwarding. Set STRIP_UNSIGNED_THINKING=false to preserve it.");
  }
}
function stableHash(arg0) {
  const tmp1 = String(arg0 || "");
  let tmp2 = 2166136261;
  for (let tmp0 = 0; tmp0 < tmp1.length; tmp0++) {
    tmp2 ^= tmp1.charCodeAt(tmp0);
    tmp2 = Math.imul(tmp2, 16777619);
  }
  return (tmp2 >>> 0).toString(36);
}
function sanitizeAnthropicToolId(arg0, arg1) {
  const tmp1 = String(arg0 || "");
  if (ANTHROPIC_TOOL_ID_PATTERN.test(tmp1)) {
    return tmp1;
  }
  const tmp2 = tmp1.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  const tmp3 = (tmp2 || "tool") + "_" + stableHash(tmp1 || "empty");
  let tmp4 = tmp3;
  let tmp5 = 1;
  while (arg1.has(tmp4)) {
    tmp4 = tmp3 + "_" + tmp5++;
  }
  return tmp4;
}
function toAnthropicMessage(arg0) {
  const {
    source: tmp1,
    prompt: tmp2,
    toolCalls: tmp3,
    toolCallId: tmp4,
    toolResultIsError: tmp5,
    images: tmp6,
    thinking: tmp7,
    signature: tmp8
  } = arg0;
  if (tmp1 === SOURCE.SYSTEM_PROMPT || tmp1 === SOURCE.UNSPECIFIED) {
    return null;
  }
  if (tmp1 === SOURCE.TOOL) {
    const tmp0 = {
      type: "tool_result",
      tool_use_id: tmp4,
      content: tmp2
    };
    const tmp12 = tmp0;
    if (tmp5) {
      tmp12.is_error = true;
    }
    const tmp22 = {
      role: "user",
      content: [tmp12]
    };
    return tmp22;
  }
  if (tmp1 === SOURCE.USER) {
    if (tmp6 && tmp6.length > 0) {
      const tmp02 = [];
      for (const tmp03 of tmp6) {
        if (tmp03.base64_data) {
          const tmp04 = {
            type: "image",
            source: {}
          };
          tmp04.source.type = "base64";
          tmp04.source.media_type = tmp03.mime_type || "image/png";
          tmp04.source.data = tmp03.base64_data;
          tmp02.push(tmp04);
        }
      }
      if (tmp2) {
        const tmp03 = {
          type: "text",
          text: tmp2
        };
        tmp02.push(tmp03);
      }
      const tmp12 = {
        role: "user",
        content: tmp02
      };
      return tmp12;
    }
    const tmp0 = {
      role: "user",
      content: tmp2
    };
    return tmp0;
  }
  if (tmp1 === SOURCE.UNKNOWN || tmp1 === SOURCE.SYSTEM) {
    const tmp0 = [];
    if (tmp7) {
      if (tmp8 || !STRIP_UNSIGNED_THINKING) {
        const tmp02 = {
          type: "thinking",
          thinking: tmp7
        };
        const tmp13 = tmp02;
        if (tmp8) {
          tmp13.signature = tmp8;
        }
        tmp0.push(tmp13);
      } else {
        warnUnsignedThinkingStripped();
      }
    }
    if (tmp2) {
      const tmp02 = {
        type: "text",
        text: tmp2
      };
      tmp0.push(tmp02);
    }
    for (const tmp02 of tmp3) {
      let tmp03;
      try {
        tmp03 = JSON.parse(tmp02.arguments_json);
      } catch {
        tmp03 = {};
      }
      const tmp13 = {
        type: "tool_use",
        id: tmp02.id,
        name: tmp02.name,
        input: tmp03
      };
      tmp0.push(tmp13);
    }
    if (tmp0.length > 1 || tmp0.length === 1 && tmp0[0].type !== "text") {
      const tmp02 = {
        role: "assistant",
        content: tmp0
      };
      return tmp02;
    }
    const tmp12 = {
      role: "assistant",
      content: tmp2
    };
    return tmp12;
  }
  return null;
}
function sanitizeAnthropicMessages(arg0) {
  let tmp1 = 0;
  const tmp2 = [];
  const tmp3 = new Map();
  const tmp4 = new Set();
  for (const tmp0 of arg0 || []) {
    if (!tmp0 || !Array.isArray(tmp0.content)) {
      tmp2.push(tmp0);
      continue;
    }
    const tmp02 = tmp0.content.filter(arg02 => {
      const tmp12 = arg02?.type === "thinking" && arg02.thinking && !arg02.signature;
      if (tmp12) {
        tmp1++;
      }
      return !tmp12 || !STRIP_UNSIGNED_THINKING;
    }).map(arg02 => {
      if (arg02?.type === "tool_use") {
        const tmp12 = String(arg02.id || "");
        const tmp22 = tmp3.get(tmp12) || sanitizeAnthropicToolId(tmp12, tmp4);
        tmp3.set(tmp12, tmp22);
        tmp4.add(tmp22);
        if (tmp22 !== tmp12) {
          console.warn("  ⚠️  Normalized Anthropic tool_use.id for Bedrock compatibility: " + (tmp12 || "(empty)") + " -> " + tmp22);
        }
        return {
          ...arg02,
          id: tmp22
        };
      }
      if (arg02?.type === "tool_result") {
        const tmp12 = String(arg02.tool_use_id || "");
        const tmp22 = tmp3.get(tmp12);
        if (tmp22 && tmp22 !== tmp12) {
          return {
            ...arg02,
            tool_use_id: tmp22
          };
        }
      }
      return arg02;
    });
    if (tmp02.length === 0) {
      if (tmp0.role === "assistant") {
        continue;
      }
      tmp2.push({
        ...tmp0,
        content: ""
      });
      continue;
    }
    if (tmp02.length === 1 && tmp02[0].type === "text") {
      tmp2.push({
        ...tmp0,
        content: tmp02[0].text
      });
    } else {
      tmp2.push({
        ...tmp0,
        content: tmp02
      });
    }
  }
  if (tmp1 > 0 && STRIP_UNSIGNED_THINKING) {
    warnUnsignedThinkingStripped();
  }
  return tmp2;
}
function normalizeContent(arg0) {
  if (typeof arg0 === "string") {
    const tmp0 = {
      type: "text",
      text: arg0
    };
    return [tmp0];
  }
  if (Array.isArray(arg0)) {
    return arg0;
  } else {
    return [];
  }
}
function mergeConsecutiveMessages(arg0) {
  if (arg0.length <= 1) {
    return arg0;
  }
  const tmp1 = [arg0[0]];
  for (let tmp0 = 1; tmp0 < arg0.length; tmp0++) {
    const tmp02 = tmp1[tmp1.length - 1];
    const tmp12 = arg0[tmp0];
    if (tmp02.role === tmp12.role) {
      const tmp03 = normalizeContent(tmp02.content);
      const tmp13 = normalizeContent(tmp12.content);
      tmp02.content = [...tmp03, ...tmp13];
    } else {
      tmp1.push(tmp12);
    }
  }
  for (const tmp0 of tmp1) {
    if (Array.isArray(tmp0.content) && tmp0.content.length === 1 && tmp0.content[0].type === "text") {
      tmp0.content = tmp0.content[0].text;
    }
  }
  return tmp1;
}
export { extractFunctionalSections, compactPromptText, sanitizeAnthropicMessages, sanitizeAnthropicToolId };
export function parseGetChatMessageRequest(arg0, arg1) {
  const tmp2 = unwrapRequest(arg0, arg1);
  const tmp3 = parseFields(tmp2);
  const tmp4 = new Set([1, 2, 3, 10, 12, 21]);
  const tmp5 = tmp3.filter(arg02 => !tmp4.has(arg02.field));
  if (tmp5.length > 0) {
    const tmp0 = tmp5.map(arg02 => arg02.field + "/" + arg02.wireType).join(", ");
    if (DEBUG_UNKNOWN_FIELDS) {
      console.log("  🔍 GetChatMessage unknown fields: " + tmp0);
      for (const tmp02 of tmp5) {
        if (tmp02.wireType === 0) {
          console.log("    field " + tmp02.field + " (varint): " + tmp02.value);
        } else if (tmp02.wireType === 2) {
          const tmp03 = tmp02.value.toString("utf8");
          const tmp1 = /^[\x20-\x7e\n\r\t]+$/.test(tmp03.slice(0, 50));
          console.log("    field " + tmp02.field + " (bytes/" + tmp02.value.length + "b): " + (tmp1 ? tmp03.slice(0, 120) : "[binary " + tmp02.value.toString("hex").slice(0, 40) + "]"));
        } else {
          console.log("    field " + tmp02.field + " (wire " + tmp02.wireType + "): " + tmp02.value?.toString?.("hex")?.slice(0, 40));
        }
      }
    }
  }
  const tmp6 = getField(tmp3, 2, 2);
  let tmp7 = tmp6 ? tmp6.value.toString("utf8") : "";
  dumpOriginalSystemPrompt(tmp7);
  if (SYSTEM_PROMPT_OVERRIDE) {
    const tmp0 = getCustomSystemPrompt();
    if (tmp0) {
      const tmp02 = tmp7.length;
      const tmp1 = compactPromptText(extractFunctionalSections(tmp7));
      tmp7 = compactPromptText(tmp1 ? tmp0 + "\n\n" + tmp1 : tmp0);
      console.log("  🔀 System prompt: custom " + tmp0.length + " + preserved " + tmp1.length + " chars (was " + tmp02 + ")");
    }
  }
  const tmp8 = getField(tmp3, 21, 2);
  const tmp9 = tmp8 ? tmp8.value.toString("utf8") : "";
  const tmp10 = getAllFields(tmp3, 3, 2);
  const tmp11 = tmp10.map(arg02 => parseChatMessagePrompt(arg02.value));
  for (const tmp0 of tmp11) {
    if (tmp0.source === SOURCE.SYSTEM_PROMPT && tmp0.prompt) {
      tmp7 += (tmp7 ? "\n\n" : "") + tmp0.prompt;
    }
  }
  tmp7 = compactPromptText(tmp7);
  let tmp12 = "agent";
  const tmp13 = tmp11.filter(arg02 => arg02.source !== SOURCE.SYSTEM_PROMPT && arg02.source !== SOURCE.UNSPECIFIED);
  if (tmp13.length > 0) {
    const tmp0 = tmp13[tmp13.length - 1];
    if (tmp0.source === SOURCE.USER) {
      const tmp02 = tmp13.length >= 2 ? tmp13[tmp13.length - 2] : null;
      if (!tmp02 || tmp02.source !== SOURCE.TOOL) {
        tmp12 = "user";
      } else {
        console.log("  🔍 Agent-round trailing USER text (" + tmp0.prompt.length + " chars): \"" + tmp0.prompt.slice(0, 150) + "...\"");
      }
    }
  }
  const tmp14 = sanitizeAnthropicMessages(mergeConsecutiveMessages(tmp11.map(toAnthropicMessage).filter(Boolean)));
  const tmp15 = getAllFields(tmp3, 10, 2);
  let tmp16 = tmp15.map(arg02 => parseChatToolDefinition(arg02.value)).filter(arg02 => arg02.name);
  if (tmp16.length > 0) {
    const tmp0 = new Map();
    for (const tmp02 of tmp16) {
      if (!tmp02.name) {
        continue;
      }
      if (!isAllowedToolName(tmp02.name)) {
        console.log("  ⚠️  Dropping unknown tool definition: " + tmp02.name);
        continue;
      }
      if (!tmp0.has(tmp02.name)) {
        tmp0.set(tmp02.name, tmp02);
      }
    }
    tmp16 = [...tmp0.values()];
  }
  if (tmp16.length === 0) {
    tmp16 = undefined;
  }
  const tmp17 = getField(tmp3, 12, 2);
  const tmp18 = tmp17 ? parseChatToolChoice(tmp17.value) : undefined;
  const tmp19 = {
    systemPrompt: tmp7,
    messages: tmp14,
    tools: tmp16,
    toolChoice: tmp18,
    requestedModel: tmp9,
    initiator: tmp12
  };
  return tmp19;
}
