import React, { Suspense, lazy } from "react";

/**
 * Walkthrough - Onboarding Tour Guide
 * 
 * Typography: Fluid scaling via joyride styles
 * Uses react-joyride for step-by-step tutorials
 */

const Joyride = lazy(() =>
  import("react-joyride").then((module) => ({ default: module.default }))
);

const joyrideStyles = {
  options: {
    primaryColor: "#6366f1",
    arrowColor: "#1f2937",
    backgroundColor: "#111827",
    textColor: "#f9fafb",
    overlayColor: "rgba(15, 23, 42, 0.55)",
    zIndex: 1000,
  },
  tooltipContainer: {
    textAlign: "left",
    padding: "clamp(16px, 4vw, 24px)",
    borderRadius: "16px",
  },
  tooltipTitle: {
    fontSize: "clamp(1rem, 2.5vw, 1.125rem)",
    marginBottom: "0.75rem",
    fontWeight: 700,
  },
  tooltipContent: {
    fontSize: "clamp(0.875rem, 2vw, 0.95rem)",
    lineHeight: 1.6,
  },
  buttonNext: {
    backgroundColor: "#6366f1",
    borderRadius: "9999px",
    padding: "0.625rem 1.5rem",
    minHeight: "44px",
  },
  buttonBack: {
    color: "#94a3b8",
    marginRight: "0.75rem",
    minHeight: "44px",
  },
  buttonClose: {
    color: "#94a3b8",
    minWidth: "44px",
    minHeight: "44px",
  },
};

const locale = {
  back: "Back",
  close: "Close",
  last: "Finish",
  next: "Next",
  open: "Open",
  skip: "Skip",
};

const Walkthrough = ({ run, steps, onCallback }) => (
  <Suspense fallback={null}>
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      disableOverlayClose
      disableScrolling
      scrollToFirstStep
      spotlightPadding={16}
      styles={joyrideStyles}
      locale={locale}
      callback={onCallback}
      floaterProps={{
        styles: {
          arrow: {
            length: 16,
            spread: 20,
          },
        },
      }}
    />
  </Suspense>
);

export default Walkthrough;
