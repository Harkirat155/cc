import { loadOrReload } from "./lazyReload";

const mem = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; } }; };

describe("loadOrReload", () => {
  it("returns the module and clears the flag", async () => {
    const storage = mem(); storage.setItem("cc.chunkReload", "1");
    const reload = jest.fn();
    await expect(loadOrReload(async () => "mod", { storage, reload })).resolves.toBe("mod");
    expect(storage.getItem("cc.chunkReload")).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });
  it("reloads once when the chunk fails, then lets the error through", async () => {
    const storage = mem(); const reload = jest.fn();
    const fail = async () => { throw new Error("chunk gone"); };
    loadOrReload(fail, { storage, reload }); // never settles: the page is going away
    await new Promise((r) => setTimeout(r, 0));
    expect(reload).toHaveBeenCalledTimes(1);
    await expect(loadOrReload(fail, { storage, reload })).rejects.toThrow("chunk gone");
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
