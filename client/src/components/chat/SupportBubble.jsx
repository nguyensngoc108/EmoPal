import React from 'react';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/solid';

const SupportBubble = ({ onClick }) => {
  return (
    <button 
      onClick={onClick}
      className="fixed bottom-6 right-6 bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:bg-indigo-700 transition-colors z-50"
      aria-label="Get help"
    >
      <QuestionMarkCircleIcon className="h-6 w-6" />
    </button>
  );
};

export default SupportBubble;