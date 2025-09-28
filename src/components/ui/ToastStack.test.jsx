import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import ToastStack from "./ToastStack";

describe("ToastStack", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("defers hidden toast dismissal until it becomes visible", () => {
    const onDismiss = jest.fn();

    const Wrapper = () => {
      const [messages, setMessages] = React.useState([
        { id: "toast-1", text: "First", duration: 1000 },
        { id: "toast-2", text: "Second", duration: 1000 },
      ]);

      const handleDismiss = (id) => {
        setMessages((prev) => prev.filter((toast) => toast.id !== id));
        onDismiss(id);
      };

      return <ToastStack messages={messages} onDismiss={handleDismiss} />;
    };

    render(<Wrapper />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenNthCalledWith(1, "toast-2");

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(2);
    expect(onDismiss).toHaveBeenNthCalledWith(2, "toast-1");
  });
});
