import { loadOrReload } from "./lazyReload";

const mem = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; } }; };

describe("loadOrReload", () => {
  it("returns the module", async () => {
    const storage = mem();
    const reload = jest.fn();
    await expect(loadOrReload(async () => "mod", { storage, reload })).resolves.toBe("mod");
    expect(reload).not.toHaveBeenCalled();
  });
  it("reloads once when the chunk fails, then lets the error through", async () => {
    const storage = mem(); const reload = jest.fn();
    const fail = async () => { throw new Error("chunk gone"); };
    loadOrReload(fail, { storage, reload, now: () => 1000 }); // never settles: the page is going away
    await new Promise((r) => setTimeout(r, 0));
    expect(reload).toHaveBeenCalledTimes(1);
    await expect(loadOrReload(fail, { storage, reload, now: () => 2000 })).rejects.toThrow("chunk gone");
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it("a healthy chunk does not re-arm the guard for a chunk that keeps failing", async () => {
    const storage = mem(); const reload = jest.fn();
    const fail = async () => { throw new Error("B gone"); };
    loadOrReload(fail, { storage, reload, now: () => 1000 });
    await new Promise((r) => setTimeout(r, 0));
    await loadOrReload(async () => "A", { storage, reload, now: () => 2000 });
    await expect(loadOrReload(fail, { storage, reload, now: () => 3000 })).rejects.toThrow("B gone");
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it("allows another reload after 10 minutes", async () => {
    const storage = mem(); const reload = jest.fn();
    const fail = async () => { throw new Error("gone"); };
    loadOrReload(fail, { storage, reload, now: () => 1000 });
    await new Promise((r) => setTimeout(r, 0));
    loadOrReload(fail, { storage, reload, now: () => 10 * 60_000 + 1001 });
    await new Promise((r) => setTimeout(r, 0));
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
