import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import FeedbackDialog from "./FeedbackDialog";

describe("FeedbackDialog", () => {
  test("submits rating and message when valid", () => {
    const handleSubmit = jest.fn();
    const handleClose = jest.fn();

    render(
      <FeedbackDialog
        open
        onClose={handleClose}
        onSubmit={handleSubmit}
        submitting={false}
      />
    );

    const submitButton = screen.getByRole("button", { name: /send feedback/i });
    expect(submitButton).toBeDisabled();

    const stars = screen.getAllByRole("button", { name: /star/i });
    fireEvent.click(stars[4]);

    const textarea = screen.getByPlaceholderText(/let us know/i);
    fireEvent.change(textarea, {
      target: { value: "Loving the new feedback flow!" },
    });

    expect(submitButton).not.toBeDisabled();

    fireEvent.click(submitButton);

    expect(handleSubmit).toHaveBeenCalledWith({
      rating: 5,
      message: "Loving the new feedback flow!",
    });
  });

  test("does not render dialog when closed", () => {
    const { rerender } = render(<FeedbackDialog open={false} />);
    expect(screen.queryByText(/we value your feedback/i)).not.toBeInTheDocument();

    rerender(<FeedbackDialog open />);
    expect(screen.getByText(/we value your feedback/i)).toBeInTheDocument();
  });
});
