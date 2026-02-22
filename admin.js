const API_URL = "/api/questions";
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const clearAllBtn = document.getElementById("clearAll");

async function loadQuestions() {
  const res = await fetch(API_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("load_failed");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function patchAction(id, action) {
  const res = await fetch(API_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action })
  });
  if (!res.ok) throw new Error("patch_failed");
}

async function deleteQuestion(id) {
  const res = await fetch(API_URL, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });
  if (!res.ok) throw new Error("delete_failed");
}

async function clearAllQuestions() {
  const res = await fetch(API_URL, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ all: true })
  });
  if (!res.ok) throw new Error("clear_failed");
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString();
}

function visibilityLabel(q) {
  return q.hidden ? "HIDDEN" : "LIVE";
}

async function render() {
  try {
    const items = (await loadQuestions())
      .map((q) => ({ ...q, votes: Number(q.votes || 0), hidden: !!(q.hidden || q.muted || q.blinded) }))
      .sort((a, b) => (b.votes - a.votes) || (new Date(b.createdAt) - new Date(a.createdAt)));

    listEl.innerHTML = "";
    emptyEl.style.display = items.length ? "none" : "block";

    for (const q of items) {
      const card = document.createElement("article");
      card.className = "item";
      card.innerHTML = `
        <div class="meta">⬆️ ${q.votes} · ${fmtDate(q.createdAt)} · <strong>${visibilityLabel(q)}</strong></div>
        <p class="q"></p>
        <div class="row">
          <button data-action="hide">Hide</button>
          <button data-action="unhide">Unhide</button>
          <button data-action="delete">Delete</button>
        </div>
      `;

      card.querySelector(".q").textContent = q.text;

      card.querySelector('[data-action="hide"]').onclick = async () => {
        await patchAction(q.id, "hide");
        render();
      };
      card.querySelector('[data-action="unhide"]').onclick = async () => {
        await patchAction(q.id, "unhide");
        render();
      };
      card.querySelector('[data-action="delete"]').onclick = async () => {
        await deleteQuestion(q.id);
        render();
      };

      listEl.appendChild(card);
    }
  } catch {
    listEl.innerHTML = "";
    emptyEl.style.display = "block";
    emptyEl.textContent = "Couldn’t load questions right now.";
  }
}

clearAllBtn.onclick = async () => {
  if (!confirm("Delete all questions?")) return;
  await clearAllQuestions();
  render();
};

const POLL_MS_VISIBLE = 6000;
const POLL_MS_HIDDEN = 30000;
let pollTimer = null;

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  const ms = document.hidden ? POLL_MS_HIDDEN : POLL_MS_VISIBLE;
  pollTimer = setInterval(render, ms);
}

document.addEventListener("visibilitychange", () => {
  startPolling();
  if (!document.hidden) render();
});

startPolling();
render();
