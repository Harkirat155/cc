import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import NavMenu from "./NavMenu";

jest.mock("./ui/Tooltip", () => ({
  Tooltip: ({ children }) => <>{children}</>,
}));

const BUTTON_RECT = {
  x: 0,
  y: 0,
  left: 0,
  top: 16,
  width: 36,
  height: 36,
  right: 0,
  bottom: 52,
  toJSON: () => ({}),
};

const actions = [
  {
    key: "history",
    label: "Open History",
    description: "View move history",
    onSelect: jest.fn(),
  },
];

function setViewportWidth(width) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
}

describe("NavMenu", () => {
  let buttonRect;

  beforeEach(() => {
    buttonRect = { ...BUTTON_RECT, right: 344 };
    setViewportWidth(360);
    jest.spyOn(window.HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      if (this.getAttribute("aria-haspopup") === "dialog") {
        return buttonRect;
      }
      return { ...BUTTON_RECT, right: 0 };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("aligns the menu right edge to the button on mobile-width viewports", () => {
    render(<NavMenu actions={actions} />);

    fireEvent.click(screen.getByRole("button", { name: /toggle quick actions/i }));

    expect(screen.getByRole("dialog", { name: /quick actions/i })).toHaveStyle({
      left: "auto",
      right: "16px",
      top: "64px",
      maxHeight: "calc(100vh - 76px)",
    });
  });

  test("keeps the menu anchored to the button after larger viewport changes", () => {
    render(<NavMenu actions={actions} />);

    fireEvent.click(screen.getByRole("button", { name: /toggle quick actions/i }));

    buttonRect = { ...BUTTON_RECT, right: 724, bottom: 56 };
    setViewportWidth(768);
    fireEvent(window, new window.Event("resize"));

    expect(screen.getByRole("dialog", { name: /quick actions/i })).toHaveStyle({
      left: "auto",
      right: "44px",
      top: "68px",
      maxHeight: "calc(100vh - 80px)",
    });
  });
});
