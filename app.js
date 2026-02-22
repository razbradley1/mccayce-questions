const API_URL = "/api/questions";
const VOTED_KEY = "mccayce_voted_ids";

const form = document.getElementById("questionForm");
const questionInput = document.getElementById("question");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submitBtn");
const feedEl = document.getElementById("questionFeed");
const feedEmptyEl = document.getElementById("feedEmpty");

function loadVotedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(VOTED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveVotedIds(idsSet) {
  localStorage.setItem(VOTED_KEY, JSON.stringify([...idsSet]));
}

async function loadQuestions() {
  const res = await fetch(API_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("load_failed");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function submitQuestion(text) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error("submit_failed");
}

async function upvoteQuestion(id) {
  const res = await fetch(API_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action: "upvote" })
  });
  if (!res.ok) throw new Error("upvote_failed");
}

async function renderFeed() {
  try {
    const items = await loadQuestions();
    const votedIds = loadVotedIds();
    const sorted = items
      .map((q) => ({ ...q, votes: Number(q.votes || 0), hidden: !!(q.hidden || q.muted || q.blinded) }))
      .filter((q) => !q.hidden)
      .sort((a, b) => (b.votes - a.votes) || (new Date(b.createdAt) - new Date(a.createdAt)))
      .slice(0, 50);

    feedEl.innerHTML = "";
    feedEmptyEl.style.display = sorted.length ? "none" : "block";

    for (const q of sorted) {
      const item = document.createElement("article");
      item.className = "item";
      item.innerHTML = `
        <p class="q"></p>
        <div class="vote-row">
          <span class="votes">⬆️ ${q.votes}</span>
          <button class="vote-btn" type="button">Upvote</button>
        </div>
      `;
      item.querySelector(".q").textContent = q.text;

      const btn = item.querySelector(".vote-btn");
      const alreadyVoted = votedIds.has(q.id);
      if (alreadyVoted) {
        btn.disabled = true;
        btn.classList.add("voted");
        btn.textContent = "Upvoted";
      }

      btn.onclick = async () => {
        if (votedIds.has(q.id)) return;
        btn.disabled = true;
        try {
          await upvoteQuestion(q.id);
          votedIds.add(q.id);
          saveVotedIds(votedIds);
          await renderFeed();
        } catch {
          btn.disabled = false;
        }
      };

      feedEl.appendChild(item);
    }
  } catch {
    feedEl.innerHTML = "";
    feedEmptyEl.style.display = "block";
    feedEmptyEl.textContent = "Couldn’t load questions right now.";
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const value = questionInput.value.trim();
  if (!value) return;

  submitBtn.disabled = true;
  statusEl.className = "status";
  statusEl.textContent = "Sending...";

  try {
    await submitQuestion(value);
    form.reset();
    statusEl.className = "status ok";
    statusEl.textContent = "Question sent.";
    await renderFeed();
  } catch {
    statusEl.className = "status err";
    statusEl.textContent = "Couldn’t submit right now.";
  } finally {
    submitBtn.disabled = false;
    setTimeout(() => {
      statusEl.textContent = "";
      statusEl.className = "status";
    }, 1400);
  }
});

const POLL_MS_VISIBLE = 10000;
const POLL_MS_HIDDEN = 30000;
let pollTimer = null;

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  const ms = document.hidden ? POLL_MS_HIDDEN : POLL_MS_VISIBLE;
  pollTimer = setInterval(renderFeed, ms);
}

document.addEventListener("visibilitychange", () => {
  startPolling();
  if (!document.hidden) renderFeed();
});

startPolling();
renderFeed();
