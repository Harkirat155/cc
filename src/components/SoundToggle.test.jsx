import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import SoundToggle from "./SoundToggle";

jest.mock("./ui/Tooltip", () => ({ Tooltip: ({ children }) => <>{children}</> }));

beforeEach(() => window.localStorage.clear());

it("toggles aria-pressed and persists cc.sound", () => {
  render(<SoundToggle />);
  let btn = screen.getByRole("button", { name: "Sound on" });
  expect(btn).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(btn);
  btn = screen.getByRole("button", { name: "Sound off" });
  expect(btn).toHaveAttribute("aria-pressed", "false");
  expect(window.localStorage.getItem("cc.sound")).toBe("off");
  fireEvent.click(btn);
  expect(screen.getByRole("button", { name: "Sound on" })).toHaveAttribute("aria-pressed", "true");
  expect(window.localStorage.getItem("cc.sound")).toBe("on");
});

it("starts muted when cc.sound is off", () => {
  window.localStorage.setItem("cc.sound", "off");
  render(<SoundToggle />);
  expect(screen.getByRole("button", { name: "Sound off" })).toHaveAttribute("aria-pressed", "false");
});
