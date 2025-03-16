import React from 'react';

const LoadingSpinner = ({ size = 'medium', color = 'indigo' }) => {
  // Size classes
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12',
  };
  
  // Color classes
  const colorClasses = {
    indigo: 'border-indigo-500',
    blue: 'border-blue-500',
    gray: 'border-gray-500',
    green: 'border-green-500',
  };
  
  // Combine classes
  const spinnerSize = sizeClasses[size] || sizeClasses.medium;
  const spinnerColor = colorClasses[color] || colorClasses.indigo;
  
  return (
    <div className="flex items-center justify-center">
      <div
        className={`${spinnerSize} border-2 border-t-transparent ${spinnerColor} rounded-full animate-spin`}
        role="status"
        aria-label="Loading"
      ></div>
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default LoadingSpinner;