const PRIMARY_DB_URL = process.env.PRIMARY_DB_URL || "https://jsonblob.com/api/jsonBlob/019c8616-d103-7eef-b26c-4ff080760878";
const BACKUP_DB_URL = process.env.BACKUP_DB_URL || "https://jsonblob.com/api/jsonBlob/019c8616-dfbb-7868-a463-4c1451960bb4";

async function readFrom(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("db_read_failed");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function writeTo(url, list) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(list)
  });
  if (!res.ok) throw new Error("db_write_failed");
}

async function readAll() {
  try {
    return await readFrom(PRIMARY_DB_URL);
  } catch {
    const backup = await readFrom(BACKUP_DB_URL);
    // Best effort: heal primary if possible.
    try { await writeTo(PRIMARY_DB_URL, backup); } catch {}
    return backup;
  }
}

async function writeAll(list) {
  const results = await Promise.allSettled([
    writeTo(PRIMARY_DB_URL, list),
    writeTo(BACKUP_DB_URL, list)
  ]);
  if (results.every((r) => r.status === "rejected")) {
    throw new Error("db_write_failed");
  }
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
