import { env } from "cloudflare:workers";
import { expect } from "vitest";
import app from "../src/index";

export type Frame = { t: string; id?: number; d?: any };

export class Client {
  frames: Frame[] = [];
  private n = 0;
  private waiters: (() => void)[] = [];
  constructor(readonly ws: WebSocket) {
    ws.addEventListener("message", (e) => {
      this.frames.push(JSON.parse(e.data as string));
      this.waiters.splice(0).forEach((w) => w());
    });
  }
  send(t: string, d?: unknown) {
    this.ws.send(JSON.stringify({ t, d }));
  }
  async call(t: string, d?: unknown): Promise<any> {
    const id = ++this.n;
    this.ws.send(JSON.stringify({ t, id, d }));
    return (await this.wait((f) => f.t === "ack" && f.id === id)).d;
  }
  async wait(pred: (f: Frame) => boolean, from = 0): Promise<Frame> {
    for (let i = 0; i < 200; i++) {
      const f = this.frames.slice(from).find(pred);
      if (f) return f;
      await new Promise<void>((r) => {
        this.waiters.push(r);
        setTimeout(r, 10);
      });
    }
    throw new Error(`no frame; got ${JSON.stringify(this.frames)}`);
  }
  update(from = 0) {
    return this.wait((f) => f.t === "gameUpdate", from).then((f) => f.d);
  }
  close() {
    this.ws.close(1000);
  }
}

export async function open(path: string): Promise<Client> {
  const r = await app.fetch(new Request(`http://x${path}`, { headers: { Upgrade: "websocket" } }), env);
  expect(r.status).toBe(101);
  const ws = r.webSocket!;
  ws.accept();
  return new Client(ws);
}
