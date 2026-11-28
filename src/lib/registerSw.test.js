import { registerSw } from "./registerSw";

const nav = () => ({ serviceWorker: { register: jest.fn().mockResolvedValue({}) } });

describe("registerSw", () => {
  it("registers /cc/sw.js with the /cc/ scope in production", () => {
    const n = nav();
    expect(registerSw({ prod: true, base: "/cc/", nav: n })).toBe(true);
    expect(n.serviceWorker.register).toHaveBeenCalledWith("/cc/sw.js", { scope: "/cc/" });
  });
  it("does nothing outside production or without service worker support", () => {
    const n = nav();
    expect(registerSw({ prod: false, base: "/cc/", nav: n })).toBe(false);
    expect(n.serviceWorker.register).not.toHaveBeenCalled();
    expect(registerSw({ prod: true, base: "/cc/", nav: {} })).toBe(false);
  });
});
