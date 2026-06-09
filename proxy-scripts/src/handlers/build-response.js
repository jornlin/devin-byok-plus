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
  const _0x23b200 = Date.now();
  const _0x36818e = Math.floor(_0x23b200 / 1000);
  const _0x261f94 = _0x23b200 % 1000 * 1000000;
  return Buffer.concat([writeVarintField(1, _0x36818e), writeVarintField(2, _0x261f94)]);
}
function writeDoubleField(_0x21617e, _0xb2fffe) {
  const _0x2f233a = Buffer.alloc(8);
  _0x2f233a.writeDoubleBE(_0xb2fffe, 0);
  _0x2f233a.swap64();
  return writeFixed64Field(_0x21617e, _0x2f233a);
}
export function buildTextDelta(_0x5aabe7, _0x2febf4, _0x45fde0) {
  const _0x1a56af = [writeStringField(1, _0x5aabe7), writeMessageField(2, buildTimestamp())];
  if (_0x2febf4) {
    _0x1a56af.push(writeStringField(3, _0x2febf4));
  }
  if (_0x45fde0 > 0) {
    _0x1a56af.push(writeVarintField(4, _0x45fde0));
  }
  return Buffer.concat(_0x1a56af);
}
export function buildThinkingDelta(_0xf99857, _0x27e505) {
  return Buffer.concat([writeStringField(1, _0xf99857), writeMessageField(2, buildTimestamp()), writeStringField(9, _0x27e505)]);
}
export function buildToolCallDelta(_0x1c5c00, _0x33ed5e) {
  const _0xdc046b = [writeStringField(1, _0x1c5c00), writeMessageField(2, buildTimestamp())];
  for (const _0x3c31f4 of _0x33ed5e) {
    const _0xb0102b = Buffer.concat([writeStringField(1, _0x3c31f4.id ?? ""), writeStringField(2, _0x3c31f4.name ?? ""), writeStringField(3, _0x3c31f4.arguments_json ?? "")]);
    _0xdc046b.push(writeMessageField(6, _0xb0102b));
  }
  return Buffer.concat(_0xdc046b);
}
export function buildStopChunk(_0x1bd62b, _0x3c5d29, _0x41b251, _0xfcc60f) {
  const _0x378f71 = [writeStringField(1, _0x1bd62b), writeMessageField(2, buildTimestamp()), writeVarintField(5, _0x3c5d29)];
  if (_0xfcc60f !== undefined && _0xfcc60f !== null) {
    _0x378f71.push(writeDoubleField(12, _0xfcc60f));
  }
  if (_0x41b251) {
    _0x378f71.push(writeStringField(20, _0x41b251));
  }
  return Buffer.concat(_0x378f71);
}
export function buildSignatureDelta(_0x5a79fc, _0x1e6902) {
  return Buffer.concat([writeStringField(1, _0x5a79fc), writeMessageField(2, buildTimestamp()), writeStringField(10, _0x1e6902)]);
}
export function buildErrorChunk(_0x5adc88, _0x2d2958) {
  return Buffer.concat([writeStringField(1, _0x5adc88), writeMessageField(2, buildTimestamp()), writeStringField(3, _0x2d2958), writeVarintField(5, STOP_REASON.ERROR)]);
}
