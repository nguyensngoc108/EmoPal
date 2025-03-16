import React from 'react';
import { motion } from 'framer-motion';

const LifestyleQuestionsStep = ({ sleepValue, stressValue, onChange, onNext, onBack }) => {
  // Sleep quality options
  const sleepOptions = [
    { value: 'good', label: 'Good - I sleep well most nights' },
    { value: 'fair', label: 'Fair - My sleep is inconsistent' },
    { value: 'poor', label: 'Poor - I frequently have trouble sleeping' },
    { value: 'very_poor', label: 'Very Poor - I struggle with sleep disorders' }
  ];
  
  // Stress level options
  const stressOptions = [
    { value: 'low', label: 'Low - I rarely feel stressed' },
    { value: 'moderate', label: 'Moderate - I sometimes feel stressed' },
    { value: 'high', label: 'High - I frequently feel stressed' },
    { value: 'very_high', label: 'Very High - I feel overwhelmed by stress daily' }
  ];

  // Update both values simultaneously
  const handleChange = (field, value) => {
    onChange({ [field]: value });
  };
  
  // Validate and proceed to next step
  const handleNext = () => {
    onNext();
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Tell Us About Your Lifestyle</h2>
        <p className="text-gray-600 mt-2">
          These details help us find therapists with the right expertise for your situation
        </p>
      </div>
      
      {/* Sleep Quality Question */}
      <div className="space-y-4">
        <label className="block text-lg font-medium text-gray-700">
          How would you rate your sleeping habits?
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sleepOptions.map(option => (
            <div 
              key={option.value}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                sleepValue === option.value 
                  ? 'border-indigo-600 bg-indigo-50' 
                  : 'border-gray-300 hover:border-indigo-300'
              }`}
              onClick={() => handleChange('sleepQuality', option.value)}
            >
              <div className="flex items-center">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  sleepValue === option.value ? 'border-indigo-600' : 'border-gray-300'
                }`}>
                  {sleepValue === option.value && (
                    <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                  )}
                </div>
                <span className="ml-3">{option.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Stress Level Question */}
      <div className="space-y-4">
        <label className="block text-lg font-medium text-gray-700">
          How would you rate your current stress level?
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stressOptions.map(option => (
            <div 
              key={option.value}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                stressValue === option.value 
                  ? 'border-indigo-600 bg-indigo-50' 
                  : 'border-gray-300 hover:border-indigo-300'
              }`}
              onClick={() => handleChange('stressLevel', option.value)}
            >
              <div className="flex items-center">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  stressValue === option.value ? 'border-indigo-600' : 'border-gray-300'
                }`}>
                  {stressValue === option.value && (
                    <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                  )}
                </div>
                <span className="ml-3">{option.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Navigation buttons */}
      <div className="flex justify-between pt-6">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default LifestyleQuestionsStep;