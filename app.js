const hubLink = document.getElementById("hub-link");
if (hubLink) {
  hubLink.href = window.TOOLS_HUB_URL;
}

const inputEl = document.getElementById("json-input");
const outputCodeEl = document.querySelector("#json-output code");
const prettyEl = document.getElementById("pretty-print");
const sortKeysEl = document.getElementById("sort-keys");
const decodeBytesEl = document.getElementById("decode-bytes");
const bytesScaleEl = document.getElementById("bytes-scale");
const bytesScaleWrap = document.getElementById("bytes-scale-wrap");
const errorEl = document.getElementById("parse-error");
const statusEl = document.getElementById("status");
const copyBtn = document.getElementById("copy-btn");
const minifyBtn = document.getElementById("minify-btn");
const clearBtn = document.getElementById("clear-btn");
const pasteBtn = document.getElementById("paste-btn");
const downloadBtn = document.getElementById("download-btn");
const sampleBtn = document.getElementById("sample-btn");
const searchInput = document.getElementById("search-input");
const searchCount = document.getElementById("search-count");
const searchPrev = document.getElementById("search-prev");
const searchNext = document.getElementById("search-next");
const toastEl = document.getElementById("toast");

let lastOutput = "";
let lastDisplayValue = null;
let lastPretty = true;
let lastBytesDecodedCount = 0;
let currentMatchIndex = 0;
let matchTotal = 0;
const decodedPaths = new Set();

const SAMPLE =
  '{"compensationAmount":"\\t>h","creditAmountForCompanyWithCompensation":"\\\\p\\u0010","amount":{"bytes":"\\t>h"}}';

function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toastEl.hidden = true;
  }, 2200);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applySearchMarks(html, query, activeIdx) {
  if (!query) return { html, total: 0 };

  const re = new RegExp(escapeRegExp(query), "gi");
  const tokens = html.split(/(<[^>]+>)/g);
  let matchIndex = 0;

  const result = tokens
    .map((token) => {
      if (token.startsWith("<")) return token;
      return token.replace(re, (m) => {
        const active = matchIndex === activeIdx ? " mark--active" : "";
        const wrapped = `<mark class="mark${active}" data-idx="${matchIndex}">${m}</mark>`;
        matchIndex += 1;
        return wrapped;
      });
    })
    .join("");

  return { html: result, total: matchIndex };
}

function renderOutputView() {
  if (lastDisplayValue === null) {
    outputCodeEl.innerHTML = "";
    matchTotal = 0;
    updateSearchUi();
    return;
  }

  let html = renderJsonHtml(lastDisplayValue, lastPretty, {
    clickableBytes: true,
    decodedPaths,
  });
  const query = searchInput.value.trim();

  if (query) {
    const searched = applySearchMarks(html, query, currentMatchIndex);
    html = searched.html;
    matchTotal = searched.total;
    if (matchTotal && currentMatchIndex >= matchTotal) {
      currentMatchIndex = 0;
      renderOutputView();
      return;
    }
  } else {
    matchTotal = 0;
    currentMatchIndex = 0;
  }

  outputCodeEl.innerHTML = html;
  updateSearchUi();
  scrollToActiveMark();
}

function updateSearchUi() {
  if (matchTotal > 0) {
    searchCount.textContent = `${currentMatchIndex + 1} / ${matchTotal}`;
    searchPrev.disabled = false;
    searchNext.disabled = false;
  } else if (searchInput.value.trim()) {
    searchCount.textContent = "0";
    searchPrev.disabled = true;
    searchNext.disabled = true;
  } else {
    searchCount.textContent = "";
    searchPrev.disabled = true;
    searchNext.disabled = true;
  }
}

function scrollToActiveMark() {
  const active = outputCodeEl.querySelector(".mark--active");
  if (!active) return;
  active.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function gotoMatch(delta) {
  if (!matchTotal) return;
  currentMatchIndex = (currentMatchIndex + delta + matchTotal) % matchTotal;
  renderOutputView();
}

function updateBytesScaleVisibility() {
  if (bytesScaleWrap) {
    bytesScaleWrap.hidden = !decodeBytesEl.checked && decodedPaths.size === 0;
  }
}

function render() {
  updateBytesScaleVisibility();
  const result = decodeJson(inputEl.value, {
    pretty: prettyEl.checked,
    sortKeys: sortKeysEl.checked,
    decodeBytes: decodeBytesEl.checked,
    bytesPaths: [...decodedPaths],
    bytesScale: bytesScaleEl?.value ?? 2,
  });

  if (result.error) {
    errorEl.textContent = result.error;
    errorEl.hidden = false;
    lastOutput = "";
    lastDisplayValue = null;
    renderOutputView();
    statusEl.textContent = "ошибка";
    copyBtn.disabled = true;
    minifyBtn.disabled = true;
    downloadBtn.disabled = true;
    return;
  }

  errorEl.hidden = true;
  lastOutput = result.output;
  lastDisplayValue = result.displayValue;
  lastPretty = result.pretty;
  lastBytesDecodedCount = result.bytesDecodedCount;
  renderOutputView();
  copyBtn.disabled = false;
  minifyBtn.disabled = false;
  downloadBtn.disabled = false;

  const parts = [describeValue(result.value)];
  if (result.unwrapCount > 0) {
    parts.push(`раскрыто ${result.unwrapCount} сл.`);
  }
  if (result.bytesDecodedCount > 0) {
    parts.push(`декодировано полей: ${result.bytesDecodedCount}`);
  }
  statusEl.textContent = parts.join(" · ");
}

function decodeBytesAtPath(path) {
  if (path === undefined || path === null) return;

  const preview = decodeJson(inputEl.value, {
    pretty: prettyEl.checked,
    sortKeys: sortKeysEl.checked,
    decodeBytes: false,
    bytesPaths: [],
  });
  if (!preview.ok) return;

  const bytesStr = getValueAtPath(preview.value, path);
  if (typeof bytesStr !== "string") {
    showToast("Не удалось декодировать");
    return;
  }
  const decoded = decodeBytesFromString(bytesStr, bytesScaleEl?.value ?? 2);
  if (!decoded.ok) {
    showToast(decoded.error || "Не удалось декодировать");
    return;
  }

  decodedPaths.add(path);
  render();
  showToast(`${decoded.value} (${decoded.bytesHex})`);
}

function getValueAtPath(value, path) {
  if (path === "" || path === "/") return value;
  const segments = path.replace(/^\//, "").split("/");
  let node = value;
  for (const seg of segments) {
    const key = seg.replace(/~1/g, "/").replace(/~0/g, "~");
    node = node?.[key];
  }
  return node;
}

async function copyOutput() {
  if (!lastOutput) return;
  try {
    await navigator.clipboard.writeText(lastOutput);
    showToast("Скопировано");
  } catch {
    showToast("Не удалось скопировать");
  }
}

function minify() {
  const result = decodeJson(inputEl.value, { pretty: false });
  if (result.ok) {
    prettyEl.checked = false;
    render();
    showToast("Minify");
  }
}

async function pasteInput() {
  try {
    inputEl.value = await navigator.clipboard.readText();
    render();
    showToast("Вставлено");
  } catch {
    showToast("Нет доступа к буферу");
  }
}

function downloadOutput() {
  if (!lastOutput) return;
  const blob = new Blob([lastOutput], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "decoded.json";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Скачано decoded.json");
}

function loadSample() {
  inputEl.value = SAMPLE;
  prettyEl.checked = true;
  decodedPaths.clear();
  render();
  showToast("Пример загружен");
}

searchInput.addEventListener("input", () => {
  currentMatchIndex = 0;
  renderOutputView();
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    gotoMatch(e.shiftKey ? -1 : 1);
  }
});

searchPrev.addEventListener("click", () => gotoMatch(-1));
searchNext.addEventListener("click", () => gotoMatch(1));

clearBtn.addEventListener("click", () => {
  inputEl.value = "";
  searchInput.value = "";
  currentMatchIndex = 0;
  decodedPaths.clear();
  render();
  inputEl.focus();
});

outputCodeEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-bytes-path]");
  if (!btn || decodeBytesEl.checked) return;
  e.preventDefault();
  decodeBytesAtPath(btn.dataset.bytesPath ?? "");
});

inputEl.addEventListener("input", () => {
  decodedPaths.clear();
  render();
});
prettyEl.addEventListener("change", render);
sortKeysEl.addEventListener("change", render);
decodeBytesEl.addEventListener("change", render);
bytesScaleEl?.addEventListener("input", render);
copyBtn.addEventListener("click", copyOutput);
minifyBtn.addEventListener("click", minify);
pasteBtn?.addEventListener("click", pasteInput);
downloadBtn?.addEventListener("click", downloadOutput);
sampleBtn?.addEventListener("click", loadSample);

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "f" && !e.shiftKey) {
    if (document.activeElement !== inputEl) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
    e.preventDefault();
    copyOutput();
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "M") {
    e.preventDefault();
    minify();
  }
});

render();
