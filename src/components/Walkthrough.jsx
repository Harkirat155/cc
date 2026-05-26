import React, { Suspense, lazy } from "react";

const Joyride = lazy(() =>
  import("react-joyride").then((module) => ({ default: module.default }))
);

const joyrideStyles = {
  options: {
    primaryColor: "var(--foreground)",
    arrowColor: "color-mix(in srgb, var(--card) 88%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--card) 88%, transparent)",
    textColor: "var(--foreground)",
    overlayColor: "color-mix(in srgb, var(--foreground) 16%, transparent)",
    zIndex: 1000,
  },
  tooltip: {
    border: "1px solid var(--glass-border)",
    borderRadius: "24px",
    backdropFilter: "blur(24px)",
    boxShadow: "0 24px 80px -40px rgba(0, 0, 0, 0.55)",
  },
  tooltipContainer: {
    textAlign: "left",
    padding: "20px",
    borderRadius: "18px",
  },
  tooltipTitle: {
    fontSize: "1.125rem",
    marginBottom: "0.75rem",
    fontWeight: 700,
  },
  tooltipContent: {
    fontSize: "0.95rem",
    lineHeight: 1.6,
  },
  buttonNext: {
    backgroundColor: "var(--foreground)",
    color: "var(--background)",
    borderRadius: "9999px",
    padding: "0.45rem 1.25rem",
  },
  buttonBack: {
    color: "var(--muted-foreground)",
    marginRight: "0.75rem",
  },
  buttonClose: {
    color: "var(--muted-foreground)",
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
