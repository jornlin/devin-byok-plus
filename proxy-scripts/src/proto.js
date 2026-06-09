export function encodeVarint(_0x2ee231) {
  const _0x5ea219 = [];
  let _0x41d71f = typeof _0x2ee231 === "bigint" ? _0x2ee231 : BigInt(_0x2ee231);
  if (_0x41d71f < 0x0n) {
    _0x41d71f = _0x41d71f + (0x1n << 0x40n);
  }
  do {
    let _0x3bcfbb = Number(_0x41d71f & 0x7fn);
    _0x41d71f >>= 0x7n;
    if (_0x41d71f > 0x0n) {
      _0x3bcfbb |= 128;
    }
    _0x5ea219.push(_0x3bcfbb);
  } while (_0x41d71f > 0x0n);
  return Buffer.from(_0x5ea219);
}
export function decodeVarint(_0x790e94, _0x228cf7) {
  let _0x1a7996 = 0x0n;
  let _0x3ec4ca = 0x0n;
  let _0x4e973a = _0x228cf7;
  while (_0x4e973a < _0x790e94.length) {
    const _0x38605d = _0x790e94[_0x4e973a++];
    _0x1a7996 |= BigInt(_0x38605d & 127) << _0x3ec4ca;
    if ((_0x38605d & 128) === 0) {
      break;
    }
    _0x3ec4ca += 0x7n;
  }
  const _0x2e821d = {
    value: _0x1a7996,
    bytesRead: _0x4e973a - _0x228cf7
  };
  return _0x2e821d;
}
function fieldTag(_0x1f3ead, _0x109e34) {
  return encodeVarint(_0x1f3ead << 3 | _0x109e34);
}
export function writeVarintField(_0x2c5e16, _0x5dcc6a) {
  return Buffer.concat([fieldTag(_0x2c5e16, 0), encodeVarint(_0x5dcc6a)]);
}
export function writeBytesField(_0x431150, _0x4d1548) {
  const _0x4c0509 = Buffer.isBuffer(_0x4d1548) ? _0x4d1548 : Buffer.from(_0x4d1548);
  return Buffer.concat([fieldTag(_0x431150, 2), encodeVarint(_0x4c0509.length), _0x4c0509]);
}
export function writeStringField(_0x3f18f6, _0x517ad4) {
  return writeBytesField(_0x3f18f6, Buffer.from(_0x517ad4, "utf8"));
}
export function writeMessageField(_0x4e4756, _0x26d709) {
  return writeBytesField(_0x4e4756, _0x26d709);
}
export function writeFixed64Field(_0x459756, _0xe589c4) {
  return Buffer.concat([fieldTag(_0x459756, 1), _0xe589c4]);
}
export function writeFixed32Field(_0x31951d, _0x46ff97) {
  return Buffer.concat([fieldTag(_0x31951d, 5), _0x46ff97]);
}
export function parseFields(_0x1b6607) {
  const _0x1a9776 = [];
  let _0x5e6fae = 0;
  while (_0x5e6fae < _0x1b6607.length) {
    const _0x3c0ba2 = decodeVarint(_0x1b6607, _0x5e6fae);
    _0x5e6fae += _0x3c0ba2.bytesRead;
    const _0x44360e = _0x3c0ba2.value;
    const _0x2ed7d2 = Number(_0x44360e >> 0x3n);
    const _0x219699 = Number(_0x44360e & 0x7n);
    if (_0x2ed7d2 === 0) {
      break;
    }
    switch (_0x219699) {
      case 0:
        {
          const _0x29cbc5 = decodeVarint(_0x1b6607, _0x5e6fae);
          _0x5e6fae += _0x29cbc5.bytesRead;
          _0x1a9776.push({
            field: _0x2ed7d2,
            wireType: 0,
            value: Number(_0x29cbc5.value)
          });
          break;
        }
      case 1:
        {
          _0x1a9776.push({
            field: _0x2ed7d2,
            wireType: 1,
            value: _0x1b6607.slice(_0x5e6fae, _0x5e6fae + 8)
          });
          _0x5e6fae += 8;
          break;
        }
      case 2:
        {
          const _0x21333a = decodeVarint(_0x1b6607, _0x5e6fae);
          _0x5e6fae += _0x21333a.bytesRead;
          const _0x18db67 = Number(_0x21333a.value);
          _0x1a9776.push({
            field: _0x2ed7d2,
            wireType: 2,
            value: _0x1b6607.slice(_0x5e6fae, _0x5e6fae + _0x18db67)
          });
          _0x5e6fae += _0x18db67;
          break;
        }
      case 5:
        {
          _0x1a9776.push({
            field: _0x2ed7d2,
            wireType: 5,
            value: _0x1b6607.slice(_0x5e6fae, _0x5e6fae + 4)
          });
          _0x5e6fae += 4;
          break;
        }
      default:
        console.warn("[proto] Unknown wire type " + _0x219699 + " at field " + _0x2ed7d2 + ", offset " + _0x5e6fae + " — skipping remaining bytes");
        return _0x1a9776;
    }
  }
  return _0x1a9776;
}
export function getField(_0x1b0075, _0x491e4d, _0x57cc3e) {
  return _0x1b0075.find(_0x46cf4a => _0x46cf4a.field === _0x491e4d && (_0x57cc3e === undefined || _0x46cf4a.wireType === _0x57cc3e));
}
export function getAllFields(_0x492cbb, _0x5eac45) {
  return _0x492cbb.filter(_0x440cda => _0x440cda.field === _0x5eac45);
}
export function fieldToString(_0x27b7da) {
  if (!_0x27b7da || _0x27b7da.wireType !== 2) {
    return "";
  }
  return _0x27b7da.value.toString("utf8");
}
export function fieldToInt(_0x35c820) {
  if (!_0x35c820 || _0x35c820.wireType !== 0) {
    return 0;
  }
  return _0x35c820.value;
}
