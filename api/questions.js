const NOCO_URL = (process.env.NOCO_URL || "https://nocodb.razhome.com").replace(/\/$/, "");
const NOCO_BASE_ID = process.env.NOCO_BASE_ID || "p1k0aqpqqu7tgky";
const NOCO_TABLE_ID = process.env.NOCO_TABLE_ID || "mqiz1txxeqc048p";
const NOCO_TOKEN = process.env.NOCO_TOKEN;

function escapeWhereValue(value) {
  return String(value).replace(/,/g, "\\,").replace(/\)/g, "\\)");
}

async function nocoRequest(path, { method = "GET", body } = {}) {
  if (!NOCO_TOKEN) throw new Error("noco_token_missing");

  const res = await fetch(`${NOCO_URL}${path}`, {
    method,
    headers: {
      "xc-token": NOCO_TOKEN,
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store"
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  if (!res.ok) {
    const msg = data?.msg || data?.message || `noco_${res.status}`;
    throw new Error(msg);
  }

  return data;
}

function mapRow(row) {
  return {
    id: row.qid,
    text: row.text || "",
    createdAt: row.CreatedAt || row.created_at || new Date().toISOString(),
    votes: Number(row.votes || 0),
    hidden: !!row.hidden,
    _rid: row.id
  };
}

async function listQuestionsRaw() {
  const out = await nocoRequest(`/api/v2/tables/${NOCO_TABLE_ID}/records?limit=200`);
  return Array.isArray(out?.list) ? out.list : [];
}

async function listQuestions() {
  const rows = await listQuestionsRaw();
  return rows.map(mapRow);
}

async function createQuestion(text) {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await nocoRequest(`/api/v2/tables/${NOCO_TABLE_ID}/records`, {
    method: "POST",
    body: {
      qid: id,
      text,
      votes: 0,
      hidden: false
    }
  });

  return {
    id,
    text,
    createdAt: new Date().toISOString(),
    votes: 0,
    hidden: false
  };
}

async function patchQuestion(id, action) {
  const rows = await listQuestionsRaw();
  const row = rows.find((r) => r.qid === id);
  if (!row) return null;

  const update = { id: row.id };

  if (action === "upvote") update.votes = Number(row.votes || 0) + 1;
  else if (["hide", "mute", "blind"].includes(action)) update.hidden = true;
  else if (["unhide", "unmute", "unblind"].includes(action)) update.hidden = false;
  else throw new Error("unknown_action");

  await nocoRequest(`/api/v2/tables/${NOCO_TABLE_ID}/records`, {
    method: "PATCH",
    body: [update]
  });

  return {
    ...mapRow({ ...row, ...update })
  };
}

async function deleteQuestion(id) {
  const where = encodeURIComponent(`(qid,eq,${escapeWhereValue(id)})`);
  const out = await nocoRequest(`/api/v2/tables/${NOCO_TABLE_ID}/records?where=${where}`);
  const row = out?.list?.[0];
  if (!row) return;

  await nocoRequest(`/api/v2/tables/${NOCO_TABLE_ID}/records`, {
    method: "DELETE",
    body: [{ id: row.id }]
  });
}

async function clearAllQuestions() {
  const rows = await listQuestionsRaw();
  if (!rows.length) return;
  await nocoRequest(`/api/v2/tables/${NOCO_TABLE_ID}/records`, {
    method: "DELETE",
    body: rows.map((r) => ({ id: r.id }))
  });
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    if (req.method === "GET") {
      const items = await listQuestions();
      return res.status(200).send(JSON.stringify(items));
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const text = String(body.text || "").trim();
      if (!text) return res.status(400).send(JSON.stringify({ error: "text_required" }));

      const entry = await createQuestion(text);
      return res.status(201).send(JSON.stringify(entry));
    }

    if (req.method === "PATCH") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const { id, action } = body;
      if (!id || !action) return res.status(400).send(JSON.stringify({ error: "id_action_required" }));

      let row;
      try {
        row = await patchQuestion(id, action);
      } catch (err) {
        if (String(err?.message) === "unknown_action") {
          return res.status(400).send(JSON.stringify({ error: "unknown_action" }));
        }
        throw err;
      }

      if (!row) return res.status(404).send(JSON.stringify({ error: "not_found" }));
      return res.status(200).send(JSON.stringify({ ok: true, row }));
    }

    if (req.method === "DELETE") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const { id, all } = body;
      if (all) await clearAllQuestions();
      else if (id) await deleteQuestion(id);
      else return res.status(400).send(JSON.stringify({ error: "id_or_all_required" }));
      return res.status(200).send(JSON.stringify({ ok: true }));
    }

    return res.status(405).send(JSON.stringify({ error: "method_not_allowed" }));
  } catch (err) {
    return res.status(500).send(JSON.stringify({ error: "server_error", detail: String(err?.message || err) }));
  }
}
