const DB_URL = "https://jsonblob.com/api/jsonBlob/019c7901-6d34-7c98-8216-d79d24dddb0a";

async function readAll() {
  const res = await fetch(DB_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("db_read_failed");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function writeAll(list) {
  const res = await fetch(DB_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(list)
  });
  if (!res.ok) throw new Error("db_write_failed");
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    if (req.method === "GET") {
      const items = await readAll();
      return res.status(200).send(JSON.stringify(items));
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const text = String(body.text || "").trim();
      if (!text) return res.status(400).send(JSON.stringify({ error: "text_required" }));

      const items = await readAll();
      const entry = {
        id: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
        text,
        createdAt: new Date().toISOString(),
        votes: 0,
        hidden: false
      };
      items.unshift(entry);
      await writeAll(items);
      return res.status(201).send(JSON.stringify(entry));
    }

    if (req.method === "PATCH") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const { id, action } = body;
      if (!id || !action) return res.status(400).send(JSON.stringify({ error: "id_action_required" }));

      const items = await readAll();
      const row = items.find((x) => x.id === id);
      if (!row) return res.status(404).send(JSON.stringify({ error: "not_found" }));

      if (action === "upvote") row.votes = Number(row.votes || 0) + 1;
      else if (action === "hide") row.hidden = true;
      else if (action === "unhide") row.hidden = false;
      else if (action === "mute") row.hidden = true; // backward compatibility
      else if (action === "blind") row.hidden = true; // backward compatibility
      else if (action === "unmute") row.hidden = false; // backward compatibility
      else if (action === "unblind") row.hidden = false; // backward compatibility
      else return res.status(400).send(JSON.stringify({ error: "unknown_action" }));

      await writeAll(items);
      return res.status(200).send(JSON.stringify({ ok: true, row }));
    }

    if (req.method === "DELETE") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const { id, all } = body;
      let items = await readAll();
      if (all) items = [];
      else items = items.filter((x) => x.id !== id);
      await writeAll(items);
      return res.status(200).send(JSON.stringify({ ok: true }));
    }

    return res.status(405).send(JSON.stringify({ error: "method_not_allowed" }));
  } catch {
    return res.status(500).send(JSON.stringify({ error: "server_error" }));
  }
}
