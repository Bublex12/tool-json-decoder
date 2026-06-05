const isLocal =
  location.hostname === "localhost" || location.hostname === "127.0.0.1";

const hubLink = document.getElementById("hub-link");
if (hubLink) {
  hubLink.href = isLocal
    ? window.TOOLS_HUB_LOCAL_URL ?? window.TOOLS_HUB_URL
    : window.TOOLS_HUB_URL;
}

const inputEl = document.getElementById("json-input");
const outputEl = document.getElementById("json-output");
const prettyEl = document.getElementById("pretty-print");
const sortKeysEl = document.getElementById("sort-keys");
const errorEl = document.getElementById("parse-error");
const statusEl = document.getElementById("status");
const copyBtn = document.getElementById("copy-btn");
const minifyBtn = document.getElementById("minify-btn");

function render() {
  const result = decodeJson(inputEl.value, {
    pretty: prettyEl.checked,
    sortKeys: sortKeysEl.checked,
  });

  if (result.error) {
    errorEl.textContent = result.error;
    errorEl.hidden = false;
    outputEl.value = "";
    statusEl.textContent = "";
    copyBtn.disabled = true;
    minifyBtn.disabled = true;
    return;
  }

  errorEl.hidden = true;
  outputEl.value = result.output;
  copyBtn.disabled = false;
  minifyBtn.disabled = false;

  const parts = [describeValue(result.value)];
  if (result.unwrapCount > 0) {
    parts.push(`раскрыто ${result.unwrapCount} сл.`);
  }
  statusEl.textContent = parts.join(" · ");
}

async function copyOutput() {
  if (!outputEl.value) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    statusEl.textContent = "Скопировано";
    setTimeout(render, 1200);
  } catch {
    outputEl.select();
    document.execCommand("copy");
    statusEl.textContent = "Скопировано";
    setTimeout(render, 1200);
  }
}

function minify() {
  const result = decodeJson(inputEl.value, { pretty: false });
  if (result.ok) {
    outputEl.value = result.output;
    prettyEl.checked = false;
    render();
  }
}

inputEl.addEventListener("input", render);
prettyEl.addEventListener("change", render);
sortKeysEl.addEventListener("change", render);
copyBtn.addEventListener("click", copyOutput);
minifyBtn.addEventListener("click", minify);

render();
