export function encodeVarint(arg0) {
  const tmp1 = [];
  let tmp2 = typeof arg0 === "bigint" ? arg0 : BigInt(arg0);
  if (tmp2 < 0x0n) {
    tmp2 = tmp2 + (0x1n << 0x40n);
  }
  do {
    let tmp0 = Number(tmp2 & 0x7fn);
    tmp2 >>= 0x7n;
    if (tmp2 > 0x0n) {
      tmp0 |= 128;
    }
    tmp1.push(tmp0);
  } while (tmp2 > 0x0n);
  return Buffer.from(tmp1);
}
export function decodeVarint(arg0, arg1) {
  let tmp2 = 0x0n;
  let tmp3 = 0x0n;
  let tmp4 = arg1;
  while (tmp4 < arg0.length) {
    const tmp0 = arg0[tmp4++];
    tmp2 |= BigInt(tmp0 & 127) << tmp3;
    if ((tmp0 & 128) === 0) {
      break;
    }
    tmp3 += 0x7n;
  }
  const tmp5 = {
    value: tmp2,
    bytesRead: tmp4 - arg1
  };
  return tmp5;
}
function fieldTag(arg0, arg1) {
  return encodeVarint(arg0 << 3 | arg1);
}
export function writeVarintField(arg0, arg1) {
  return Buffer.concat([fieldTag(arg0, 0), encodeVarint(arg1)]);
}
export function writeBytesField(arg0, arg1) {
  const tmp2 = Buffer.isBuffer(arg1) ? arg1 : Buffer.from(arg1);
  return Buffer.concat([fieldTag(arg0, 2), encodeVarint(tmp2.length), tmp2]);
}
export function writeStringField(arg0, arg1) {
  return writeBytesField(arg0, Buffer.from(arg1, "utf8"));
}
export function writeMessageField(arg0, arg1) {
  return writeBytesField(arg0, arg1);
}
export function writeFixed64Field(arg0, arg1) {
  return Buffer.concat([fieldTag(arg0, 1), arg1]);
}
export function writeFixed32Field(arg0, arg1) {
  return Buffer.concat([fieldTag(arg0, 5), arg1]);
}
export function parseFields(arg0) {
  const tmp1 = [];
  let tmp2 = 0;
  while (tmp2 < arg0.length) {
    const tmp0 = decodeVarint(arg0, tmp2);
    tmp2 += tmp0.bytesRead;
    const tmp12 = tmp0.value;
    const tmp22 = Number(tmp12 >> 0x3n);
    const tmp3 = Number(tmp12 & 0x7n);
    if (tmp22 === 0) {
      break;
    }
    switch (tmp3) {
      case 0:
        {
          const tmp02 = decodeVarint(arg0, tmp2);
          tmp2 += tmp02.bytesRead;
          tmp1.push({
            field: tmp22,
            wireType: 0,
            value: Number(tmp02.value)
          });
          break;
        }
      case 1:
        {
          tmp1.push({
            field: tmp22,
            wireType: 1,
            value: arg0.slice(tmp2, tmp2 + 8)
          });
          tmp2 += 8;
          break;
        }
      case 2:
        {
          const tmp02 = decodeVarint(arg0, tmp2);
          tmp2 += tmp02.bytesRead;
          const tmp13 = Number(tmp02.value);
          tmp1.push({
            field: tmp22,
            wireType: 2,
            value: arg0.slice(tmp2, tmp2 + tmp13)
          });
          tmp2 += tmp13;
          break;
        }
      case 5:
        {
          tmp1.push({
            field: tmp22,
            wireType: 5,
            value: arg0.slice(tmp2, tmp2 + 4)
          });
          tmp2 += 4;
          break;
        }
      default:
        console.warn("[proto] Unknown wire type " + tmp3 + " at field " + tmp22 + ", offset " + tmp2 + " — skipping remaining bytes");
        return tmp1;
    }
  }
  return tmp1;
}
export function getField(arg0, arg1, arg2) {
  return arg0.find(arg02 => arg02.field === arg1 && (arg2 === undefined || arg02.wireType === arg2));
}
export function getAllFields(arg0, arg1) {
  return arg0.filter(arg02 => arg02.field === arg1);
}
export function fieldToString(arg0) {
  if (!arg0 || arg0.wireType !== 2) {
    return "";
  }
  return arg0.value.toString("utf8");
}
export function fieldToInt(arg0) {
  if (!arg0 || arg0.wireType !== 0) {
    return 0;
  }
  return arg0.value;
}
