import React from 'react';

const ValueMark = ({ value }) => {
  let colorClass = '';
  if (!value || value === '') return <span className="transition-all duration-300"></span>;
  if (value === 'X') {
    // Lighter blue and subtle glow in dark mode for better contrast
    colorClass = 'text-blue-600 dark:text-blue-400 dark:drop-shadow-[0_0_8px_rgba(59,130,246,0.45)]';
  } else if (value === 'O') {
    // Lighter red and subtle glow in dark mode for better contrast
    colorClass = 'text-red-600 dark:text-red-400 dark:drop-shadow-[0_0_8px_rgba(239,68,68,0.45)]';
  }
  return (
    <span className={`transition-all duration-300 ${colorClass}`}>{value}</span>
  );
};

export default ValueMark;