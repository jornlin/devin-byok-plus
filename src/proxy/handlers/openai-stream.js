import { emitAIText, emitToolCall, emitChatEnd } from "../ws-bridge.js";
import { buildTextDelta, buildThinkingDelta, buildToolCallDelta, buildStopChunk, buildErrorChunk, STOP_REASON } from "./build-response.js";
import { MAX_TOOL_MARKER_LOOKBEHIND, findToolCallStartIndex, parseTextToolCalls } from "./tool-call-parser.js";
import { normalizeToolInvocation } from "./tool-normalization.js";
export function parseOpenAISSEChunk(arg0) {
  const tmp1 = [];
  const tmp2 = arg0.split("\n");
  for (const tmp0 of tmp2) {
    if (!tmp0.startsWith("data: ")) {
      continue;
    }
    const tmp02 = tmp0.slice(6).trim();
    if (tmp02 === "[DONE]") {
      tmp1.push({
        done: true,
        type: "done",
        data: null
      });
      continue;
    }
    try {
      const tmp03 = JSON.parse(tmp02);
      const tmp12 = {
        done: false,
        type: tmp03.type || "",
        data: tmp03
      };
      tmp1.push(tmp12);
    } catch {}
  }
  return tmp1;
}
export class OpenAIStreamProcessor {
  constructor(tmp0, tmp1, tmp2 = null) {
    this._messageId = tmp0;
    this._modelUid = tmp1;
    this._targetId = tmp2;
    this._tokenCount = 0;
    this._done = false;
    this._stopReason = null;
    this._toolCalls = {};
    this._itemTypes = {};
    this._itemPhases = {};
    this._pendingText = "";
    this._capturingToolText = false;
    this._capturedToolText = "";
    this._errorMessage = null;
    this._allowedTools = null;
  }
  setAllowedTools(tmp0) {
    this._allowedTools = new Set(tmp0);
  }
  get isDone() {
    return this._done;
  }
  get stopReason() {
    return this._stopReason;
  }
  processEvent(tmp0) {
    if (tmp0.done) {
      return this._onDone();
    }
    const {
      type: tmp1,
      data: tmp2
    } = tmp0;
    const tmp3 = [];
    switch (tmp1) {
      case "response.reasoning.delta":
        if (tmp2.delta) {
          tmp3.push(buildThinkingDelta(this._messageId, tmp2.delta));
        }
        break;
      case "response.reasoning_summary_text.delta":
        if (tmp2.delta) {
          tmp3.push(buildThinkingDelta(this._messageId, tmp2.delta));
        }
        break;
      case "response.output_text.delta":
        if (tmp2.delta) {
          const tmp02 = tmp2.output_index ?? 0;
          const tmp12 = this._itemTypes[tmp02];
          const tmp22 = this._itemPhases[tmp02];
          if (tmp12 === "reasoning" || tmp22 === "thinking") {
            tmp3.push(buildThinkingDelta(this._messageId, tmp2.delta));
          } else {
            this._handleOutputTextDelta(tmp2.delta, tmp3);
          }
        }
        break;
      case "response.output_item.added":
        {
          const tmp02 = tmp2.item;
          const tmp12 = tmp2.output_index ?? 0;
          if (tmp02) {
            this._itemTypes[tmp12] = tmp02.type;
            if (tmp02.phase) {
              this._itemPhases[tmp12] = tmp02.phase;
            }
          }
          if (tmp02?.type === "function_call") {
            const tmp03 = {
              id: tmp02.call_id || tmp02.id || "",
              name: tmp02.name || "",
              arguments: ""
            };
            this._toolCalls[tmp12] = tmp03;
          }
          break;
        }
      case "response.function_call_arguments.delta":
        {
          const tmp02 = tmp2.output_index ?? 0;
          if (this._toolCalls[tmp02]) {
            this._toolCalls[tmp02].arguments += tmp2.delta || "";
          }
          break;
        }
      case "response.completed":
        {
          const tmp02 = tmp2.response;
          if (tmp02?.status === "completed") {
            this._stopReason = "stop";
            const tmp03 = tmp02.output?.some(arg0 => arg0.type === "function_call");
            if (tmp03) {
              this._stopReason = "tool_calls";
            }
          }
          return this._onDone();
        }
      case "response.incomplete":
        {
          const tmp02 = tmp2.response;
          this._stopReason = this._mapIncompleteReason(tmp02?.incomplete_details?.reason);
          return this._onDone();
        }
      case "response.failed":
        {
          const tmp02 = tmp2.response;
          const tmp12 = tmp02?.error || tmp2.error;
          this._stopReason = "error";
          this._errorMessage = tmp12?.message || "OpenAI response failed";
          return this._onDone();
        }
      case "response.created":
      case "response.in_progress":
      case "response.output_item.done":
      case "response.content_part.added":
      case "response.content_part.done":
      case "response.reasoning_summary_part.added":
      case "response.reasoning_summary_part.done":
      case "response.reasoning_summary_text.done":
      case "codex.rate_limits":
        break;
      default:
        if (tmp1 && !tmp1.startsWith("response.")) {
          console.log("  ℹ️  Unknown OpenAI event: " + tmp1);
        }
        break;
    }
    return tmp3;
  }
  _onDone() {
    if (this._done) {
      return [];
    }
    const tmp0 = [];
    const tmp1 = [];
    if (this._errorMessage) {
      this._restoreInterceptedText(tmp0);
      tmp0.push(buildErrorChunk(this._messageId, "[OpenAI Error] " + this._errorMessage));
      this._done = true;
      return tmp0;
    }
    const tmp2 = Object.keys(this._toolCalls);
    if (tmp2.length > 0) {
      this._flushBufferedText(tmp0, true);
      const tmp02 = tmp2.sort((arg0, arg1) => Number(arg0) - Number(arg1)).map(arg0 => {
        const tmp12 = this._toolCalls[arg0];
        const tmp22 = normalizeToolInvocation(tmp12.name, tmp12.arguments);
        const tmp32 = tmp12.arguments ? tmp12.arguments.length : 0;
        console.log("  🔧 OpenAI native tool_call idx=" + arg0 + " id=" + (tmp12.id || "(empty)") + " raw=" + (tmp12.name || "(empty)") + " normalized=" + (tmp22.toolName || "(empty)") + " args=" + tmp32 + "b");
        if (!tmp22.toolName) {
          return null;
        }
        return {
          id: tmp12.id,
          name: tmp22.toolName,
          arguments_json: JSON.stringify(tmp22.params ?? {})
        };
      }).filter(Boolean).map(arg0 => {
        if (this._allowedTools && !this._allowedTools.has(arg0.name)) {
          const tmp03 = [...this._allowedTools].find(arg02 => arg02 === arg0.name.toLowerCase() || arg0.name.toLowerCase().includes(arg02) || arg02.includes(arg0.name.toLowerCase()));
          if (tmp03) {
            console.log("  🔧 Auto-corrected tool name: " + arg0.name + " → " + tmp03);
            arg0.name = tmp03;
          } else {
            console.log("  ⚠️  Unknown tool: " + arg0.name + " (not in allowed list, passing through anyway)");
          }
        }
        return arg0;
      });
      if (tmp02.length > 0) {
        tmp1.push(...tmp02);
        tmp0.push(buildToolCallDelta(this._messageId, tmp02));
        this._stopReason = "tool_calls";
      } else {
        console.log("  ⚠️  All tool calls filtered out — falling back to text output");
        this._restoreInterceptedText(tmp0);
      }
    } else {
      const tmp02 = "" + this._capturedToolText + this._pendingText;
      const tmp12 = parseTextToolCalls(tmp02);
      if (tmp12.length > 0) {
        console.log("  🔧 Recovered " + tmp12.length + " tool call(s) from OpenAI text: " + tmp12.map(arg0 => arg0.name).join(", "));
        const tmp03 = tmp12.map((arg0, arg1) => {
          const tmp22 = JSON.stringify(arg0.input ?? {});
          console.log("  🔧 OpenAI text tool_call idx=" + arg1 + " id=tc_recovered_" + arg1 + " name=" + (arg0.name || "(empty)") + " args=" + tmp22.length + "b");
          const tmp32 = {
            id: "tc_recovered_" + arg1,
            name: arg0.name,
            arguments_json: tmp22
          };
          return tmp32;
        });
        tmp1.push(...tmp03);
        tmp0.push(buildToolCallDelta(this._messageId, tmp03));
        this._stopReason = "tool_calls";
      } else {
        this._restoreInterceptedText(tmp0);
      }
    }
    if (!this._stopReason) {
      this._stopReason = "stop";
    }
    if (this._stopReason === "tool_calls" && tmp1.length === 0) {
      console.log("  ⚠️  OpenAI reported stop=tool_calls but no tool calls found — downgrading to stop");
      this._stopReason = "stop";
    }
    const tmp3 = tmp1.map(arg0 => arg0.name).filter(Boolean);
    if (tmp3.length > 0) {
      console.log("  🔧 Tools called: [" + tmp3.join(", ") + "]");
    } else if (this._stopReason === "stop") {
      console.log("  🔧 No tools called (stop: stop)");
    }
    const tmp4 = this._mapStopReason(this._stopReason);
    tmp0.push(buildStopChunk(this._messageId, tmp4, this._modelUid));
    this._done = true;
    if (tmp1.length > 0) {
      for (const tmp02 of tmp1) {
        emitToolCall(tmp02.name, tmp02.arguments_json, tmp02.id, this._targetId);
      }
    }
    emitChatEnd(this._stopReason, tmp3, this._targetId);
    return tmp0;
  }
  _handleOutputTextDelta(tmp0, tmp1) {
    if (this._capturingToolText) {
      this._capturedToolText += tmp0;
      return;
    }
    this._pendingText += tmp0;
    const tmp2 = findToolCallStartIndex(this._pendingText);
    if (tmp2 !== -1) {
      const tmp02 = this._pendingText.slice(0, tmp2);
      if (tmp02) {
        this._emitTextChunk(tmp02, tmp1);
      }
      this._capturedToolText = this._pendingText.slice(tmp2);
      this._pendingText = "";
      this._capturingToolText = true;
      console.log("  🔎 Detected possible OpenAI text tool-call start; intercepting subsequent text");
      return;
    }
    this._flushBufferedText(tmp1, false);
  }
  _flushBufferedText(tmp0, tmp1) {
    const tmp2 = tmp1 ? 0 : Math.min(this._pendingText.length, MAX_TOOL_MARKER_LOOKBEHIND);
    const tmp3 = tmp1 ? this._pendingText : this._pendingText.slice(0, this._pendingText.length - tmp2);
    if (tmp3) {
      this._emitTextChunk(tmp3, tmp0);
      this._pendingText = this._pendingText.slice(tmp3.length);
    }
  }
  _emitTextChunk(tmp0, tmp1) {
    if (!tmp0) {
      return;
    }
    this._tokenCount++;
    tmp1.push(buildTextDelta(this._messageId, tmp0, this._tokenCount));
    emitAIText(tmp0, true, this._targetId);
  }
  _restoreInterceptedText(tmp0) {
    if (this._capturedToolText) {
      this._emitTextChunk(this._capturedToolText, tmp0);
      this._capturedToolText = "";
      this._capturingToolText = false;
    }
    this._flushBufferedText(tmp0, true);
  }
  _mapIncompleteReason(tmp0) {
    switch (tmp0) {
      case "max_output_tokens":
      case "max_tokens":
      case "output_truncated":
        return "length";
      default:
        return "stop";
    }
  }
  _mapStopReason(tmp0) {
    switch (tmp0) {
      case "stop":
        return STOP_REASON.STOP_PATTERN;
      case "tool_calls":
        return STOP_REASON.FUNCTION_CALL;
      case "length":
        return STOP_REASON.MAX_TOKENS;
      case "error":
        return STOP_REASON.ERROR;
      default:
        return STOP_REASON.STOP_PATTERN;
    }
  }
}
export class ChatCompletionsStreamProcessor {
  constructor(tmp0, tmp1, tmp2 = null) {
    this._messageId = tmp0;
    this._modelUid = tmp1;
    this._targetId = tmp2;
    this._tokenCount = 0;
    this._done = false;
    this._stopReason = null;
    this._toolCalls = {};
    this._pendingText = "";
    this._capturingToolText = false;
    this._capturedToolText = "";
    this._errorMessage = null;
    this._allowedTools = null;
  }
  setAllowedTools(tmp0) {
    this._allowedTools = new Set(tmp0);
  }
  get isDone() {
    return this._done;
  }
  get stopReason() {
    return this._stopReason;
  }
  processEvent(tmp0) {
    if (tmp0.done) {
      return this._onDone();
    }
    const tmp1 = tmp0.data;
    const tmp2 = tmp1?.choices?.[0];
    if (!tmp2) {
      if (tmp1?.error?.message) {
        this._errorMessage = tmp1.error.message;
        this._stopReason = "error";
        return this._onDone();
      }
      return [];
    }
    const tmp3 = [];
    const tmp4 = tmp2.delta || {};
    if (tmp4.reasoning_content) {
      tmp3.push(buildThinkingDelta(this._messageId, tmp4.reasoning_content));
    }
    if (tmp4.content) {
      this._handleOutputTextDelta(tmp4.content, tmp3);
    }
    if (Array.isArray(tmp4.tool_calls)) {
      for (const tmp02 of tmp4.tool_calls) {
        const tmp12 = tmp02.index ?? 0;
        if (!this._toolCalls[tmp12]) {
          this._toolCalls[tmp12] = {
            id: tmp02.id || "",
            name: tmp02.function?.name || "",
            arguments: ""
          };
        }
        if (tmp02.id) {
          this._toolCalls[tmp12].id = tmp02.id;
        }
        if (tmp02.function?.name) {
          this._toolCalls[tmp12].name = tmp02.function.name;
        }
        if (tmp02.function?.arguments) {
          this._toolCalls[tmp12].arguments += tmp02.function.arguments;
        }
      }
    }
    if (tmp2.finish_reason) {
      this._stopReason = tmp2.finish_reason;
    }
    return tmp3;
  }
  _onDone() {
    if (this._done) {
      return [];
    }
    const tmp0 = [];
    const tmp1 = [];
    if (this._errorMessage) {
      this._restoreInterceptedText(tmp0);
      tmp0.push(buildErrorChunk(this._messageId, "[OpenAI Error] " + this._errorMessage));
      this._done = true;
      return tmp0;
    }
    const tmp2 = Object.keys(this._toolCalls);
    if (tmp2.length > 0) {
      this._flushBufferedText(tmp0, true);
      const tmp02 = tmp2.sort((arg0, arg1) => Number(arg0) - Number(arg1)).map(arg0 => {
        const tmp12 = this._toolCalls[arg0];
        const tmp22 = normalizeToolInvocation(tmp12.name, tmp12.arguments);
        if (!tmp22.toolName) {
          return null;
        }
        return {
          id: tmp12.id,
          name: tmp22.toolName,
          arguments_json: JSON.stringify(tmp22.params ?? {})
        };
      }).filter(Boolean);
      if (tmp02.length > 0) {
        tmp1.push(...tmp02);
        tmp0.push(buildToolCallDelta(this._messageId, tmp02));
        this._stopReason = "tool_calls";
      } else {
        this._restoreInterceptedText(tmp0);
      }
    } else {
      const tmp02 = "" + this._capturedToolText + this._pendingText;
      const tmp12 = parseTextToolCalls(tmp02);
      if (tmp12.length > 0) {
        const tmp03 = tmp12.map((arg0, arg1) => ({
          id: "tc_recovered_" + arg1,
          name: arg0.name,
          arguments_json: JSON.stringify(arg0.input ?? {})
        }));
        tmp1.push(...tmp03);
        tmp0.push(buildToolCallDelta(this._messageId, tmp03));
        this._stopReason = "tool_calls";
      } else {
        this._restoreInterceptedText(tmp0);
      }
    }
    if (!this._stopReason) {
      this._stopReason = "stop";
    }
    if (this._stopReason === "tool_calls" && tmp1.length === 0) {
      this._stopReason = "stop";
    }
    const tmp3 = tmp1.map(arg0 => arg0.name).filter(Boolean);
    const tmp4 = this._mapStopReason(this._stopReason);
    tmp0.push(buildStopChunk(this._messageId, tmp4, this._modelUid));
    this._done = true;
    if (tmp1.length > 0) {
      for (const tmp02 of tmp1) {
        emitToolCall(tmp02.name, tmp02.arguments_json, tmp02.id, this._targetId);
      }
    }
    emitChatEnd(this._stopReason, tmp3, this._targetId);
    return tmp0;
  }
  _handleOutputTextDelta(tmp0, tmp1) {
    if (this._capturingToolText) {
      this._capturedToolText += tmp0;
      return;
    }
    this._pendingText += tmp0;
    const tmp2 = findToolCallStartIndex(this._pendingText);
    if (tmp2 !== -1) {
      const tmp02 = this._pendingText.slice(0, tmp2);
      if (tmp02) {
        this._emitTextChunk(tmp02, tmp1);
      }
      this._capturedToolText = this._pendingText.slice(tmp2);
      this._pendingText = "";
      this._capturingToolText = true;
      return;
    }
    this._flushBufferedText(tmp1, false);
  }
  _flushBufferedText(tmp0, tmp1) {
    const tmp2 = tmp1 ? 0 : Math.min(this._pendingText.length, MAX_TOOL_MARKER_LOOKBEHIND);
    const tmp3 = tmp1 ? this._pendingText : this._pendingText.slice(0, this._pendingText.length - tmp2);
    if (tmp3) {
      this._emitTextChunk(tmp3, tmp0);
      this._pendingText = this._pendingText.slice(tmp3.length);
    }
  }
  _emitTextChunk(tmp0, tmp1) {
    if (!tmp0) {
      return;
    }
    this._tokenCount++;
    tmp1.push(buildTextDelta(this._messageId, tmp0, this._tokenCount));
    emitAIText(tmp0, true, this._targetId);
  }
  _restoreInterceptedText(tmp0) {
    if (this._capturedToolText) {
      this._emitTextChunk(this._capturedToolText, tmp0);
      this._capturedToolText = "";
      this._capturingToolText = false;
    }
    this._flushBufferedText(tmp0, true);
  }
  _mapStopReason(tmp0) {
    switch (tmp0) {
      case "stop":
        return STOP_REASON.STOP_PATTERN;
      case "tool_calls":
        return STOP_REASON.FUNCTION_CALL;
      case "length":
        return STOP_REASON.MAX_TOKENS;
      case "error":
        return STOP_REASON.ERROR;
      default:
        return STOP_REASON.STOP_PATTERN;
    }
  }
}
