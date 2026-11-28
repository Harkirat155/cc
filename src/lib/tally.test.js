import { tally } from "./tally";

// jsdom's default origin is http://localhost, so this file covers "not production".
beforeEach(() => {
  window.localStorage.clear();
  window.navigator.sendBeacon = jest.fn(() => true);
  window.fetch = jest.fn(() => Promise.resolve());
});

test("sends nothing from a host that is not production", () => {
  expect(window.location.hostname).toBe("localhost");
  tally("cc", "view");
  expect(window.navigator.sendBeacon).not.toHaveBeenCalled();
  expect(window.fetch).not.toHaveBeenCalled();
  expect(window.localStorage.getItem("tally:cc")).toBeNull();
});
