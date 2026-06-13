import { writeStringField, writeVarintField, writeMessageField, writeFixed64Field } from "../proto.js";
export const STOP_REASON = {
  UNSPECIFIED: 0,
  INCOMPLETE: 1,
  STOP_PATTERN: 2,
  MAX_TOKENS: 3,
  FUNCTION_CALL: 10,
  ERROR: 13
};
function buildTimestamp() {
  const tmp0 = Date.now();
  const tmp1 = Math.floor(tmp0 / 1000);
  const tmp2 = tmp0 % 1000 * 1000000;
  return Buffer.concat([writeVarintField(1, tmp1), writeVarintField(2, tmp2)]);
}
function writeDoubleField(arg0, arg1) {
  const tmp2 = Buffer.alloc(8);
  tmp2.writeDoubleBE(arg1, 0);
  tmp2.swap64();
  return writeFixed64Field(arg0, tmp2);
}
export function buildTextDelta(arg0, arg1, arg2) {
  const tmp3 = [writeStringField(1, arg0), writeMessageField(2, buildTimestamp())];
  if (arg1) {
    tmp3.push(writeStringField(3, arg1));
  }
  if (arg2 > 0) {
    tmp3.push(writeVarintField(4, arg2));
  }
  return Buffer.concat(tmp3);
}
export function buildThinkingDelta(arg0, arg1) {
  return Buffer.concat([writeStringField(1, arg0), writeMessageField(2, buildTimestamp()), writeStringField(9, arg1)]);
}
export function buildToolCallDelta(arg0, arg1) {
  const tmp2 = [writeStringField(1, arg0), writeMessageField(2, buildTimestamp())];
  for (const tmp0 of arg1) {
    const tmp02 = Buffer.concat([writeStringField(1, tmp0.id ?? ""), writeStringField(2, tmp0.name ?? ""), writeStringField(3, tmp0.arguments_json ?? "")]);
    tmp2.push(writeMessageField(6, tmp02));
  }
  return Buffer.concat(tmp2);
}
export function buildStopChunk(arg0, arg1, arg2, arg3) {
  const tmp4 = [writeStringField(1, arg0), writeMessageField(2, buildTimestamp()), writeVarintField(5, arg1)];
  if (arg3 !== undefined && arg3 !== null) {
    tmp4.push(writeDoubleField(12, arg3));
  }
  if (arg2) {
    tmp4.push(writeStringField(20, arg2));
  }
  return Buffer.concat(tmp4);
}
export function buildSignatureDelta(arg0, arg1) {
  return Buffer.concat([writeStringField(1, arg0), writeMessageField(2, buildTimestamp()), writeStringField(10, arg1)]);
}
export function buildErrorChunk(arg0, arg1) {
  return Buffer.concat([writeStringField(1, arg0), writeMessageField(2, buildTimestamp()), writeStringField(3, arg1), writeVarintField(5, STOP_REASON.ERROR)]);
}
