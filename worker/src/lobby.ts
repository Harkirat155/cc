import { DurableObject } from "cloudflare:workers";

// Bound by the v1 SQLite migration. Lobby behaviour is a later brick.
export class Lobby extends DurableObject {
  fetch(): Response {
    return Response.json({ error: "not implemented" }, { status: 501 });
  }
}
