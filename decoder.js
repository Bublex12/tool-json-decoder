const MAX_DEPTH = 12;

function tryParse(text) {
  return JSON.parse(text);
}

function decodeJson(raw, options = {}) {
  const { pretty = true, sortKeys = false } = options;
  let current = raw.trim();
  if (!current) {
    return { error: "Вставьте JSON или экранированную строку" };
  }

  const steps = [];
  let value;

  try {
    value = tryParse(current);
    steps.push({ action: "parse", from: "input" });
  } catch (e) {
    return { error: formatParseError(e, current) };
  }

  let depth = 0;
  while (typeof value === "string" && depth < MAX_DEPTH) {
    const inner = value.trim();
    if (!inner) break;
    try {
      value = tryParse(inner);
      depth += 1;
      steps.push({ action: "unwrap", level: depth });
    } catch {
      break;
    }
  }

  let output;
  try {
    const toFormat = sortKeys ? sortObjectKeys(value) : value;
    output = pretty
      ? JSON.stringify(toFormat, null, 2)
      : JSON.stringify(toFormat);
  } catch (e) {
    return { error: e.message || "Не удалось сериализовать" };
  }

  const type = Array.isArray(value)
    ? "array"
    : value === null
      ? "null"
      : typeof value;

  return {
    ok: true,
    output,
    value,
    type,
    unwrapCount: depth,
    steps,
  };
}

function sortObjectKeys(val) {
  if (Array.isArray(val)) {
    return val.map(sortObjectKeys);
  }
  if (val && typeof val === "object") {
    return Object.keys(val)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObjectKeys(val[key]);
        return acc;
      }, {});
  }
  return val;
}

function formatParseError(err, text) {
  const msg = err.message || "Невалидный JSON";
  const posMatch = msg.match(/position\s+(\d+)/i);
  if (posMatch) {
    const pos = parseInt(posMatch[1], 10);
    const line = text.slice(0, pos).split("\n").length;
    const col = pos - text.lastIndexOf("\n", pos - 1);
    return `${msg} (строка ${line}, позиция ${col})`;
  }
  return msg;
}

function describeValue(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return `массив, ${value.length} эл.`;
  if (typeof value === "object") return `объект, ${Object.keys(value).length} ключей`;
  if (typeof value === "string") return `строка, ${value.length} симв.`;
  return typeof value;
}
