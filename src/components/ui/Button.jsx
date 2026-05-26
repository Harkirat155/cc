import React, { forwardRef } from "react";

const base =
  "inline-flex min-w-[96px] items-center justify-center rounded-full border px-4 py-2 text-center text-sm font-semibold shadow-sm backdrop-blur-md transition-all duration-200 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

const variants = {
  primary:
    "border-foreground/10 bg-foreground text-background hover:bg-foreground/90 active:bg-foreground/80 focus:ring-foreground/20",
  danger:
    "border-rose-500/20 bg-rose-500/10 text-rose-600 hover:bg-rose-500/15 focus:ring-rose-500/20 dark:text-rose-300",
  success:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 focus:ring-emerald-500/20 dark:text-emerald-300",
  neutral:
    "border-foreground/10 bg-foreground/[0.03] text-foreground/75 hover:bg-foreground/[0.06] hover:text-foreground focus:ring-foreground/20",
  purple:
    "border-foreground/10 bg-foreground/[0.03] text-foreground/80 hover:bg-foreground/[0.06] hover:text-foreground focus:ring-foreground/20",
  indigo:
    "border-foreground/10 bg-foreground/[0.03] text-foreground/80 hover:bg-foreground/[0.06] hover:text-foreground focus:ring-foreground/20",
};

const Button = forwardRef(function Button(
  { variant = "primary", className = "", children, type = "button", ...props },
  ref
) {
  const cls = [base, variants[variant], className].filter(Boolean).join(" ");
  return (
    <button ref={ref} className={cls} type={type} {...props}>
      {children}
    </button>
  );
});

export default Button;
