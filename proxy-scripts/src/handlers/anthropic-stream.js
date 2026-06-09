import { buildTextDelta, buildThinkingDelta, buildToolCallDelta, buildSignatureDelta, buildStopChunk, STOP_REASON } from "./build-response.js";
import { MAX_TOOL_MARKER_LOOKBEHIND, findToolCallStartIndex, parseTextToolCalls } from "./tool-call-parser.js";
import { normalizeToolInvocation } from "./tool-normalization.js";
import { emitAIText, emitToolCall, emitChatEnd } from "../ws-bridge.js";
export function parseSSEChunk(_0x4a3993) {
  const _0x5d2a56 = [];
  const _0x1a4cc3 = _0x4a3993.split("\n");
  let _0x5aabf6 = null;
  let _0x2bc71a = [];
  for (const _0x357419 of _0x1a4cc3) {
    if (_0x357419.startsWith("event: ")) {
      _0x5aabf6 = _0x357419.slice(7).trim();
    } else if (_0x357419.startsWith("data: ")) {
      _0x2bc71a.push(_0x357419.slice(6));
    } else if (_0x357419.startsWith("data:")) {
      _0x2bc71a.push(_0x357419.slice(5));
    } else if (_0x357419 === "" && _0x5aabf6 !== null) {
      const _0xe7d3b4 = _0x2bc71a.join("\n");
      try {
        _0x5d2a56.push({
          event: _0x5aabf6,
          data: JSON.parse(_0xe7d3b4)
        });
      } catch {
        const _0x11a91d = {
          event: _0x5aabf6,
          data: _0xe7d3b4
        };
        _0x5d2a56.push(_0x11a91d);
      }
      _0x5aabf6 = null;
      _0x2bc71a = [];
    }
  }
  return _0x5d2a56;
}
export class AnthropicStreamProcessor {
  constructor(_0x5a3e7a, _0x43338b, _0x46dcf1 = null) {
    this._messageId = _0x5a3e7a;
    this._modelUid = _0x43338b;
    this._targetId = _0x46dcf1;
    this._tokenCount = 0;
    this._done = false;
    this._stopReason = null;
    this._currentBlockType = null;
    this._currentBlockIndex = -1;
    this._toolId = null;
    this._toolName = null;
    this._toolArgsBuffer = "";
    this._signatureBuffer = "";
    this._pendingText = "";
    this._capturingToolText = false;
    this._capturedToolText = "";
    this._emittedToolCall = false;
  }
  processEvent(_0x4c8066) {
    const {
      event: _0x3786b6,
      data: _0x2e914e
    } = _0x4c8066;
    const _0x11f198 = [];
    switch (_0x3786b6) {
      case "content_block_start":
        this._onContentBlockStart(_0x2e914e, _0x11f198);
        break;
      case "content_block_delta":
        this._onContentBlockDelta(_0x2e914e, _0x11f198);
        break;
      case "content_block_stop":
        this._onContentBlockStop(_0x2e914e, _0x11f198);
        break;
      case "message_delta":
        if (_0x2e914e?.delta?.stop_reason) {
          this._stopReason = _0x2e914e.delta.stop_reason;
        }
        break;
      case "message_stop":
        this._onMessageStop(_0x11f198);
        break;
      default:
        break;
    }
    return _0x11f198;
  }
  get isDone() {
    return this._done;
  }
  get stopReason() {
    return this._stopReason;
  }
  _onContentBlockStart(_0x5170d5, _0x3fad87) {
    const _0x25b80e = _0x5170d5?.content_block;
    if (!_0x25b80e) {
      return;
    }
    this._currentBlockType = _0x25b80e.type;
    this._currentBlockIndex = _0x5170d5?.index ?? -1;
    if (_0x25b80e.type === "tool_use") {
      this._toolId = _0x25b80e.id ?? null;
      this._toolName = _0x25b80e.name ?? null;
      this._toolArgsBuffer = "";
    } else if (_0x25b80e.type === "thinking") {
      this._signatureBuffer = "";
    }
  }
  _onContentBlockDelta(_0x1b994b, _0x10d71f) {
    const _0x46585d = _0x1b994b?.delta;
    if (!_0x46585d) {
      return;
    }
    if (_0x46585d.type === "text_delta" && _0x46585d.text) {
      this._handleTextDelta(_0x46585d.text, _0x10d71f);
    } else if (_0x46585d.type === "thinking_delta" && _0x46585d.thinking) {
      _0x10d71f.push(buildThinkingDelta(this._messageId, _0x46585d.thinking));
    } else if (_0x46585d.type === "input_json_delta" && _0x46585d.partial_json != null) {
      this._toolArgsBuffer += _0x46585d.partial_json;
    } else if (_0x46585d.type === "signature_delta" && _0x46585d.signature != null) {
      this._signatureBuffer += _0x46585d.signature;
    }
  }
  _onContentBlockStop(_0x157ad8, _0x3c6850) {
    if (this._currentBlockType === "text") {
      this._flushBufferedText(_0x3c6850, true);
    } else if (this._currentBlockType === "tool_use") {
      const _0x5307cc = normalizeToolInvocation(this._toolName ?? "", this._toolArgsBuffer);
      if (!_0x5307cc.toolName) {
        this._restoreInterceptedText(_0x3c6850);
        this._toolId = null;
        this._toolName = null;
        this._toolArgsBuffer = "";
        return;
      }
      const _0xe2e8e = {
        id: this._toolId ?? "",
        name: _0x5307cc.toolName,
        arguments_json: JSON.stringify(_0x5307cc.params ?? {})
      };
      _0x3c6850.push(buildToolCallDelta(this._messageId, [_0xe2e8e]));
      emitToolCall(_0xe2e8e.name, _0xe2e8e.arguments_json, _0xe2e8e.id, this._targetId);
      this._emittedToolCall = true;
      this._toolId = null;
      this._toolName = null;
      this._toolArgsBuffer = "";
    } else if (this._currentBlockType === "thinking" && this._signatureBuffer) {
      _0x3c6850.push(buildSignatureDelta(this._messageId, this._signatureBuffer));
      this._signatureBuffer = "";
    }
    this._currentBlockType = null;
    this._currentBlockIndex = -1;
  }
  _onMessageStop(_0x3429a7) {
    if (!this._emittedToolCall) {
      const _0x743f06 = "" + this._capturedToolText + this._pendingText;
      const _0x539291 = parseTextToolCalls(_0x743f06);
      if (_0x539291.length > 0) {
        console.log("  🔧 Recovered " + _0x539291.length + " tool call(s) from Anthropic text: " + _0x539291.map(_0x1dca50 => _0x1dca50.name).join(", "));
        const _0x13020e = _0x539291.map((_0x352a73, _0xc2c3cd) => ({
          id: "tc_recovered_" + _0xc2c3cd,
          name: _0x352a73.name,
          arguments_json: JSON.stringify(_0x352a73.input ?? {})
        }));
        _0x3429a7.push(buildToolCallDelta(this._messageId, _0x13020e));
        for (const _0x33eec0 of _0x13020e) {
          emitToolCall(_0x33eec0.name, _0x33eec0.arguments_json, _0x33eec0.id, this._targetId);
        }
        this._stopReason = "tool_use";
      } else {
        this._restoreInterceptedText(_0x3429a7);
      }
    } else {
      this._flushBufferedText(_0x3429a7, true);
    }
    const _0x102498 = this._mapStopReason(this._stopReason);
    _0x3429a7.push(buildStopChunk(this._messageId, _0x102498, this._modelUid));
    emitChatEnd(this._stopReason, [], this._targetId);
    this._done = true;
  }
  _handleTextDelta(_0x174ca0, _0x5dddb6) {
    if (this._capturingToolText) {
      this._capturedToolText += _0x174ca0;
      return;
    }
    this._pendingText += _0x174ca0;
    const _0x257a74 = findToolCallStartIndex(this._pendingText);
    if (_0x257a74 !== -1) {
      const _0x32e44e = this._pendingText.slice(0, _0x257a74);
      if (_0x32e44e) {
        this._emitTextChunk(_0x32e44e, _0x5dddb6);
      }
      this._capturedToolText = this._pendingText.slice(_0x257a74);
      this._pendingText = "";
      this._capturingToolText = true;
      console.log("  🔎 Detected possible Anthropic text tool-call start; intercepting subsequent text");
      return;
    }
    this._flushBufferedText(_0x5dddb6, false);
  }
  _flushBufferedText(_0x4dcdd4, _0x501c5c) {
    const _0xeacab4 = _0x501c5c ? 0 : Math.min(this._pendingText.length, MAX_TOOL_MARKER_LOOKBEHIND);
    const _0x23d732 = _0x501c5c ? this._pendingText : this._pendingText.slice(0, this._pendingText.length - _0xeacab4);
    if (_0x23d732) {
      this._emitTextChunk(_0x23d732, _0x4dcdd4);
      this._pendingText = this._pendingText.slice(_0x23d732.length);
    }
  }
  _emitTextChunk(_0x20dc5e, _0x35b74a) {
    if (!_0x20dc5e) {
      return;
    }
    this._tokenCount++;
    _0x35b74a.push(buildTextDelta(this._messageId, _0x20dc5e, this._tokenCount));
    emitAIText(_0x20dc5e, true, this._targetId);
  }
  _restoreInterceptedText(_0x28a315) {
    if (this._capturedToolText) {
      this._emitTextChunk(this._capturedToolText, _0x28a315);
      this._capturedToolText = "";
      this._capturingToolText = false;
    }
    this._flushBufferedText(_0x28a315, true);
  }
  _mapStopReason(_0x4a01a4) {
    switch (_0x4a01a4) {
      case "end_turn":
        return STOP_REASON.STOP_PATTERN;
      case "tool_use":
        return STOP_REASON.FUNCTION_CALL;
      case "max_tokens":
        return STOP_REASON.MAX_TOKENS;
      default:
        return STOP_REASON.STOP_PATTERN;
    }
  }
}
