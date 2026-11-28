import React from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import useInviteArrival from "./useInviteArrival";

const Probe = () => {
  useInviteArrival();
  return <output data-testid="where">{useLocation().search}</output>;
};

describe("room_link tally", () => {
  const beacon = jest.fn(() => true);
  const visit = (url) => render(<MemoryRouter initialEntries={[url]}><Probe /></MemoryRouter>);
  const hits = () => beacon.mock.calls.map(([u]) => u).filter((u) => u.includes("e=room_link"));
  beforeEach(() => { beacon.mockClear(); Object.assign(navigator, { sendBeacon: beacon }); });

  test("counts one hit for an arrival with ?via=j and none without", () => {
    visit("/room/ABCDE");
    expect(hits()).toHaveLength(0);
    visit("/room/ABCDE?via=j");
    expect(hits()).toHaveLength(1);
  });

  test("drops ?via=j from the address once counted, keeping other params", () => {
    visit("/room/ABCDE?via=j&game=connect4");
    expect(hits()).toHaveLength(1);
    expect(screen.getByTestId("where").textContent).toBe("?game=connect4");
  });

  test("ignores other via values", () => {
    visit("/room/ABCDE?via=d");
    expect(hits()).toHaveLength(0);
  });
});
