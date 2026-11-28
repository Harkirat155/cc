/**
 * @jest-environment-options {"url": "https://harkirat155.github.io/cc/"}
 */
import { tally } from "./tally";

beforeEach(() => {
  window.localStorage.clear();
  window.navigator.sendBeacon = jest.fn(() => true);
});

test("sends a hit from the production host", () => {
  expect(window.location.hostname).toBe("harkirat155.github.io");
  tally("cc", "view");
  expect(window.navigator.sendBeacon).toHaveBeenCalledWith("https://tally.harkirat-hira.workers.dev/hit?p=cc&e=view&u=1");
});
