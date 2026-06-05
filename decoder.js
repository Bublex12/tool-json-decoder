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
    displayValue: toFormat,
    pretty,
    type,
    unwrapCount: depth,
    steps,
  };
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function jsonStringHtml(str) {
  return `"${escapeHtml(str)}"`;
}

function renderJsonHtml(value, pretty = true) {
  const indentSize = 2;
  return valueToHtml(value, 0, indentSize, pretty);
}

function valueToHtml(value, depth, indentSize, pretty) {
  const pad = pretty ? " ".repeat(depth * indentSize) : "";
  const padInner = pretty ? " ".repeat((depth + 1) * indentSize) : "";
  const br = pretty ? "\n" : "";

  if (value === null) {
    return '<span class="json-null">null</span>';
  }
  if (typeof value === "boolean") {
    return `<span class="json-boolean">${value}</span>`;
  }
  if (typeof value === "number") {
    return `<span class="json-number">${value}</span>`;
  }
  if (typeof value === "string") {
    return `<span class="json-string">${jsonStringHtml(value)}</span>`;
  }

  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    const items = value
      .map((item) => `${padInner}${valueToHtml(item, depth + 1, indentSize, pretty)}`)
      .join(`,${br}`);
    return `[${br}${items}${br}${pad}]`;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length) return "{}";
    const items = keys
      .map((key) => {
        const val = valueToHtml(value[key], depth + 1, indentSize, pretty);
        return `${padInner}<span class="json-key">${jsonStringHtml(key)}</span>: ${val}`;
      })
      .join(`,${br}`);
    return `{${br}${items}${br}${pad}}`;
  }

  return escapeHtml(String(value));
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
