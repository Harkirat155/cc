import {
  getMatchActions,
  getMatchActionState,
  splitMatchActionsForLayout,
} from "./matchActions";

const keys = (actions) => actions.map((action) => action.key);

describe("match action state resolver", () => {
  test.each([
    [{}, "local.ready.clean"],
    [{ hasMoves: true }, "local.active.clean"],
    [{ canResetScore: true }, "local.ready.scored"],
    [{ hasMoves: true, canResetScore: true }, "local.active.scored"],
    [{ isMultiplayer: true }, "room.ready.clean"],
    [{ isMultiplayer: true, hasMoves: true }, "room.active.clean"],
    [{ isMultiplayer: true, canResetScore: true }, "room.ready.scored"],
    [
      { isMultiplayer: true, hasMoves: true, canResetScore: true },
      "room.active.scored",
    ],
  ])("derives %s as %s", (context, expectedKey) => {
    expect(getMatchActionState(context).key).toBe(expectedKey);
  });

  test("preserves existing local action availability", () => {
    const state = getMatchActionState({ canResetScore: true });

    expect(keys(getMatchActions(state))).toEqual(["reset", "create", "find"]);
  });

  test("only exposes share when a multiplayer room id exists", () => {
    const withoutRoom = getMatchActionState({ isMultiplayer: true });
    const withRoom = getMatchActionState({ isMultiplayer: true, roomId: "ABCDE" });

    expect(keys(getMatchActions(withoutRoom))).toEqual(["leave"]);
    expect(keys(getMatchActions(withRoom))).toEqual(["share", "leave"]);
  });

  test("keeps desktop inline while compact layout moves extras behind overflow", () => {
    const state = getMatchActionState({
      hasMoves: true,
      canResetScore: true,
    });
    const actions = getMatchActions(state);

    expect(keys(splitMatchActionsForLayout(actions, state).visibleActions)).toEqual([
      "new",
      "reset",
      "create",
      "find",
    ]);
    expect(
      keys(splitMatchActionsForLayout(actions, state, { compact: true }).visibleActions)
    ).toEqual(["new"]);
    expect(
      keys(splitMatchActionsForLayout(actions, state, { compact: true }).overflowActions)
    ).toEqual(["reset", "create", "find"]);
  });

  test("compact ready states keep two direct actions", () => {
    const state = getMatchActionState({});
    const actions = getMatchActions(state);
    const layout = splitMatchActionsForLayout(actions, state, { compact: true });

    expect(keys(layout.visibleActions)).toEqual(["create", "find"]);
    expect(layout.overflowActions).toEqual([]);
  });
});
