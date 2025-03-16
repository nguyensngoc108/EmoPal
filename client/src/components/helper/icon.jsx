import React from 'react';

const Icon = ({ icon: IconComponent, size = "md", className = "" }) => {
  const sizeClasses = {
    xs: "h-4 w-4",
    sm: "h-5 w-5",
    md: "h-6 w-6",
    lg: "h-8 w-8",
    xl: "h-10 w-10",
    "2xl": "h-12 w-12"
  };
  
  return (
    <IconComponent className={`${sizeClasses[size]} ${className}`} />
  );
};

export default Icon;