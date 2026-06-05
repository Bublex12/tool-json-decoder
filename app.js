const isLocal =
  location.hostname === "localhost" || location.hostname === "127.0.0.1";

const hubLink = document.getElementById("hub-link");
if (hubLink) {
  hubLink.href = isLocal
    ? window.TOOLS_HUB_LOCAL_URL ?? window.TOOLS_HUB_URL
    : window.TOOLS_HUB_URL;
}

const inputEl = document.getElementById("json-input");
const outputCodeEl = document.querySelector("#json-output code");
const outputScrollEl = document.getElementById("json-output");
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
let currentMatchIndex = 0;
let matchTotal = 0;

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderOutputView() {
  const query = searchInput.value.trim();

  if (!lastOutput) {
    outputCodeEl.textContent = "";
    matchTotal = 0;
    updateSearchUi();
    return;
  }

  if (!query) {
    outputCodeEl.textContent = lastOutput;
    matchTotal = 0;
    currentMatchIndex = 0;
    updateSearchUi();
    return;
  }

  const re = new RegExp(escapeRegExp(query), "gi");
  const parts = [];
  let lastIndex = 0;
  let matchIndex = 0;
  let m;

  while ((m = re.exec(lastOutput)) !== null) {
    parts.push(escapeHtml(lastOutput.slice(lastIndex, m.index)));
    const active = matchIndex === currentMatchIndex ? " mark--active" : "";
    parts.push(
      `<mark class="mark${active}" data-idx="${matchIndex}">${escapeHtml(m[0])}</mark>`
    );
    matchIndex += 1;
    lastIndex = m.index + m[0].length;
    if (m[0].length === 0) {
      re.lastIndex += 1;
    }
  }

  parts.push(escapeHtml(lastOutput.slice(lastIndex)));
  outputCodeEl.innerHTML = parts.join("");
  matchTotal = matchIndex;
  if (matchTotal && currentMatchIndex >= matchTotal) {
    currentMatchIndex = 0;
    renderOutputView();
    return;
  }
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
    renderOutputView();
    statusEl.textContent = "ошибка";
    copyBtn.disabled = true;
    minifyBtn.disabled = true;
    return;
  }

  errorEl.hidden = true;
  lastOutput = result.output;
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
