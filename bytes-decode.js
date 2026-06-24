const MAX_BYTES = 16;

function stringToBytes(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i);
    if (cp > 0xffff) {
      throw new Error("Символ вне BMP не поддерживается");
    }
    bytes.push(cp & 0xff);
  }
  return bytes;
}

function bytesToUnscaled(bytes) {
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) + BigInt(byte & 0xff);
  }
  return value;
}

function normalizeScale(scale) {
  const n = Number(scale);
  if (!Number.isFinite(n) || n < 0 || n > 18 || !Number.isInteger(n)) {
    return { error: "scale: целое число от 0 до 18" };
  }
  return { ok: true, scale: n };
}

function formatScaledValue(unscaled, scale) {
  const divisor = 10n ** BigInt(scale);
  const negative = unscaled < 0n;
  const abs = negative ? -unscaled : unscaled;
  const intPart = abs / divisor;
  const fracPart = abs % divisor;
  const frac = fracPart.toString().padStart(scale, "0");
  const body = scale > 0 ? `${intPart}.${frac}` : String(intPart);
  return negative ? `-${body}` : body;
}

function formatBytesHex(bytes) {
  return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
}

function decodeBytesFromString(text, scaleInput) {
  const scaleResult = normalizeScale(scaleInput ?? 2);
  if (scaleResult.error) return { error: scaleResult.error };

  if (typeof text !== "string" || !text.length) {
    return { error: "Пустая строка bytes" };
  }

  let bytes;
  try {
    bytes = stringToBytes(text);
  } catch (e) {
    return { error: e.message || "Не удалось прочитать байты" };
  }

  if (bytes.length > MAX_BYTES) {
    return { error: `Слишком много байт (макс. ${MAX_BYTES})` };
  }

  const unscaled = bytesToUnscaled(bytes);
  return {
    ok: true,
    bytes,
    bytesHex: formatBytesHex(bytes),
    unscaled: unscaled.toString(),
    scale: scaleResult.scale,
    value: formatScaledValue(unscaled, scaleResult.scale),
  };
}

function peekBytesDecodable(text) {
  if (typeof text !== "string" || !text.length) return false;
  try {
    const bytes = stringToBytes(text);
    return bytes.length > 0 && bytes.length <= MAX_BYTES;
  } catch {
    return false;
  }
}

function joinJsonPath(base, key) {
  const seg = String(key).replace(/~/g, "~0").replace(/\//g, "~1");
  return base ? `${base}/${seg}` : `/${seg}`;
}

function enrichBytesFields(value, scale, options = {}) {
  const { decodeAll = false, paths = [] } = options;
  const pathSet = new Set(paths);

  if (!decodeAll && !pathSet.size) {
    return { value, decodedCount: 0 };
  }

  let decodedCount = 0;

  function walk(node, currentPath) {
    if (Array.isArray(node)) {
      return node.map((item, index) => walk(item, joinJsonPath(currentPath, index)));
    }
    if (!node || typeof node !== "object") {
      return node;
    }

    const out = {};
    for (const [key, val] of Object.entries(node)) {
      out[key] = walk(val, joinJsonPath(currentPath, key));
    }

    if (typeof node.bytes === "string" && out.bytes_value === undefined) {
      const shouldDecode = decodeAll || pathSet.has(currentPath);
      if (shouldDecode) {
        const decoded = decodeBytesFromString(node.bytes, scale);
        if (decoded.ok) {
          out.bytes_hex = decoded.bytesHex;
          out.bytes_value = decoded.value;
          decodedCount += 1;
        }
      }
    }

    return out;
  }

  return { value: walk(value, ""), decodedCount };
}
