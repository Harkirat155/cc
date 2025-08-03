import React from 'react';

const ValueMark = ({ value }) => {
  let colorClass = '';
  if (value === 'X') colorClass = 'text-blue-600';
  else if (value === 'O') colorClass = 'text-red-600';
  return (
    <span className={`transition-all duration-300 ${colorClass}`}>{value}</span>
  );
};

export default ValueMark;