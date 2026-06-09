import { emitAIText, emitToolCall, emitChatEnd } from "../ws-bridge.js";
import { buildTextDelta, buildThinkingDelta, buildToolCallDelta, buildStopChunk, buildErrorChunk, STOP_REASON } from "./build-response.js";
import { MAX_TOOL_MARKER_LOOKBEHIND, findToolCallStartIndex, parseTextToolCalls } from "./tool-call-parser.js";
import { normalizeToolInvocation } from "./tool-normalization.js";
export function parseOpenAISSEChunk(_0x2cbfde) {
  const _0x231702 = [];
  const _0xba16bc = _0x2cbfde.split("\n");
  for (const _0x51aeab of _0xba16bc) {
    if (!_0x51aeab.startsWith("data: ")) {
      continue;
    }
    const _0x54f7a8 = _0x51aeab.slice(6).trim();
    if (_0x54f7a8 === "[DONE]") {
      _0x231702.push({
        done: true,
        type: "done",
        data: null
      });
      continue;
    }
    try {
      const _0x28e839 = JSON.parse(_0x54f7a8);
      const _0x35bd4e = {
        done: false,
        type: _0x28e839.type || "",
        data: _0x28e839
      };
      _0x231702.push(_0x35bd4e);
    } catch {}
  }
  return _0x231702;
}
export class OpenAIStreamProcessor {
  constructor(_0x27710b, _0x36b7a6, _0x4a1c16 = null) {
    this._messageId = _0x27710b;
    this._modelUid = _0x36b7a6;
    this._targetId = _0x4a1c16;
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
  setAllowedTools(_0x5b3fd6) {
    this._allowedTools = new Set(_0x5b3fd6);
  }
  get isDone() {
    return this._done;
  }
  get stopReason() {
    return this._stopReason;
  }
  processEvent(_0x1cc88d) {
    if (_0x1cc88d.done) {
      return this._onDone();
    }
    const {
      type: _0x40f576,
      data: _0x421484
    } = _0x1cc88d;
    const _0x3d34ef = [];
    switch (_0x40f576) {
      case "response.reasoning.delta":
        if (_0x421484.delta) {
          _0x3d34ef.push(buildThinkingDelta(this._messageId, _0x421484.delta));
        }
        break;
      case "response.reasoning_summary_text.delta":
        if (_0x421484.delta) {
          _0x3d34ef.push(buildThinkingDelta(this._messageId, _0x421484.delta));
        }
        break;
      case "response.output_text.delta":
        if (_0x421484.delta) {
          const _0x398231 = _0x421484.output_index ?? 0;
          const _0xe3fbf4 = this._itemTypes[_0x398231];
          const _0x2235c0 = this._itemPhases[_0x398231];
          if (_0xe3fbf4 === "reasoning" || _0x2235c0 === "thinking") {
            _0x3d34ef.push(buildThinkingDelta(this._messageId, _0x421484.delta));
          } else {
            this._handleOutputTextDelta(_0x421484.delta, _0x3d34ef);
          }
        }
        break;
      case "response.output_item.added":
        {
          const _0x497be2 = _0x421484.item;
          const _0x28344c = _0x421484.output_index ?? 0;
          if (_0x497be2) {
            this._itemTypes[_0x28344c] = _0x497be2.type;
            if (_0x497be2.phase) {
              this._itemPhases[_0x28344c] = _0x497be2.phase;
            }
          }
          if (_0x497be2?.type === "function_call") {
            const _0x1a4f48 = {
              id: _0x497be2.call_id || _0x497be2.id || "",
              name: _0x497be2.name || "",
              arguments: ""
            };
            this._toolCalls[_0x28344c] = _0x1a4f48;
          }
          break;
        }
      case "response.function_call_arguments.delta":
        {
          const _0x219d66 = _0x421484.output_index ?? 0;
          if (this._toolCalls[_0x219d66]) {
            this._toolCalls[_0x219d66].arguments += _0x421484.delta || "";
          }
          break;
        }
      case "response.completed":
        {
          const _0x20dcbe = _0x421484.response;
          if (_0x20dcbe?.status === "completed") {
            this._stopReason = "stop";
            const _0x2d3b9d = _0x20dcbe.output?.some(_0x30aa16 => _0x30aa16.type === "function_call");
            if (_0x2d3b9d) {
              this._stopReason = "tool_calls";
            }
          }
          return this._onDone();
        }
      case "response.incomplete":
        {
          const _0x516c7d = _0x421484.response;
          this._stopReason = this._mapIncompleteReason(_0x516c7d?.incomplete_details?.reason);
          return this._onDone();
        }
      case "response.failed":
        {
          const _0x48007c = _0x421484.response;
          const _0x4f166f = _0x48007c?.error || _0x421484.error;
          this._stopReason = "error";
          this._errorMessage = _0x4f166f?.message || "OpenAI response failed";
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
        if (_0x40f576 && !_0x40f576.startsWith("response.")) {
          console.log("  ℹ️  Unknown OpenAI event: " + _0x40f576);
        }
        break;
    }
    return _0x3d34ef;
  }
  _onDone() {
    if (this._done) {
      return [];
    }
    const _0x450869 = [];
    const _0x169442 = [];
    if (this._errorMessage) {
      this._restoreInterceptedText(_0x450869);
      _0x450869.push(buildErrorChunk(this._messageId, "[OpenAI Error] " + this._errorMessage));
      this._done = true;
      return _0x450869;
    }
    const _0x266d28 = Object.keys(this._toolCalls);
    if (_0x266d28.length > 0) {
      this._flushBufferedText(_0x450869, true);
      const _0x15b6c1 = _0x266d28.sort((_0x472fd2, _0x5d8dcf) => Number(_0x472fd2) - Number(_0x5d8dcf)).map(_0x46683f => {
        const _0x4ce0f6 = this._toolCalls[_0x46683f];
        const _0x168585 = normalizeToolInvocation(_0x4ce0f6.name, _0x4ce0f6.arguments);
        const _0x422075 = _0x4ce0f6.arguments ? _0x4ce0f6.arguments.length : 0;
        console.log("  🔧 OpenAI native tool_call idx=" + _0x46683f + " id=" + (_0x4ce0f6.id || "(empty)") + " raw=" + (_0x4ce0f6.name || "(empty)") + " normalized=" + (_0x168585.toolName || "(empty)") + " args=" + _0x422075 + "b");
        if (!_0x168585.toolName) {
          return null;
        }
        return {
          id: _0x4ce0f6.id,
          name: _0x168585.toolName,
          arguments_json: JSON.stringify(_0x168585.params ?? {})
        };
      }).filter(Boolean).map(_0x5b1cd3 => {
        if (this._allowedTools && !this._allowedTools.has(_0x5b1cd3.name)) {
          const _0x18519a = [...this._allowedTools].find(_0x4a0e84 => _0x4a0e84 === _0x5b1cd3.name.toLowerCase() || _0x5b1cd3.name.toLowerCase().includes(_0x4a0e84) || _0x4a0e84.includes(_0x5b1cd3.name.toLowerCase()));
          if (_0x18519a) {
            console.log("  🔧 Auto-corrected tool name: " + _0x5b1cd3.name + " → " + _0x18519a);
            _0x5b1cd3.name = _0x18519a;
          } else {
            console.log("  ⚠️  Unknown tool: " + _0x5b1cd3.name + " (not in allowed list, passing through anyway)");
          }
        }
        return _0x5b1cd3;
      });
      if (_0x15b6c1.length > 0) {
        _0x169442.push(..._0x15b6c1);
        _0x450869.push(buildToolCallDelta(this._messageId, _0x15b6c1));
        this._stopReason = "tool_calls";
      } else {
        console.log("  ⚠️  All tool calls filtered out — falling back to text output");
        this._restoreInterceptedText(_0x450869);
      }
    } else {
      const _0x386749 = "" + this._capturedToolText + this._pendingText;
      const _0x5d4d56 = parseTextToolCalls(_0x386749);
      if (_0x5d4d56.length > 0) {
        console.log("  🔧 Recovered " + _0x5d4d56.length + " tool call(s) from OpenAI text: " + _0x5d4d56.map(_0x1c2508 => _0x1c2508.name).join(", "));
        const _0x166e61 = _0x5d4d56.map((_0x276f84, _0x3fc2e5) => {
          const _0x39403c = JSON.stringify(_0x276f84.input ?? {});
          console.log("  🔧 OpenAI text tool_call idx=" + _0x3fc2e5 + " id=tc_recovered_" + _0x3fc2e5 + " name=" + (_0x276f84.name || "(empty)") + " args=" + _0x39403c.length + "b");
          const _0x47c074 = {
            id: "tc_recovered_" + _0x3fc2e5,
            name: _0x276f84.name,
            arguments_json: _0x39403c
          };
          return _0x47c074;
        });
        _0x169442.push(..._0x166e61);
        _0x450869.push(buildToolCallDelta(this._messageId, _0x166e61));
        this._stopReason = "tool_calls";
      } else {
        this._restoreInterceptedText(_0x450869);
      }
    }
    if (!this._stopReason) {
      this._stopReason = "stop";
    }
    if (this._stopReason === "tool_calls" && _0x169442.length === 0) {
      console.log("  ⚠️  OpenAI reported stop=tool_calls but no tool calls found — downgrading to stop");
      this._stopReason = "stop";
    }
    const _0x94ff2a = _0x169442.map(_0x2b2668 => _0x2b2668.name).filter(Boolean);
    if (_0x94ff2a.length > 0) {
      console.log("  🔧 Tools called: [" + _0x94ff2a.join(", ") + "]");
    } else if (this._stopReason === "stop") {
      console.log("  🔧 No tools called (stop: stop)");
    }
    const _0xd847a0 = this._mapStopReason(this._stopReason);
    _0x450869.push(buildStopChunk(this._messageId, _0xd847a0, this._modelUid));
    this._done = true;
    if (_0x169442.length > 0) {
      for (const _0xbd6aa of _0x169442) {
        emitToolCall(_0xbd6aa.name, _0xbd6aa.arguments_json, _0xbd6aa.id, this._targetId);
      }
    }
    emitChatEnd(this._stopReason, _0x94ff2a, this._targetId);
    return _0x450869;
  }
  _handleOutputTextDelta(_0x21708a, _0x45fa4f) {
    if (this._capturingToolText) {
      this._capturedToolText += _0x21708a;
      return;
    }
    this._pendingText += _0x21708a;
    const _0x212835 = findToolCallStartIndex(this._pendingText);
    if (_0x212835 !== -1) {
      const _0x33285b = this._pendingText.slice(0, _0x212835);
      if (_0x33285b) {
        this._emitTextChunk(_0x33285b, _0x45fa4f);
      }
      this._capturedToolText = this._pendingText.slice(_0x212835);
      this._pendingText = "";
      this._capturingToolText = true;
      console.log("  🔎 Detected possible OpenAI text tool-call start; intercepting subsequent text");
      return;
    }
    this._flushBufferedText(_0x45fa4f, false);
  }
  _flushBufferedText(_0x1de52a, _0x10ae19) {
    const _0x5eb29b = _0x10ae19 ? 0 : Math.min(this._pendingText.length, MAX_TOOL_MARKER_LOOKBEHIND);
    const _0x46e294 = _0x10ae19 ? this._pendingText : this._pendingText.slice(0, this._pendingText.length - _0x5eb29b);
    if (_0x46e294) {
      this._emitTextChunk(_0x46e294, _0x1de52a);
      this._pendingText = this._pendingText.slice(_0x46e294.length);
    }
  }
  _emitTextChunk(_0xfecbc6, _0x458ae6) {
    if (!_0xfecbc6) {
      return;
    }
    this._tokenCount++;
    _0x458ae6.push(buildTextDelta(this._messageId, _0xfecbc6, this._tokenCount));
    emitAIText(_0xfecbc6, true, this._targetId);
  }
  _restoreInterceptedText(_0x30f029) {
    if (this._capturedToolText) {
      this._emitTextChunk(this._capturedToolText, _0x30f029);
      this._capturedToolText = "";
      this._capturingToolText = false;
    }
    this._flushBufferedText(_0x30f029, true);
  }
  _mapIncompleteReason(_0x1e54dc) {
    switch (_0x1e54dc) {
      case "max_output_tokens":
      case "max_tokens":
      case "output_truncated":
        return "length";
      default:
        return "stop";
    }
  }
  _mapStopReason(_0xd0de85) {
    switch (_0xd0de85) {
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
