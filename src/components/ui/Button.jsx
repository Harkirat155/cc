import React, { forwardRef } from "react";

const base =
  "py-2 px-5 min-w-[120px] rounded-xl border whitespace-nowrap text-center shadow-sm transition-all duration-200 backdrop-blur-md focus:outline-none focus:ring-2";

const variants = {
  primary:
    "bg-blue-600 text-white border-blue-700/20 dark:border-blue-400/20 hover:bg-blue-700 hover:border-blue-800/30 active:bg-blue-600 focus:ring-blue-400/40",
  danger:
    "bg-rose-500 text-white border-rose-700/20 dark:border-rose-400/20 hover:bg-rose-600 hover:border-rose-800/30 active:bg-rose-500 focus:ring-rose-400/40",
  success:
    "bg-emerald-600 text-white border-emerald-700/20 dark:border-emerald-400/20 hover:bg-emerald-700 hover:border-emerald-800/30 active:bg-emerald-600 focus:ring-emerald-400/40",
  neutral:
    "bg-gray-700 text-white border-gray-700/30 dark:border-gray-500/20 hover:bg-gray-800 hover:border-gray-900/40 active:bg-gray-700 focus:ring-gray-400/40",
  purple:
    "bg-purple-600 text-white border-purple-700/20 dark:border-purple-400/20 hover:bg-purple-700 hover:border-purple-800/30 active:bg-purple-600 focus:ring-purple-400/40",
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
