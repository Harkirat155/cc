import React from 'react';

const ResultModal = ({ result, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center animate-fadeIn">
    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full transform transition-all duration-300 scale-100 flex flex-col items-center justify-center">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 text-center">{result}</h2>
      <button
        className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-200"
        onClick={onClose}
      >
        Start New Game
      </button>
    </div>
  </div>
);

export default ResultModal;
