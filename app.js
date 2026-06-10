const hubLink = document.getElementById("hub-link");
if (hubLink) {
  hubLink.href = window.TOOLS_HUB_URL;
}

const inputEl = document.getElementById("json-input");
const outputCodeEl = document.querySelector("#json-output code");
const prettyEl = document.getElementById("pretty-print");
const sortKeysEl = document.getElementById("sort-keys");
const errorEl = document.getElementById("parse-error");
const statusEl = document.getElementById("status");
const copyBtn = document.getElementById("copy-btn");
const minifyBtn = document.getElementById("minify-btn");
const clearBtn = document.getElementById("clear-btn");
const searchInput = document.getElementById("search-input");
const searchCount = document.getElementById("search-count");
const searchPrev = document.getElementById("search-prev");
const searchNext = document.getElementById("search-next");

let lastOutput = "";
let lastDisplayValue = null;
let lastPretty = true;
let currentMatchIndex = 0;
let matchTotal = 0;

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

  let html = renderJsonHtml(lastDisplayValue, lastPretty);
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

function render() {
  const result = decodeJson(inputEl.value, {
    pretty: prettyEl.checked,
    sortKeys: sortKeysEl.checked,
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
    return;
  }

  errorEl.hidden = true;
  lastOutput = result.output;
  lastDisplayValue = result.displayValue;
  lastPretty = result.pretty;
  renderOutputView();
  copyBtn.disabled = false;
  minifyBtn.disabled = false;

  const parts = [describeValue(result.value)];
  if (result.unwrapCount > 0) {
    parts.push(`раскрыто ${result.unwrapCount} сл.`);
  }
  statusEl.textContent = parts.join(" · ");
}

async function copyOutput() {
  if (!lastOutput) return;
  try {
    await navigator.clipboard.writeText(lastOutput);
    statusEl.textContent = "Скопировано";
    setTimeout(render, 1200);
  } catch {
    statusEl.textContent = "Не удалось скопировать";
  }
}

function minify() {
  const result = decodeJson(inputEl.value, { pretty: false });
  if (result.ok) {
    prettyEl.checked = false;
    render();
  }
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
  render();
  inputEl.focus();
});

inputEl.addEventListener("input", render);
prettyEl.addEventListener("change", render);
sortKeysEl.addEventListener("change", render);
copyBtn.addEventListener("click", copyOutput);
minifyBtn.addEventListener("click", minify);

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "f" && !e.shiftKey) {
    const inInput = document.activeElement === inputEl;
    if (!inInput) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  }
});

render();
