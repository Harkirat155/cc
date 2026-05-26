import React from "react";

const BoardFrame = ({ children }) => (
  <div className="relative mx-auto flex max-w-full justify-center" data-tour="board">
    <div className="relative flex min-h-[300px] max-w-full items-center justify-center overflow-x-auto rounded-[2rem] border border-foreground/5 bg-foreground/[0.02] p-4 shadow-2xl backdrop-blur-sm min-[360px]:p-6 sm:p-8">
      {children}
    </div>
  </div>
);

export default BoardFrame;
