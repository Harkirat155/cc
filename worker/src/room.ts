import { DurableObject } from "cloudflare:workers";

// Bound by the v1 SQLite migration. Room behaviour is a later brick.
export class Room extends DurableObject {
  fetch(): Response {
    return Response.json({ error: "not implemented" }, { status: 501 });
  }
}
