import { DurableObject } from "cloudflare:workers";
import { buildEntry, MAX_ENTRIES, type FeedbackEntry, type FeedbackInput } from "./feedbackStore";

// Bound by the v1 SQLite migration. Lobby matchmaking is a later brick; for now it also
// holds the feedback ring (server/feedbackStore.js:53), newest MAX_ENTRIES rows.
export class Lobby extends DurableObject {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS feedback (seq INTEGER PRIMARY KEY AUTOINCREMENT, entry TEXT NOT NULL)",
    );
  }

  addFeedback(input: FeedbackInput): FeedbackEntry {
    const entry = buildEntry(input);
    const sql = this.ctx.storage.sql;
    sql.exec("INSERT INTO feedback (entry) VALUES (?)", JSON.stringify(entry));
    sql.exec("DELETE FROM feedback WHERE seq <= (SELECT MAX(seq) FROM feedback) - ?", MAX_ENTRIES);
    return entry;
  }

  // Newest first, like listFeedback (feedbackStore.js:71).
  listFeedback(limit = 20): FeedbackEntry[] {
    if (limit <= 0) return [];
    return this.ctx.storage.sql
      .exec<{ entry: string }>("SELECT entry FROM feedback ORDER BY seq DESC LIMIT ?", limit)
      .toArray()
      .map((r) => JSON.parse(r.entry));
  }

  fetch(): Response {
    return Response.json({ error: "not implemented" }, { status: 501 });
  }
}
