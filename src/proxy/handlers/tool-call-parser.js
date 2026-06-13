import { isAllowedToolName, normalizeToolArguments, normalizeToolInvocation } from "./tool-normalization.js";
const TOOL_CALL_START_MARKERS = ["<tool_call>", "<tool>", "<minimax:tool_call", "<tool_calls_section_begin>", "{\"action\":\"tool_call\"", "{\"action\": \"tool_call\""];
const MAX_TOOL_MARKER_LOOKBEHIND = Math.max(...TOOL_CALL_START_MARKERS.map(arg0 => arg0.length));
function toRecoveredCalls(arg0) {
  const tmp1 = new Map();
  for (const tmp0 of arg0) {
    if (!tmp0 || typeof tmp0.name !== "string") {
      continue;
    }
    const tmp02 = normalizeToolInvocation(tmp0.name, tmp0.input ?? tmp0.arguments ?? tmp0.params ?? {});
    if (!tmp02.toolName || !isAllowedToolName(tmp02.toolName)) {
      continue;
    }
    const tmp12 = tmp02.params ?? {};
    if (typeof tmp12 !== "object" || tmp12 == null || Array.isArray(tmp12)) {
      continue;
    }
    const tmp2 = tmp02.toolName + ":" + JSON.stringify(tmp12);
    if (!tmp1.has(tmp2)) {
      const tmp03 = {
        name: tmp02.toolName,
        input: tmp12
      };
      tmp1.set(tmp2, tmp03);
    }
  }
  return [...tmp1.values()];
}
function extractBalancedJsonObject(arg0, arg1) {
  if (!arg0 || arg1 < 0 || arg1 >= arg0.length || arg0[arg1] !== "{") {
    return null;
  }
  let tmp2 = 0;
  let tmp3 = false;
  let tmp4 = false;
  for (let tmp0 = arg1; tmp0 < arg0.length; tmp0++) {
    const tmp02 = arg0[tmp0];
    if (tmp3) {
      if (tmp4) {
        tmp4 = false;
      } else if (tmp02 === "\\") {
        tmp4 = true;
      } else if (tmp02 === "\"") {
        tmp3 = false;
      }
      continue;
    }
    if (tmp02 === "\"") {
      tmp3 = true;
      continue;
    }
    if (tmp02 === "{") {
      tmp2++;
    }
    if (tmp02 === "}") {
      tmp2--;
      if (tmp2 === 0) {
        return arg0.slice(arg1, tmp0 + 1);
      }
    }
  }
  return null;
}
export function findToolCallStartIndex(arg0) {
  if (!arg0 || typeof arg0 !== "string") {
    return -1;
  }
  let tmp1 = -1;
  for (const tmp0 of TOOL_CALL_START_MARKERS) {
    const tmp02 = arg0.indexOf(tmp0);
    if (tmp02 !== -1 && (tmp1 === -1 || tmp02 < tmp1)) {
      tmp1 = tmp02;
    }
  }
  return tmp1;
}
export { MAX_TOOL_MARKER_LOOKBEHIND };
export function parseJsonActionToolCalls(arg0) {
  if (!arg0 || typeof arg0 !== "string") {
    return [];
  }
  const tmp1 = [];
  const tmp2 = ["{\"action\":\"tool_call\"", "{\"action\": \"tool_call\""];
  for (const tmp0 of tmp2) {
    let tmp02 = 0;
    while (tmp02 < arg0.length) {
      const tmp03 = arg0.indexOf(tmp0, tmp02);
      if (tmp03 === -1) {
        break;
      }
      const tmp12 = extractBalancedJsonObject(arg0, tmp03);
      if (!tmp12) {
        break;
      }
      try {
        const tmp04 = JSON.parse(tmp12);
        if (tmp04 && tmp04.action === "tool_call" && Array.isArray(tmp04.tool_calls)) {
          tmp1.push(...tmp04.tool_calls.map(arg02 => ({
            name: arg02?.name,
            input: normalizeToolArguments(arg02?.arguments ?? {})
          })));
        }
      } catch {}
      tmp02 = tmp03 + tmp0.length;
    }
  }
  return toRecoveredCalls(tmp1);
}
export function parseInlineToolCalls(arg0) {
  if (!arg0 || typeof arg0 !== "string") {
    return [];
  }
  const tmp1 = [...arg0.matchAll(/<tool(?:_call)?>\s*([\w.-]+)\s*(\{[\s\S]*?\})(?=\s*(?:<\/tool(?:_call)?>|$))/g)];
  if (tmp1.length === 0) {
    return [];
  }
  const tmp2 = [];
  for (const tmp0 of tmp1) {
    const tmp02 = tmp0[1];
    const tmp12 = tmp0[2];
    try {
      tmp2.push({
        name: tmp02,
        input: normalizeToolArguments(JSON.parse(tmp12))
      });
    } catch {}
  }
  return toRecoveredCalls(tmp2);
}
export function parseMiniMaxToolCalls(arg0) {
  if (!arg0 || typeof arg0 !== "string") {
    return [];
  }
  const tmp1 = [];
  const tmp2 = /<minimax:tool_call[^>]*>([\s\S]*?)<\/minimax:tool_call>/g;
  let tmp3;
  while ((tmp3 = tmp2.exec(arg0)) !== null) {
    const tmp0 = tmp3[1].trim();
    if (!tmp0) {
      continue;
    }
    try {
      const tmp02 = JSON.parse(tmp0);
      const tmp13 = tmp02.name || tmp02.tool_name || tmp02.function || "";
      const tmp22 = tmp02.arguments || tmp02.parameters || tmp02.input || tmp02.params || {};
      if (!tmp13) {
        continue;
      }
      tmp1.push({
        name: tmp13,
        input: normalizeToolArguments(typeof tmp22 === "string" ? JSON.parse(tmp22) : tmp22)
      });
      continue;
    } catch {}
    const tmp12 = tmp0.split("\n").map(arg02 => arg02.trim()).filter(Boolean);
    if (tmp12.length >= 2) {
      const tmp02 = tmp12[0].replace(/^functions\./, "").replace(/:\d+$/, "");
      try {
        tmp1.push({
          name: tmp02,
          input: normalizeToolArguments(JSON.parse(tmp12.slice(1).join("")))
        });
      } catch {}
    }
  }
  return toRecoveredCalls(tmp1);
}
export function parseSectionToolCalls(arg0) {
  if (!arg0 || typeof arg0 !== "string") {
    return [];
  }
  const tmp1 = [];
  const tmp2 = arg0.indexOf("<tool_calls_section_begin>");
  const tmp3 = arg0.indexOf("<tool_calls_section_end>");
  if (tmp2 === -1) {
    return tmp1;
  }
  const tmp4 = arg0.substring(tmp2, tmp3 !== -1 ? tmp3 : undefined);
  const tmp5 = /<tool_call_begin>\s*([\s\S]*?)<tool_call_end>/g;
  let tmp6;
  while ((tmp6 = tmp5.exec(tmp4)) !== null) {
    const tmp0 = tmp6[1];
    const tmp12 = tmp0.match(/^\s*(?:functions\.)?([\w.-]+?)(?::\d+)?\s*<tool_call_argument_begin>/s);
    if (!tmp12) {
      continue;
    }
    const tmp22 = tmp12[1];
    const tmp32 = tmp0.indexOf("<tool_call_argument_begin>");
    if (tmp32 === -1) {
      continue;
    }
    const tmp42 = tmp0.substring(tmp32 + "<tool_call_argument_begin>".length).trim();
    try {
      tmp1.push({
        name: tmp22,
        input: normalizeToolArguments(JSON.parse(tmp42))
      });
    } catch {}
  }
  return toRecoveredCalls(tmp1);
}
export function parseTextToolCalls(arg0) {
  if (!arg0 || typeof arg0 !== "string") {
    return [];
  }
  const tmp1 = [parseJsonActionToolCalls, parseInlineToolCalls, parseMiniMaxToolCalls, parseSectionToolCalls];
  const tmp2 = [];
  for (const fn of tmp1) {
    const tmp0 = fn(arg0);
    if (tmp0.length > 0) {
      tmp2.push(...tmp0);
    }
  }
  return toRecoveredCalls(tmp2);
}
