import {
    buildSignatureDelta,
    buildStopChunk,
    buildTextDelta,
    buildThinkingDelta,
    buildToolCallDelta,
    STOP_REASON
} from "./build-response.js";
import {findToolCallStartIndex, MAX_TOOL_MARKER_LOOKBEHIND, parseTextToolCalls} from "./tool-call-parser.js";
import {normalizeToolInvocation} from "./tool-normalization.js";
import {emitAIText, emitChatEnd, emitToolCall} from "../ws-bridge.js";

export function parseSSEChunk(arg0) {
  const tmp1 = [];
  const tmp2 = arg0.split("\n");
  let tmp3 = null;
  let tmp4 = [];
  for (const tmp0 of tmp2) {
    if (tmp0.startsWith("event:")) {
      tmp3 = tmp0.slice(6).trim();
    } else if (tmp0.startsWith("data:")) {
      tmp4.push(tmp0.slice(5).trim());
    } else if (tmp0 === "" && tmp3 !== null) {
      const tmp02 = tmp4.join("\n");
      try {
        tmp1.push({
          event: tmp3,
          data: JSON.parse(tmp02)
        });
      } catch {
        const tmp03 = {
          event: tmp3,
          data: tmp02
        };
        tmp1.push(tmp03);
      }
      tmp3 = null;
      tmp4 = [];
    }
  }
  if (tmp3 !== null && tmp4.length > 0) {
    const tmp02 = tmp4.join("\n");
    try {
      tmp1.push({
        event: tmp3,
        data: JSON.parse(tmp02)
      });
    } catch {
      tmp1.push({
        event: tmp3,
        data: tmp02
      });
    }
  }
  return tmp1;
}

export class AnthropicStreamProcessor {
    constructor(tmp0, tmp1, tmp2 = null) {
        this._messageId = tmp0;
        this._modelUid = tmp1;
        this._targetId = tmp2;
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

    processEvent(tmp0) {
        const {
            event: tmp1,
            data: tmp2
        } = tmp0;
        const tmp3 = [];
        switch (tmp1) {
            case "content_block_start":
                this._onContentBlockStart(tmp2, tmp3);
                break;
            case "content_block_delta":
                this._onContentBlockDelta(tmp2, tmp3);
                break;
            case "content_block_stop":
                this._onContentBlockStop(tmp2, tmp3);
                break;
            case "message_delta":
                if (tmp2?.delta?.stop_reason) {
                    this._stopReason = tmp2.delta.stop_reason;
                }
                break;
            case "message_stop":
                this._onMessageStop(tmp3);
                break;
            case "ping":
                break;
            default:
                break;
        }
        return tmp3;
    }

    get isDone() {
        return this._done;
    }

    get stopReason() {
        return this._stopReason;
    }

    _onContentBlockStart(tmp0, tmp1) {
        const tmp2 = tmp0?.content_block;
        if (!tmp2) {
            return;
        }
        this._currentBlockType = tmp2.type;
        this._currentBlockIndex = tmp0?.index ?? -1;
        if (tmp2.type === "tool_use") {
            this._toolId = tmp2.id ?? null;
            this._toolName = tmp2.name ?? null;
            this._toolArgsBuffer = "";
        } else if (tmp2.type === "thinking") {
            this._signatureBuffer = "";
        }
    }

    _onContentBlockDelta(tmp0, tmp1) {
        const tmp2 = tmp0?.delta;
        if (!tmp2) {
            return;
        }
        if (tmp2.type === "text_delta" && tmp2.text) {
            this._handleTextDelta(tmp2.text, tmp1);
        } else if (tmp2.type === "thinking_delta" && tmp2.thinking) {
            tmp1.push(buildThinkingDelta(this._messageId, tmp2.thinking));
        } else if (tmp2.type === "input_json_delta" && tmp2.partial_json != null) {
            this._toolArgsBuffer += tmp2.partial_json;
        } else if (tmp2.type === "signature_delta" && tmp2.signature != null) {
            this._signatureBuffer += tmp2.signature;
        }
    }

    _onContentBlockStop(tmp0, tmp1) {
        if (this._currentBlockType === "text") {
            this._flushBufferedText(tmp1, true);
        } else if (this._currentBlockType === "tool_use") {
            const tmp02 = normalizeToolInvocation(this._toolName ?? "", this._toolArgsBuffer);
            if (!tmp02.toolName) {
                this._restoreInterceptedText(tmp1);
                this._toolId = null;
                this._toolName = null;
                this._toolArgsBuffer = "";
                return;
            }
            const tmp12 = {
                id: this._toolId ?? "",
                name: tmp02.toolName,
                arguments_json: JSON.stringify(tmp02.params ?? {})
            };
            tmp1.push(buildToolCallDelta(this._messageId, [tmp12]));
            emitToolCall(tmp12.name, tmp12.arguments_json, tmp12.id, this._targetId);
            this._emittedToolCall = true;
            this._toolId = null;
            this._toolName = null;
            this._toolArgsBuffer = "";
        } else if (this._currentBlockType === "thinking" && this._signatureBuffer) {
            tmp1.push(buildSignatureDelta(this._messageId, this._signatureBuffer));
            this._signatureBuffer = "";
        }
        this._currentBlockType = null;
        this._currentBlockIndex = -1;
    }

    _onMessageStop(tmp0) {
        if (!this._emittedToolCall) {
            const tmp02 = "" + this._capturedToolText + this._pendingText;
            const tmp12 = parseTextToolCalls(tmp02);
            if (tmp12.length > 0) {
                console.log("  🔧 Recovered " + tmp12.length + " tool call(s) from Anthropic text: " + tmp12.map(arg0 => arg0.name).join(", "));
                const tmp03 = tmp12.map((arg0, arg1) => ({
                    id: "tc_recovered_" + arg1,
                    name: arg0.name,
                    arguments_json: JSON.stringify(arg0.input ?? {})
                }));
                tmp0.push(buildToolCallDelta(this._messageId, tmp03));
                for (const tmp04 of tmp03) {
                    emitToolCall(tmp04.name, tmp04.arguments_json, tmp04.id, this._targetId);
                }
                this._stopReason = "tool_use";
            } else {
                this._restoreInterceptedText(tmp0);
            }
        } else {
            this._flushBufferedText(tmp0, true);
        }
        const tmp1 = this._mapStopReason(this._stopReason);
        tmp0.push(buildStopChunk(this._messageId, tmp1, this._modelUid));
        emitChatEnd(this._stopReason, [], this._targetId);
        this._done = true;
    }

    _handleTextDelta(tmp0, tmp1) {
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
            console.log("  🔎 Detected possible Anthropic text tool-call start; intercepting subsequent text");
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
