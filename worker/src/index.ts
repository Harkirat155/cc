import { Hono } from "hono";
import { Lobby } from "./lobby";
import { Room } from "./room";

export { Lobby, Room };

// Node records process start at server/metrics.js:17. An isolate has no process,
// so this is the isolate's first request, which resets when the isolate is evicted.
// Set lazily: Workers freeze Date.now() at 0 in global scope, so a module-scope read is 1970.
let isolateStartedAt = 0;

// Same buckets as formatUptime, server/metrics.js:96-105, over isolate age.
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

const app = new Hono<{
  Bindings: { ROOM: DurableObjectNamespace<Room>; LOBBY: DurableObjectNamespace<Lobby> };
}>();

// Keys match getHealthStatus (server/metrics.js:122-127). 200 while healthy (server/app.js:85-88).
app.get("/health", (c) => {
  isolateStartedAt ||= Date.now();
  const checks = {
    // Node: process.memoryUsage().heapUsedMB < 500 (metrics.js:116). Workers expose no
    // process heap. A request that reaches here is inside the 128 MB isolate limit.
    memory: true,
    // Node: rooms.size < 1000 (metrics.js:117). This Worker holds no room map; the count is 0.
    rooms: true,
  };
  return c.json({
    status: "healthy",
    checks,
    // Node: process uptime string (metrics.js:125). Here: how long this isolate has been alive.
    uptime: formatUptime(Date.now() - isolateStartedAt),
    // Node: new Date().toISOString() (metrics.js:126). Same reading.
    timestamp: new Date().toISOString(),
  });
});

app.notFound((c) => c.json({ error: "not found" }, 404));

export default app;
